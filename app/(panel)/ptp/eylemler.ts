'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle, YetkisizHata } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import type { GorevTuru } from '@/lib/tipler';

/* PTP sunucu eylemleri.

   Kural: her eylemin ilk satırı yetkiDenetle(). İstisna yok.
   firma_id istemciden ALINMAZ — oturumdan türetilir.

   ⚠️ Sunucu eyleminden FIRLATILAN hata üretimde gizlenir; kullanıcı
   "Minified React error #441" görür ve hiçbir şey öğrenemez. Bu yüzden
   eylemler hata fırlatmaz, SONUÇ DÖNDÜRÜR. Teknik ayrıntı sunucuda
   loglanır, kullanıcıya ne yapacağını söyleyen bir cümle gider.
   Bkz. standartlar/02-GUVENLIK.md */

export type Sonuc<T = void> =
	| { tamam: true; veri: T }
	| { tamam: false; mesaj: string };

/** Hatayı loglar, kullanıcıya güvenli bir mesaj döndürür. */
function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };
	console.error('[ptp]', e);
	return { tamam: false, mesaj: varsayilan };
}

type GorevKaydiGirdisi = {
	firma_id: string;
	gorev_id: string;
	yapan_id: string;
	zaman: string;
	deger_bolge_id: string | null;
	deger_metin: string | null;
	deger_sayi: number | null;
};

export type GorevDegeri = {
	onay?: boolean;
	/* Çoğul: aynı anda birden çok bölüm yapılmış olabilir —
	   "masayı ve beyaz rafları birlikte sildim". */
	bolgeIdler?: string[];
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
		/* Bölge seçimi görevin kendisine YAZILMAZ; her bölüm için ayrı
		   kayıt açılır (bkz. gorevTamamla). Tek sütun çoklu seçimi
		   taşıyamaz ve ısı haritası zaten kayıtlardan okuyor. */
		case 'bolge':
			return bos;
		case 'metin':
			return { ...bos, deger_metin: (deger.metin ?? '').trim() || null };
		case 'sayi':
			return { ...bos, deger_sayi: deger.sayi ?? null };
		/* Kontrol listesinde değer maddelerde tutulur; görevin kendisi
		   yalnızca "yapıldı" işareti taşır. */
		case 'kontrol':
		case 'onay':
		default:
			return { ...bos, deger_onay: deger.onay ?? true };
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
): Promise<Sonuc> {
	try {
		const { kullanici, yonetici } = await yetkiDenetle('ptp', 'yazma');
		const supabase = await sunucuIstemcisi();

		/* Atama denetimi RLS'te değil burada: RLS firma ayrımı için,
		   "başkasının görevini kapatma" ondan farklı bir soru. */
		const { data: gorev } = await supabase
			.from('ptp_gorevler')
			.select('id, firma_id, atanan_id, tekrarlanabilir')
			.eq('id', gorevId)
			.is('silindi', null)
			.maybeSingle();

		if (!gorev) return { tamam: false, mesaj: 'Görev bulunamadı.' };
		if (!yonetici && gorev.atanan_id && gorev.atanan_id !== kullanici.id) {
			return { tamam: false, mesaj: 'Bu görev başka bir kişiye atanmış.' };
		}

		const simdi = new Date().toISOString();
		const sutunlar = degerSutunlari(tur, deger);
		const bolgeIdler = deger.bolgeIdler ?? [];

		if (tur === 'bolge' && bolgeIdler.length === 0) {
			return { tamam: false, mesaj: 'En az bir bölüm seçin.' };
		}

		/* Ayrı kayıt açılan iki durum:
		   1. Bölge seçmeli görev — seçilen HER bölüm için bir satır.
		      "Masayı ve beyaz rafları birlikte sildim" iki kayıttır;
		      ısı haritasında ikisi de sayılmalı.
		   2. Tekrarlanabilir görev — her yapılış ayrı satır.
		      "Sabah ön masa, akşam arka masa" ikisi de görünmeli. */
		const kayitlar: GorevKaydiGirdisi[] =
			tur === 'bolge'
				? bolgeIdler.map((bolgeId) => ({
						firma_id: gorev.firma_id,
						gorev_id: gorevId,
						yapan_id: kullanici.id,
						zaman: simdi,
						deger_bolge_id: bolgeId,
						deger_metin: null,
						deger_sayi: null,
					}))
				: gorev.tekrarlanabilir
					? [
							{
								firma_id: gorev.firma_id,
								gorev_id: gorevId,
								yapan_id: kullanici.id,
								zaman: simdi,
								deger_bolge_id: null,
								deger_metin: sutunlar.deger_metin,
								deger_sayi: sutunlar.deger_sayi,
							},
						]
					: [];

		if (kayitlar.length > 0) {
			const { error: kayitHatasi } = await supabase
				.from('ptp_gorev_kayitlari')
				.insert(kayitlar);
			if (kayitHatasi) throw kayitHatasi;
		}

		/* Görevin kendisi son yapılışı taşır: gün özetinde "yapıldı mı"
		   sorusu buna bakıyor, tekrarlanabilirde de en son duruma. */
		const { error } = await supabase
			.from('ptp_gorevler')
			.update({
				durum: 'tamamlandi',
				tamamlayan_id: kullanici.id,
				tamamlanma_zamani: simdi,
				atlama_sebebi: null,
				...sutunlar,
			})
			.eq('id', gorevId);

		if (error) throw error;
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Görev kaydedilemedi. Tekrar deneyin.');
	}
}

