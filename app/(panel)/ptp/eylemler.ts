'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle, YetkisizHata } from '@/lib/yetki';
import type { GorevTuru } from '@/lib/tipler';

/* PTP sunucu eylemleri.

   Kural: her eylemin ilk satırı yetkiDenetle(). İstisna yok.
   firma_id istemciden ALINMAZ — oturumdaki kullanıcıdan türetilir.
   Bkz. standartlar/02-GUVENLIK.md */

export type GorevDegeri = {
	onay?: boolean;
	bolgeId?: string;
	metin?: string;
	sayi?: number;
};

/** Türe göre yalnızca doğru sütunu doldurur; gerisi null kalır. */
function degerSutunlari(tur: GorevTuru, deger: GorevDegeri) {
	const bos = {
		deger_onay: null as boolean | null,
		deger_bolge_id: null as string | null,
		deger_metin: null as string | null,
		deger_sayi: null as number | null,
	};
	switch (tur) {
		case 'onay':
			return { ...bos, deger_onay: deger.onay ?? true };
		case 'bolge':
			return { ...bos, deger_bolge_id: deger.bolgeId ?? null };
		case 'metin':
			return { ...bos, deger_metin: (deger.metin ?? '').trim() || null };
		case 'sayi':
			return { ...bos, deger_sayi: deger.sayi ?? null };
	}
}

/**
 * Görevi tamamlar.
 * Personel yalnızca KENDİNE atanmış görevi kapatabilir; müdür hepsini.
 */
export async function gorevTamamla(
	gorevId: string,
	tur: GorevTuru,
	deger: GorevDegeri
): Promise<void> {
	const { kullanici, yonetici } = await yetkiDenetle('ptp', 'yazma');
	const supabase = await sunucuIstemcisi();

	/* Görevi önce okuyup atamasını denetliyoruz. RLS firma ayrımını
	   zaten yapıyor; buradaki denetim "başkasının görevini kapatma"
	   kuralı için — o kural RLS'te değil, iş mantığında. */
	const { data: gorev, error: okumaHatasi } = await supabase
		.from('ptp_gorevler')
		.select('id, atanan_id, durum')
		.eq('id', gorevId)
		.is('silindi', null)
		.single();

	if (okumaHatasi || !gorev) throw new Error('Görev bulunamadı');

	if (!yonetici && gorev.atanan_id && gorev.atanan_id !== kullanici.id) {
		throw new YetkisizHata('Bu görev başka bir kişiye atanmış.');
	}

	const { error } = await supabase
		.from('ptp_gorevler')
		.update({
			durum: 'tamamlandi',
			tamamlayan_id: kullanici.id,
			tamamlanma_zamani: new Date().toISOString(),
			atlama_sebebi: null,
			...degerSutunlari(tur, deger),
		})
		.eq('id', gorevId);

	if (error) throw new Error('Görev kaydedilemedi: ' + error.message);
	revalidatePath('/ptp');
}

/** Görevi atlar. Sebep zorunlu — veri tabanı da bunu kısıtla zorluyor. */
export async function gorevAtla(gorevId: string, sebep: string): Promise<void> {
	const { kullanici, yonetici } = await yetkiDenetle('ptp', 'yazma');

	const temiz = sebep.trim();
	if (!temiz) throw new Error('Atlama sebebi yazılmalı');

	const supabase = await sunucuIstemcisi();

	const { data: gorev } = await supabase
		.from('ptp_gorevler')
		.select('id, atanan_id')
		.eq('id', gorevId)
		.is('silindi', null)
		.single();

	if (!gorev) throw new Error('Görev bulunamadı');
	if (!yonetici && gorev.atanan_id && gorev.atanan_id !== kullanici.id) {
		throw new YetkisizHata('Bu görev başka bir kişiye atanmış.');
	}

	const { error } = await supabase
		.from('ptp_gorevler')
		.update({
			durum: 'atlandi',
			atlama_sebebi: temiz,
			tamamlayan_id: kullanici.id,
			tamamlanma_zamani: new Date().toISOString(),
		})
		.eq('id', gorevId);

	if (error) throw new Error('Kaydedilemedi: ' + error.message);
	revalidatePath('/ptp');
}

/**
 * Görevleri bir kişiye atar. Yalnızca müdür.
 * Toplu çalışır: "şu beş görev Ayşe'ye" tek işlemde.
 */
export async function gorevleriAta(
	gorevIdleri: string[],
	kullaniciId: string | null
): Promise<void> {
	await yetkiDenetle('ptp', 'yonetim');
	if (gorevIdleri.length === 0) return;

	const supabase = await sunucuIstemcisi();
	const { error } = await supabase
		.from('ptp_gorevler')
		.update({ atanan_id: kullaniciId })
		.in('id', gorevIdleri)
		.is('silindi', null);

	if (error) throw new Error('Atama yapılamadı: ' + error.message);
	revalidatePath('/ptp');
}

/**
 * Bugünün görevlerini şablonlardan üretir. Yalnızca müdür.
 *
 * Aynı gün iki kez çalıştırılırsa görev ikiye katlanmaz: zaten üretilmiş
 * şablonlar atlanır. Bu işlem ileride pg_cron ile her sabah otomatik
 * çalışacak; elle düğme, ilk kurulum ve şablon değişikliği için duruyor.
 */
export async function gunuOlustur(tarih: string): Promise<number> {
	const { kullanici } = await yetkiDenetle('ptp', 'yonetim');
	const supabase = await sunucuIstemcisi();

	const gun = new Date(tarih + 'T00:00:00');
	/* Postgres'te 1=Pazartesi; JS'te 0=Pazar. Dönüşüm burada yapılır. */
	const haftaninGunu = gun.getDay() === 0 ? 7 : gun.getDay();

	const { data: sablonlar, error: sablonHatasi } = await supabase
		.from('ptp_sablonlar')
		.select('id, baslik, tur, grup, sira, zorunlu, fotograf_ister, ipucu, tekrar, tekrar_gunleri')
		.eq('aktif', true)
		.is('silindi', null);

	if (sablonHatasi) throw new Error('Şablonlar okunamadı: ' + sablonHatasi.message);
	if (!sablonlar?.length) return 0;

	const { data: mevcut } = await supabase
		.from('ptp_gorevler')
		.select('sablon_id')
		.eq('tarih', tarih)
		.is('silindi', null);

	const uretilmis = new Set((mevcut ?? []).map((g) => g.sablon_id));

	const bugunkuler = sablonlar.filter((s) => {
		if (uretilmis.has(s.id)) return false;
		if (s.tekrar === 'gunluk') return true;
		return (s.tekrar_gunleri as number[]).includes(haftaninGunu);
	});

	if (bugunkuler.length === 0) return 0;

	const { error } = await supabase.from('ptp_gorevler').insert(
		bugunkuler.map((s) => ({
			firma_id: kullanici.firma_id,
			sablon_id: s.id,
			tarih,
			grup: s.grup,
			baslik: s.baslik,
			tur: s.tur,
			zorunlu: s.zorunlu,
			fotograf_ister: s.fotograf_ister,
			ipucu: s.ipucu,
			kaynak: 'sablon' as const,
		}))
	);

	if (error) throw new Error('Görevler oluşturulamadı: ' + error.message);
	revalidatePath('/ptp');
	return bugunkuler.length;
}
