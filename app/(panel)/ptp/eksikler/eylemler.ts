'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import type { EksikKategori } from '@/lib/tipler';
import type { Sonuc } from '../eylemler';

/* Eksik listesi eylemleri.

   Personel eksik bildirir; yönetici giderdikçe kapatır.
   Kural: her eylemin ilk satırı yetkiDenetle(). */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	console.error('[ptp/eksikler]', e);
	return { tamam: false, mesaj: varsayilan };
}

/** Yeni eksik bildirir. Personel de yapabilir. */
export async function eksikBildir(
	metin: string,
	aciklama: string,
	acil: boolean,
	kategori: EksikKategori = 'urun'
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yazma');
		const temiz = metin.trim();
		if (!temiz) return { tamam: false, mesaj: 'Ne eksik olduğunu yazın.' };
		if (temiz.length > 200) {
			return { tamam: false, mesaj: 'Başlık çok uzun; kısaca yazıp ayrıntıyı açıklamaya ekleyin.' };
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase.from('ptp_eksikler').insert({
			firma_id: firmaId,
			metin: temiz,
			aciklama: aciklama.trim(),
			acil,
			kategori,
			bildiren_id: kullanici.id,
		});

		if (error) throw error;
		revalidatePath('/ptp/eksikler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Eksik kaydedilemedi. Tekrar deneyin.');
	}
}

/**
 * Eksiği kapatır (giderildi ya da iptal). Yalnızca yönetici.
 * Yöneticinin kendini kontrol etmesi için kim kapattı ve ne zaman
 * kapattığı kaydediliyor.
 */
export async function eksikKapat(
	eksikId: string,
	durum: 'giderildi' | 'iptal',
	not: string
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yonetim');
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_eksikler')
			.update({
				durum,
				kapatan_id: kullanici.id,
				kapanma_zamani: new Date().toISOString(),
				kapanma_notu: not.trim(),
			})
			.eq('id', eksikId)
			.is('silindi', null);

		if (error) throw error;
		revalidatePath('/ptp/eksikler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.');
	}
}

/** Kapatılmış bir eksiği yeniden açar — yanlış işaretlenmişse. */
export async function eksikGeriAl(eksikId: string): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_eksikler')
			.update({
				durum: 'bekliyor',
				kapatan_id: null,
				kapanma_zamani: null,
				kapanma_notu: '',
			})
			.eq('id', eksikId)
			.is('silindi', null);

		if (error) throw error;
		revalidatePath('/ptp/eksikler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Geri alınamadı. Tekrar deneyin.');
	}
}