/** Kontrol listesi maddesini işaretler ya da işareti kaldırır. */
export async function maddeIsaretle(
	maddeId: string,
	isaretli: boolean
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yazma');
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_gorev_maddeleri')
			.update({
				isaretli,
				isaretleyen_id: isaretli ? kullanici.id : null,
				isaretlenme_zamani: isaretli ? new Date().toISOString() : null,
			})
			.eq('id', maddeId);

		if (error) throw error;
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'İşaretlenemedi. Tekrar deneyin.');
	}
}

/** Görevi atlar. Sebep zorunlu — veri tabanı da bunu kısıtla zorluyor. */
export async function gorevAtla(
	gorevId: string,
	sebep: string
): Promise<Sonuc> {
	try {
		const { kullanici, yonetici } = await yetkiDenetle('ptp', 'yazma');
		const temiz = sebep.trim();
		if (!temiz) return { tamam: false, mesaj: 'Atlama sebebi yazılmalı.' };

		const supabase = await sunucuIstemcisi();
		const { data: gorev } = await supabase
			.from('ptp_gorevler')
			.select('id, atanan_id')
			.eq('id', gorevId)
			.is('silindi', null)
			.maybeSingle();

		if (!gorev) return { tamam: false, mesaj: 'Görev bulunamadı.' };
		if (!yonetici && gorev.atanan_id && gorev.atanan_id !== kullanici.id) {
			return { tamam: false, mesaj: 'Bu görev başka bir kişiye atanmış.' };
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

		if (error) throw error;
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.');
	}
}

/** Görevleri bir kişiye atar. Yalnızca müdür. Toplu çalışır. */
export async function gorevleriAta(
	gorevIdleri: string[],
	kullaniciId: string | null
): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		if (gorevIdleri.length === 0) return { tamam: true, veri: undefined };

		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('ptp_gorevler')
			.update({ atanan_id: kullaniciId })
			.in('id', gorevIdleri)
			.is('silindi', null);

		if (error) throw error;
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Atama yapılamadı. Tekrar deneyin.');
	}
}

/**
 * Bugünün görevlerini şablonlardan üretir. Yalnızca müdür.
 *
 * Aynı gün iki kez çalıştırılırsa görev ikiye katlanmaz; zaten
 * üretilmiş şablonlar atlanır. İleride pg_cron her sabah bu fonksiyonu
 * çağıracak — düğme, ilk kurulum ve şablon değişikliği için duruyor.
 */
