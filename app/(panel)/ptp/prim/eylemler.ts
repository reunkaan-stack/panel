'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { paraCoz } from '@/lib/ortak/para';
import { ayGecerli } from '@/lib/ortak/tarih';
import type { Sonuc } from '../eylemler';

/* Prim ayarları — yalnızca yönetici.

   Ücret verisine dokunan her değişiklik denetim kaydına yazılıyor:
   maaş ve prim, sonradan "ne zaman ne kadardı" diye sorulacak
   alanlar. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	console.error('[ptp/prim]', e);
	return { tamam: false, mesaj: varsayilan };
}

/** Ayın hedefini yazar ya da günceller. */
export async function hedefKaydet(
	ay: string,
	tutarMetni: string,
	not: string
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yonetim');
		if (!ayGecerli(ay)) return { tamam: false, mesaj: 'Ay geçersiz.' };

		const hedef = paraCoz(tutarMetni);
		if (hedef === null) return { tamam: false, mesaj: 'Hedefi okuyamadım.' };
		if (hedef < 0) return { tamam: false, mesaj: 'Hedef eksi olamaz.' };

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase.from('ptp_hedefler').upsert(
			{ firma_id: firmaId, ay: `${ay}-01`, hedef, not_metni: not.trim() },
			{ onConflict: 'firma_id,ay' }
		);
		if (error) throw error;

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: kullanici.id,
			firma_id: firmaId,
			eylem: 'hedef_degistirildi',
			hedef_tablo: 'ptp_hedefler',
			ayrinti: { ay, hedef },
		});

		revalidatePath('/ptp/prim');
		revalidatePath('/ptp/ciro');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Hedef kaydedilemedi. Tekrar deneyin.');
	}
}

/**
 * Maaş yazar. Zam YENİ satır olarak eklenir; eski satır silinmez,
 * geçmiş ayların primi eski maaşla hesaplanmaya devam eder.
 */
export async function maasKaydet(
	kullaniciId: string,
	gecerliAy: string,
	tutarMetni: string
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yonetim');
		if (!ayGecerli(gecerliAy)) return { tamam: false, mesaj: 'Ay geçersiz.' };

		const tutar = paraCoz(tutarMetni);
		if (tutar === null) return { tamam: false, mesaj: 'Maaşı okuyamadım.' };
		if (tutar < 0) return { tamam: false, mesaj: 'Maaş eksi olamaz.' };

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase.from('ptp_maaslar').upsert(
			{
				firma_id: firmaId,
				kullanici_id: kullaniciId,
				gecerli_ay: `${gecerliAy}-01`,
				tutar,
			},
			{ onConflict: 'firma_id,kullanici_id,gecerli_ay' }
		);
		if (error) throw error;

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: kullanici.id,
			firma_id: firmaId,
			eylem: 'maas_yazildi',
			hedef_tablo: 'ptp_maaslar',
			hedef_id: kullaniciId,
			ayrinti: { gecerli_ay: gecerliAy, tutar },
		});

		revalidatePath('/ptp/prim');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Maaş kaydedilemedi. Tekrar deneyin.');
	}
}

export type KademeGirdisi = {
	id?: string;
	oran: number;
	tur: 'sabit' | 'maas_kati';
	deger: string;
};

/** Kademe ekler ya da günceller. */
export async function kademeKaydet(girdi: KademeGirdisi): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');

		if (!Number.isInteger(girdi.oran) || girdi.oran <= 0 || girdi.oran > 1000) {
			return { tamam: false, mesaj: 'Oran 1 ile 1000 arasında olmalı.' };
		}

		const sayi = paraCoz(girdi.deger);
		if (sayi === null || sayi < 0) {
			return { tamam: false, mesaj: 'Değeri okuyamadım.' };
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		/* Kısıt gereği ikisinden yalnızca biri dolu olabilir. */
		const satir = {
			firma_id: firmaId,
			oran: girdi.oran,
			tur: girdi.tur,
			tutar: girdi.tur === 'sabit' ? sayi : null,
			kat: girdi.tur === 'maas_kati' ? sayi : null,
		};

		const { error } = girdi.id
			? await supabase.from('ptp_prim_kademeleri').update(satir).eq('id', girdi.id)
			: await supabase
					.from('ptp_prim_kademeleri')
					.upsert(satir, { onConflict: 'firma_id,oran' });

		if (error) throw error;

		revalidatePath('/ptp/prim');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kademe kaydedilemedi. Tekrar deneyin.');
	}
}

export async function kademeSil(kademeId: string): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_prim_kademeleri')
			.delete()
			.eq('id', kademeId)
			.eq('firma_id', firmaId);

		if (error) throw error;
		revalidatePath('/ptp/prim');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}

/**
 * KDV oranını ve varsayılan hedefi yazar.
 *
 * Oran değişikliği GEÇMİŞE dokunmaz: her ciro satırı kendi oranını
 * taşıyor, yalnızca bundan sonra girilecek satırlar etkilenir.
 */
export async function ayarKaydet(
	kdvMetni: string,
	varsayilanMetni: string
): Promise<Sonuc> {
	try {
		const { kullanici } = await yetkiDenetle('ptp', 'yonetim');

		const kdv = paraCoz(kdvMetni);
		if (kdv === null || kdv < 0 || kdv >= 100) {
			return { tamam: false, mesaj: 'KDV oranı 0 ile 100 arasında olmalı.' };
		}

		const varsayilan = paraCoz(varsayilanMetni);
		if (varsayilan === null || varsayilan < 0) {
			return { tamam: false, mesaj: 'Varsayılan hedefi okuyamadım.' };
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase.from('ptp_ayarlar').upsert(
			{ firma_id: firmaId, kdv_orani: kdv, varsayilan_hedef: varsayilan },
			{ onConflict: 'firma_id' }
		);
		if (error) throw error;

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: kullanici.id,
			firma_id: firmaId,
			eylem: 'ptp_ayari_degistirildi',
			hedef_tablo: 'ptp_ayarlar',
			ayrinti: { kdv_orani: kdv, varsayilan_hedef: varsayilan },
		});

		revalidatePath('/ptp/prim');
		revalidatePath('/ptp/ciro');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Ayar kaydedilemedi. Tekrar deneyin.');
	}
}
