import 'server-only';
import { cache } from 'react';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici, modulSeviyesi } from '@/lib/yetki';

/* ÖTP veri katmanı.

   Yerel programın şekli korunuyor: arayüz `{payments, krediler}`
   bekliyor ve alan adları JSON'daki gibi (`seriNo`, `not`). Tabloda
   kolon adları Türkçe ve alt tireli (`seri_no`, `not_metni`); dönüşüm
   burada, tek yerde yapılıyor. Arayüz hiçbir şey bilmiyor. */

/** Programın şirket kodu → panelin firma kısa adı. */
const KOD_ESLEME: Record<string, string> = {
	squalahome: 'squala',
	squala: 'squala',
	wellmop: 'wellmop',
};

export type OtpFirma = { id: string; kod: string; ad: string };

/**
 * Kullanıcının görebileceği ÖTP firmaları.
 *
 * Programda bu liste kodun içindeydi ve iki kullanıcı da her şirketi
 * görüyordu. Artık RLS belirliyor: süperadmin hepsini, diğerleri
 * yalnızca kendi firmasını okuyabiliyor.
 */
export const otpFirmalari = cache(async function otpFirmalari(): Promise<
	OtpFirma[]
> {
	const supabase = await sunucuIstemcisi();

	const { data } = await supabase
		.from('firma_modulleri')
		.select('firma_id, firmalar!inner(id, ad, kisa_ad, aktif, silindi)')
		.eq('modul', 'otp')
		.eq('aktif', true);

	type Satir = {
		firmalar: { id: string; ad: string; kisa_ad: string; aktif: boolean; silindi: string | null };
	};

	return ((data ?? []) as unknown as Satir[])
		.filter((s) => s.firmalar?.aktif && !s.firmalar.silindi)
		.map((s) => ({ id: s.firmalar.id, kod: s.firmalar.kisa_ad, ad: s.firmalar.ad }))
		.sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));
});

/**
 * İstenen şirket kodunu firmaya çevirir; izinsizse null.
 * Boş gelirse ilk izinli firmaya düşer — programın davranışı buydu.
 */
export async function firmaCoz(istenen: string): Promise<OtpFirma | null> {
	const firmalar = await otpFirmalari();
	if (firmalar.length === 0) return null;

	const kod = KOD_ESLEME[istenen] ?? istenen;
	if (!kod) return firmalar[0];

	return firmalar.find((f) => f.kod === kod) ?? null;
}

/** Yazma yetkisi var mı. */
export async function yazabilirMi(): Promise<boolean> {
	const seviye = await modulSeviyesi('otp');
	return seviye === 'yazma' || seviye === 'yonetim';
}

/* ---------- Kayıt dönüşümü ---------- */

export type Odeme = {
	id: string;
	yon: string;
	tur: string;
	durum: string;
	tarih: string;
	firma: string;
	borclu: string;
	banka: string;
	hedef: string;
	tutar: number;
	seriNo: string;
	not: string;
	odendi: boolean;
	odenen: number;
};

type OdemeSatiri = {
	id: string;
	yon: string;
	tur: string;
	durum: string;
	tarih: string;
	firma: string;
	borclu: string;
	banka: string;
	hedef: string;
	tutar: number | string;
	seri_no: string;
	not_metni: string;
	odendi: boolean;
	odenen: number | string;
};

/** Tablo satırı → arayüzün beklediği biçim. */
export function odemeyeCevir(s: OdemeSatiri): Odeme {
	return {
		id: s.id,
		yon: s.yon,
		tur: s.tur,
		durum: s.durum,
		tarih: s.tarih,
		firma: s.firma,
		borclu: s.borclu,
		banka: s.banka,
		hedef: s.hedef,
		tutar: Number(s.tutar),
		seriNo: s.seri_no,
		not: s.not_metni,
		odendi: s.odendi,
		odenen: Number(s.odenen),
	};
}

/** Arayüzden gelen alanlar → tablo kolonları. Yalnızca gelenler. */
export function kolonlaraCevir(g: Record<string, unknown>): Record<string, unknown> {
	const esleme: Record<string, string> = {
		seriNo: 'seri_no',
		not: 'not_metni',
	};
	const izinli = [
		'yon', 'tur', 'durum', 'tarih', 'firma', 'borclu',
		'banka', 'hedef', 'tutar', 'seriNo', 'not',
	];

	const cikti: Record<string, unknown> = {};
	for (const alan of izinli) {
		if (!(alan in g)) continue;
		cikti[esleme[alan] ?? alan] = g[alan];
	}
	return cikti;
}

/**
 * `durum` alanını `odendi` / `odenen` ile tutarlı hâle getirir.
 * Programdaki sync_odendi() ile birebir aynı kural.
 */
export function senkronOdendi(yon: string, durum: string, tutar: number) {
	const bitti = durum === (yon === 'ALINAN' ? 'TAHSIL' : 'ODENDI');
	return { odendi: bitti, odenen: bitti ? tutar : 0 };
}

/** Programın ürettiği biçimde 12 haneli onaltılık kimlik. */
export function yeniKimlik(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/* ---------- İşlem günlüğü ---------- */

export async function gunlukYaz(
	firmaId: string,
	eylem: string,
	hedefId: string | null,
	ayrinti?: unknown
) {
	try {
		const kullanici = await aktifKullanici();
		const supabase = await sunucuIstemcisi();
		await supabase.from('otp_gunluk').insert({
			firma_id: firmaId,
			kullanici_id: kullanici.id,
			eylem,
			hedef_id: hedefId,
			ayrinti: ayrinti ?? null,
		});
	} catch {
		/* Günlük yazılamadıysa asıl işlem durmasın: kayıt tutmak
		   önemli ama kullanıcının işini engellemesi daha kötü. */
	}
}
