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
			.select('id, baslik, tur, atanan_id, tekrarlanabilir')
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

		const { error } = await supabase.from('ptp_kayitlar').insert({
			firma_id: firmaId,
			gorev_id: girdi.gorevId,
			tarih: girdi.tarih,
			yapan_id: kullanici.id,
			durum: 'yapildi',
			baslik_kopya: gorev.baslik,
			bolge_idler: girdi.bolgeIdler ?? [],
			madde_idler: girdi.maddeIdler ?? [],
			deger_metin: girdi.metin?.trim() || null,
			deger_sayi: girdi.sayi ?? null,
			not_metni: girdi.not?.trim() ?? '',
		});

		if (error) throw error;
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
