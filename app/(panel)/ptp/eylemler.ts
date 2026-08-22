'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle, YetkisizHata } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';

/* PTP kayıt eylemleri.

   Yeni yapıda görev satırı ÜRETİLMİYOR. Görev bir tanım; yapıldığında
   kayıt defterine satır düşüyor. Kapatılmamış bir görevin kaydı da yok
   — "yapılmadı" bilgisi kaydın yokluğundan anlaşılıyor.

   Kural: her eylemin ilk satırı yetkiDenetle(). İstisna yok.
   firma_id istemciden ALINMAZ — oturumdan türetilir. */

export type Sonuc<T = void> =
	| { tamam: true; veri: T }
	| { tamam: false; mesaj: string };

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };
	console.error('[ptp]', e);
	return { tamam: false, mesaj: varsayilan };
}

export type KayitGirdisi = {
	gorevId: string;
	tarih: string;
	bolgeIdler?: string[];
	maddeIdler?: string[];
	metin?: string;
	sayi?: number;
	not?: string;
	/* tur = 'eksik' görevlerde: tek tek eklenen ürün adları */
	eksikler?: string[];
	/* tur = 'ciro' görevlerde: gün sonu tutarı ve fiş sayısı */
	tutar?: number;
	fisSayisi?: number | null;
};

/**
 * Görevi yapıldı olarak kaydeder.
 * Tekrarlanabilir görevde her çağrı yeni bir satır açar — "sabah ön
 * masa, akşam arka masa" iki ayrı kayıttır.
 */
export async function kayitEkle(girdi: KayitGirdisi): Promise<Sonuc> {
	try {
		const { kullanici, yonetici } = await yetkiDenetle('ptp', 'yazma');
		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		/* Tanımı okuyup hem atamayı hem başlığı alıyoruz. Başlık kayda
		   kopyalanıyor: tanım sonradan değişse bile geçmiş bozulmasın. */
		const { data: gorev } = await supabase
			.from('ptp_gorevler')
			.select('id, baslik, tur, atanan_id, tekrarlanabilir, eksik_kategori')
			.eq('id', girdi.gorevId)
			.eq('firma_id', firmaId)
			.is('silindi', null)
			.maybeSingle();

		if (!gorev) return { tamam: false, mesaj: 'Görev bulunamadı.' };

		/* Atama denetimi RLS'te değil burada: RLS firma ayrımı için,
		   "başkasının görevini kapatma" ondan farklı bir soru. */
		if (!yonetici && gorev.atanan_id && gorev.atanan_id !== kullanici.id) {
			return { tamam: false, mesaj: 'Bu görev başka bir kişiye atanmış.' };
		}

		if (gorev.tur === 'bolge' && !(girdi.bolgeIdler ?? []).length) {
			return { tamam: false, mesaj: 'En az bir bölüm seçin.' };
		}
		if (gorev.tur === 'kontrol' && !(girdi.maddeIdler ?? []).length) {
			return { tamam: false, mesaj: 'En az bir madde işaretleyin.' };
		}

		const eksikler = (girdi.eksikler ?? [])
			.map((e) => e.trim())
			.filter(Boolean);

		if (gorev.tur === 'eksik' && eksikler.length === 0) {
			return { tamam: false, mesaj: 'En az bir ürün ekleyin.' };
		}

		if (gorev.tur === 'ciro') {
			if (typeof girdi.tutar !== 'number' || !Number.isFinite(girdi.tutar)) {
				return { tamam: false, mesaj: 'Ciro tutarını yazın.' };
			}
			if (girdi.tutar < 0) {
				return { tamam: false, mesaj: 'Ciro eksi olamaz.' };
			}

			/* Gün başına tek ciro. Veri tabanındaki benzersizlik indeksi de
			   bunu tutuyor; buradaki denetim, kayıt defterine satır
			   yazdıktan SONRA çarpıp yarım iş bırakmamak için. */
			const { data: mevcut } = await supabase
				.from('ptp_cirolar')
				.select('id')
				.eq('firma_id', firmaId)
				.eq('tarih', girdi.tarih)
				.is('silindi', null)
				.maybeSingle();

			if (mevcut) {
				return {
					tamam: false,
					mesaj: 'Bu günün cirosu zaten girilmiş. Yanlışsa yöneticinize söyleyin.',
				};
			}
		}

		/* Tekrarlanabilir olmayan görev günde bir kez kapatılır. */
		if (!gorev.tekrarlanabilir) {
			const { count } = await supabase
				.from('ptp_kayitlar')
				.select('id', { count: 'exact', head: true })
				.eq('gorev_id', girdi.gorevId)
				.eq('tarih', girdi.tarih);
			if ((count ?? 0) > 0) {
				return { tamam: false, mesaj: 'Bu görev bugün zaten kaydedildi.' };
			}
		}

		const { data: kayit, error } = await supabase
			.from('ptp_kayitlar')
			.insert({
				firma_id: firmaId,
				gorev_id: girdi.gorevId,
				tarih: girdi.tarih,
				yapan_id: kullanici.id,
				durum: 'yapildi',
				baslik_kopya: gorev.baslik,
				bolge_idler: girdi.bolgeIdler ?? [],
				madde_idler: girdi.maddeIdler ?? [],
				/* Eksik görevinde özet metin: kaydın kendisi de okunabilir olsun */
				deger_metin:
					gorev.tur === 'eksik'
						? eksikler.join(', ')
						: girdi.metin?.trim() || null,
				deger_sayi:
					gorev.tur === 'ciro' ? (girdi.tutar ?? null) : (girdi.sayi ?? null),
				not_metni: girdi.not?.trim() ?? '',
			})
			.select('id')
			.single();

		if (error) throw error;

		/* Ciro ayrı tabloya da yazılıyor: aylık toplam, ortalama ve prim
		   hesabı kayıt defterinin içinden değil oradan okunacak. */
		if (gorev.tur === 'ciro') {
			const { error: ciroHatasi } = await supabase.from('ptp_cirolar').insert({
				firma_id: firmaId,
				tarih: girdi.tarih,
				tutar: girdi.tutar,
				fis_sayisi: girdi.fisSayisi ?? null,
				not_metni: girdi.not?.trim() ?? '',
				giren_id: kullanici.id,
				gorev_id: girdi.gorevId,
				kayit_id: kayit.id,
			});

			/* Yazılamadıysa kayıt defterindeki satır da geri alınıyor.
			   Aksi hâlde "ciro girildi" görünür ama rakam hiçbir yerde
			   olmazdı — para ekranında en kötü hata sessiz olanıdır. */
			if (ciroHatasi) {
				await supabase.from('ptp_kayitlar').delete().eq('id', kayit.id);
				throw ciroHatasi;
			}
			revalidatePath('/ptp/ciro');
		}

		/* Her ürün AYRI eksik kaydı. Tek metin olarak yazılsaydı
		   "bardak takımı, kahve fincanı, supla" üç ürün olmasına rağmen
		   tek satır olur, tek tek işaretlenemez ve sayılamazdı. */
		if (gorev.tur === 'eksik' && eksikler.length > 0) {
			const { error: eksikHatasi } = await supabase.from('ptp_eksikler').insert(
				eksikler.map((metin) => ({
					firma_id: firmaId,
					metin,
					kategori: gorev.eksik_kategori ?? 'urun',
					bildiren_id: kullanici.id,
					gorev_id: girdi.gorevId,
					kayit_id: kayit.id,
				}))
			);
			if (eksikHatasi) throw eksikHatasi;
			revalidatePath('/ptp/eksikler');
		}

		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.');
	}
}

