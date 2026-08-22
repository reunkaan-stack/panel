'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { paraCoz } from '@/lib/ortak/para';
import type { Sonuc } from '../eylemler';

/* Ciro eylemleri — yalnızca yönetici.

   Personel ciroyu görev üzerinden girer ve giremediği/yanlış girdiği
   durumda değiştiremez. Düzeltme yöneticinin işi ve her düzeltme
   denetim kaydına düşer: para rakamının kim tarafından, ne zaman, ne
   yapıldığı sonradan sorulacak bir sorudur. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	console.error('[ptp/ciro]', e);
	return { tamam: false, mesaj: varsayilan };
}

export async function ciroKaydet(
	tarih: string,
	tutarMetni: string,
	fisMetni: string,
	not: string
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yonetim');

		if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) {
			return { tamam: false, mesaj: 'Tarih geçersiz.' };
		}

		const tutar = paraCoz(tutarMetni);
		if (tutar === null) return { tamam: false, mesaj: 'Tutarı okuyamadım.' };
		if (tutar < 0) return { tamam: false, mesaj: 'Ciro eksi olamaz.' };

		let fis: number | null = null;
		if (fisMetni.trim()) {
			const f = Number(fisMetni.replace(/\D/g, ''));
			if (!Number.isFinite(f)) {
				return { tamam: false, mesaj: 'Fiş sayısı sayı olmalı.' };
			}
			fis = f;
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { data: mevcut } = await supabase
			.from('ptp_cirolar')
			.select('id, tutar, fis_sayisi')
			.eq('firma_id', firmaId)
			.eq('tarih', tarih)
			.is('silindi', null)
			.maybeSingle();

		if (mevcut) {
			const { error } = await supabase
				.from('ptp_cirolar')
				.update({ tutar, fis_sayisi: fis, not_metni: not.trim() })
				.eq('id', mevcut.id);
			if (error) throw error;

			/* Eski değer denetim kaydında duruyor. Üzerine yazılan bir para
			   rakamının izi kalmasaydı, sonradan "burada 40 bin yazıyordu"
			   tartışmasını çözecek hiçbir kayıt olmazdı. */
			await supabase.from('denetim_kayitlari').insert({
				kullanici_id: kullanici.id,
				firma_id: firmaId,
				eylem: 'ciro_degistirildi',
				hedef_tablo: 'ptp_cirolar',
				hedef_id: mevcut.id,
				ayrinti: {
					tarih,
					eski_tutar: mevcut.tutar,
					yeni_tutar: tutar,
					eski_fis: mevcut.fis_sayisi,
					yeni_fis: fis,
				},
			});
		} else {
			const { error } = await supabase.from('ptp_cirolar').insert({
				firma_id: firmaId,
				tarih,
				tutar,
				fis_sayisi: fis,
				not_metni: not.trim(),
				giren_id: kullanici.id,
			});
			if (error) throw error;
		}

		revalidatePath('/ptp/ciro');
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.');
	}
}

/**
 * Ciroyu siler. Yumuşak silme: satır durur, `silindi` damgalanır.
 * Böylece hem gün yeniden girilebilir hem de yanlışlıkla silinen bir
 * rakam veri tabanından tamamen kaybolmaz.
 */
export async function ciroSil(ciroId: string): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yonetim');
		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_cirolar')
			.update({ silindi: new Date().toISOString() })
			.eq('id', ciroId)
			.eq('firma_id', firmaId);

		if (error) throw error;

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: kullanici.id,
			firma_id: firmaId,
			eylem: 'ciro_silindi',
			hedef_tablo: 'ptp_cirolar',
			hedef_id: ciroId,
		});

		revalidatePath('/ptp/ciro');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}
