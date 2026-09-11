import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { modulSeviyesi } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';

/* GET  /api/edp/ayarlar → ayarlar + tedarikçi listesi
   PUT  /api/edp/ayarlar → kaydet

   Yanıt biçimi yereldeki programın localStorage'da tuttuğu `cfg`
   nesnesiyle BİREBİR aynı: birim, kdv, sistemKdv, suppliers, xlmap,
   f1Discount… Böylece arayüz kodu hiç değişmiyor, yalnızca okuma ve
   yazmanın yeri değişiyor. Aynı yaklaşım ÖTP'de de kullanıldı.

   Firma İSTEMCİDEN ALINMAZ: oturumdan türetiliyor. */

export const dynamic = 'force-dynamic';

/* Satır yoksa dönen varsayılan — programdaki DEF ile aynı. */
const VARSAYILAN = {
	birim: 'ADET',
	kdv: '20',
	sistemKdv: '1',
	f1Discount: '0',
	f1Discount2: '',
	f3: '100',
	f5: '100',
	suppliers: {} as Record<string, string>,
	xlmap: null as Record<string, number> | null,
};

type Satir = {
	birim: string;
	kdv: string;
	sistem_kdv: string;
	f1_iskonto: string;
	f1_iskonto2: string;
	f3_karlilik: string;
	f5_karlilik: string;
	kolon_eslemesi: Record<string, number> | null;
};

export async function GET() {
	try {
		const seviye = await modulSeviyesi('edp');
		if (!seviye) {
			return NextResponse.json({ error: 'yetkisiz' }, { status: 403 });
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const [ayarSonuc, tedarikciSonuc] = await Promise.all([
			supabase
				.from('edp_ayarlar')
				.select('*')
				.eq('firma_id', firmaId)
				.maybeSingle(),
			supabase
				.from('edp_tedarikciler')
				.select('grup_kodu, oran')
				.eq('firma_id', firmaId)
				.order('grup_kodu'),
		]);

		const satir = ayarSonuc.data as Satir | null;

		const suppliers: Record<string, string> = {};
		for (const t of (tedarikciSonuc.data ?? []) as {
			grup_kodu: string;
			oran: number;
		}[]) {
			/* Programda çarpan METİN olarak tutuluyor ("1.10") ve
			   karşılaştırmalar da metin üzerinden yapılıyor; sayı
			   dönersek "%10" seçili gelmez. */
			suppliers[t.grup_kodu] = Number(t.oran).toFixed(2);
		}

		return NextResponse.json({
			birim: satir?.birim ?? VARSAYILAN.birim,
			kdv: satir?.kdv ?? VARSAYILAN.kdv,
			sistemKdv: satir?.sistem_kdv ?? VARSAYILAN.sistemKdv,
			f1Discount: satir?.f1_iskonto ?? VARSAYILAN.f1Discount,
			f1Discount2: satir?.f1_iskonto2 ?? VARSAYILAN.f1Discount2,
			f3: satir?.f3_karlilik ?? VARSAYILAN.f3,
			f5: satir?.f5_karlilik ?? VARSAYILAN.f5,
			xlmap: satir?.kolon_eslemesi ?? null,
			suppliers,
			/* Programın göç kodu bu bayrağa bakıyor; sunucudan gelen
			   veri zaten yeni biçimde. */
			priceRulesV2: true,
		});
	} catch (e) {
		console.error('[edp/ayarlar GET]', e);
		return NextResponse.json({ error: 'okunamadı' }, { status: 500 });
	}
}

export async function PUT(istek: Request) {
	try {
		const seviye = await modulSeviyesi('edp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') {
			return NextResponse.json({ error: 'yetkisiz' }, { status: 403 });
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();
		const govde = (await istek.json()) as Record<string, unknown>;

		const metin = (v: unknown, varsayilan: string) =>
			typeof v === 'string' ? v.slice(0, 40) : varsayilan;

		const { error: ayarHatasi } = await supabase.from('edp_ayarlar').upsert(
			{
				firma_id: firmaId,
				birim: metin(govde.birim, VARSAYILAN.birim),
				kdv: metin(govde.kdv, VARSAYILAN.kdv),
				sistem_kdv: metin(govde.sistemKdv, VARSAYILAN.sistemKdv),
				f1_iskonto: metin(govde.f1Discount, VARSAYILAN.f1Discount),
				f1_iskonto2: metin(govde.f1Discount2, VARSAYILAN.f1Discount2),
				f3_karlilik: metin(govde.f3, VARSAYILAN.f3),
				f5_karlilik: metin(govde.f5, VARSAYILAN.f5),
				kolon_eslemesi:
					govde.xlmap && typeof govde.xlmap === 'object' ? govde.xlmap : null,
			},
			{ onConflict: 'firma_id' }
		);
		if (ayarHatasi) throw ayarHatasi;

		/* Tedarikçi listesi tam olarak gönderiliyor: programda ekleme
		   ve silme aynı nesne üzerinde yapılıyor, tek tek uç açmak
		   arayüzü değiştirmek demekti. Önce sil sonra yaz — silinen
		   bir tedarikçinin kalmaması için. */
		if (govde.suppliers && typeof govde.suppliers === 'object') {
			const gelen = govde.suppliers as Record<string, unknown>;

			const satirlar = Object.entries(gelen)
				.map(([kod, oran]) => ({
					firma_id: firmaId,
					grup_kodu: String(kod).trim().toUpperCase().slice(0, 40),
					oran: Number(oran),
				}))
				.filter(
					(s) =>
						s.grup_kodu.length > 0 &&
						Number.isFinite(s.oran) &&
						s.oran >= 1 &&
						s.oran <= 2
				);

			const { error: silHatasi } = await supabase
				.from('edp_tedarikciler')
				.delete()
				.eq('firma_id', firmaId);
			if (silHatasi) throw silHatasi;

			if (satirlar.length > 0) {
				const { error: yazHatasi } = await supabase
					.from('edp_tedarikciler')
					.insert(satirlar);
				if (yazHatasi) throw yazHatasi;
			}
		}

		return NextResponse.json({ tamam: true });
	} catch (e) {
		console.error('[edp/ayarlar PUT]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}