/** Görevi atlandı olarak kaydeder. Sebep zorunlu — kısıt da zorluyor. */
export async function atlamaEkle(
	gorevId: string,
	tarih: string,
	sebep: string
): Promise<Sonuc> {
	try {
		const { kullanici, yonetici } = await yetkiDenetle('ptp', 'yazma');
		const temiz = sebep.trim();
		if (!temiz) return { tamam: false, mesaj: 'Atlama sebebi yazılmalı.' };

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { data: gorev } = await supabase
			.from('ptp_gorevler')
			.select('id, baslik, atanan_id')
			.eq('id', gorevId)
			.eq('firma_id', firmaId)
			.is('silindi', null)
			.maybeSingle();

		if (!gorev) return { tamam: false, mesaj: 'Görev bulunamadı.' };
		if (!yonetici && gorev.atanan_id && gorev.atanan_id !== kullanici.id) {
			return { tamam: false, mesaj: 'Bu görev başka bir kişiye atanmış.' };
		}

		const { error } = await supabase.from('ptp_kayitlar').insert({
			firma_id: firmaId,
			gorev_id: gorevId,
			tarih,
			yapan_id: kullanici.id,
			durum: 'atlandi',
			baslik_kopya: gorev.baslik,
			not_metni: temiz,
		});

		if (error) throw error;
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.');
	}
}

/** Yanlış girilen kaydı siler. Yalnızca yönetici. */
export async function kayitSil(kayitId: string): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('ptp_kayitlar')
			.delete()
			.eq('id', kayitId);
		if (error) throw error;
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}

/**
 * Görevin atamasını değiştirir. Yalnızca yönetici.
 * Atama kalıcı: her gün yeniden atamak gerekmiyor.
 */
export async function atamaDegistir(
	gorevIdleri: string[],
	kullaniciId: string | null
): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		if (gorevIdleri.length === 0) return { tamam: true, veri: undefined };

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_gorevler')
			.update({ atanan_id: kullaniciId })
			.in('id', gorevIdleri)
			.eq('firma_id', firmaId);

		if (error) throw error;
		revalidatePath('/ptp');
		revalidatePath('/ptp/gorevler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Atama yapılamadı. Tekrar deneyin.');
	}
}