export async function gunuOlustur(tarih: string): Promise<Sonuc<number>> {
	try {
		await yetkiDenetle('ptp', 'yonetim');

		/* Süperadminin firması yoktur; hangi firma adına çalıştığı
		   burada çözülür. Önceden kullanici.firma_id yazılıyordu ve
		   süperadminde null olduğu için kayıt reddediliyordu. */
		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const gun = new Date(tarih + 'T00:00:00');
		/* Postgres'te 1=Pazartesi, JS'te 0=Pazar. Dönüşüm burada. */
		const haftaninGunu = gun.getDay() === 0 ? 7 : gun.getDay();

		const { data: sablonlar, error: sablonHatasi } = await supabase
			.from('ptp_sablonlar')
			.select('id, baslik, tur, grup, zorunlu, tekrarlanabilir, fotograf_ister, ipucu, tekrar, tekrar_gunleri, tek_tarih')
			.eq('firma_id', firmaId)
			.eq('aktif', true)
			.is('silindi', null);

		if (sablonHatasi) throw sablonHatasi;
		if (!sablonlar?.length) {
			return {
				tamam: false,
				mesaj: 'Tanımlı görev şablonu yok. Önce şablon oluşturulmalı.',
			};
		}

		const { data: mevcut } = await supabase
			.from('ptp_gorevler')
			.select('sablon_id')
			.eq('firma_id', firmaId)
			.eq('tarih', tarih)
			.is('silindi', null);

		const uretilmis = new Set((mevcut ?? []).map((g) => g.sablon_id));

		const bugunkuler = sablonlar.filter((s) => {
			if (uretilmis.has(s.id)) return false;
			if (s.tekrar === 'gunluk') return true;
			if (s.tekrar === 'tek_seferlik') return s.tek_tarih === tarih;
			return (s.tekrar_gunleri as number[]).includes(haftaninGunu);
		});

		if (bugunkuler.length === 0) return { tamam: true, veri: 0 };

		const { data: yeniGorevler, error } = await supabase
			.from('ptp_gorevler')
			.insert(
				bugunkuler.map((s) => ({
					firma_id: firmaId,
					sablon_id: s.id,
					tarih,
					grup: s.grup,
					baslik: s.baslik,
					tur: s.tur,
					zorunlu: s.zorunlu,
					tekrarlanabilir: s.tekrarlanabilir,
					fotograf_ister: s.fotograf_ister,
					ipucu: s.ipucu,
					kaynak: 'sablon' as const,
				}))
			)
			.select('id, sablon_id');

		if (error) throw error;

		/* Kontrol listesi maddeleri şablondan KOPYALANIR, referansla
		   bağlanmaz. Şablon sonradan değişse bile o günkü liste olduğu
		   gibi kalsın diye; yoksa geçmişe bakan müdür bugünkü şablonu
		   görür ve o gün gerçekte ne işaretlendiğini bilemez. */
		const kontrolSablonlari = bugunkuler
			.filter((s) => s.tur === 'kontrol')
			.map((s) => s.id);

		if (kontrolSablonlari.length > 0) {
			const { data: maddeler } = await supabase
				.from('ptp_sablon_maddeleri')
				.select('sablon_id, metin, sira')
				.in('sablon_id', kontrolSablonlari)
				.is('silindi', null)
				.order('sira');

			if (maddeler?.length) {
				const gorevHaritasi = new Map(
					(yeniGorevler ?? []).map((g) => [g.sablon_id, g.id])
				);
				const satirlar = maddeler
					.map((m) => {
						const gorevId = gorevHaritasi.get(m.sablon_id);
						return gorevId
							? { firma_id: firmaId, gorev_id: gorevId, metin: m.metin, sira: m.sira }
							: null;
					})
					.filter((x): x is NonNullable<typeof x> => x !== null);

				if (satirlar.length > 0) {
					const { error: maddeHatasi } = await supabase
						.from('ptp_gorev_maddeleri')
						.insert(satirlar);
					if (maddeHatasi) throw maddeHatasi;
				}
			}
		}

		revalidatePath('/ptp');
		return { tamam: true, veri: bugunkuler.length };
	} catch (e) {
		return hataya(e, 'Görevler oluşturulamadı. Tekrar deneyin.');
	}
}
