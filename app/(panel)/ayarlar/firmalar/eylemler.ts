'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle, YetkisizHata } from '@/lib/yetki';
import type { Modul } from '@/lib/tipler';
import type { Sonuc } from '../../ptp/eylemler';

/* Firma yönetimi — yalnızca süperadmin.

   Firmalar şimdiye kadar elle SQL ile ekleniyordu. Yeni bir müşteri
   geldiğinde veri tabanına girmek gerekiyordu; ekran yoktu. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };
	console.error('[ayarlar/firmalar]', e);
	return { tamam: false, mesaj: varsayilan };
}

/* Kısa ad adres ve kod içinde geçiyor: küçük harf, Türkçe karakter
   yok, boşluk yok. Kullanıcının yazdığını düzeltiyoruz ki elle
   uğraşmasın. */
function kisaAdaCevir(metin: string): string {
	const harita: Record<string, string> = {
		ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u',
		Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
	};
	return metin
		.trim()
		.split('')
		.map((h) => harita[h] ?? h)
		.join('')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 20);
}

export async function firmaEkle(
	ad: string,
	kisaAd: string,
	moduller: Modul[]
): Promise<Sonuc<string>> {
	try {
		await superadminDenetle();

		const temizAd = ad.trim();
		if (!temizAd) return { tamam: false, mesaj: 'Firma adı yazılmalı.' };

		const kod = kisaAdaCevir(kisaAd || temizAd);
		if (kod.length < 2) {
			return {
				tamam: false,
				mesaj: 'Kısa ad en az iki harf olmalı (yalnızca harf ve rakam).',
			};
		}

		const supabase = await sunucuIstemcisi();

		const { data: mevcut } = await supabase
			.from('firmalar')
			.select('id')
			.eq('kisa_ad', kod)
			.maybeSingle();

		if (mevcut) {
			return { tamam: false, mesaj: `"${kod}" kısa adı zaten kullanılıyor.` };
		}

		const { data: firma, error } = await supabase
			.from('firmalar')
			.insert({ ad: temizAd, kisa_ad: kod, aktif: true })
			.select('id')
			.single();

		if (error) throw error;

		if (moduller.length > 0) {
			const { error: modulHatasi } = await supabase
				.from('firma_modulleri')
				.insert(
					moduller.map((m) => ({ firma_id: firma.id, modul: m, aktif: true }))
				);
			if (modulHatasi) throw modulHatasi;
		}

		revalidatePath('/ayarlar/firmalar');
		revalidatePath('/', 'layout');
		return { tamam: true, veri: firma.id };
	} catch (e) {
		return hataya(e, 'Firma eklenemedi. Tekrar deneyin.');
	}
}

export async function firmaGuncelle(
	firmaId: string,
	ad: string,
	aktif: boolean
): Promise<Sonuc> {
	try {
		await superadminDenetle();

		const temizAd = ad.trim();
		if (!temizAd) return { tamam: false, mesaj: 'Firma adı yazılmalı.' };

		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('firmalar')
			.update({ ad: temizAd, aktif })
			.eq('id', firmaId);

		if (error) throw error;

		revalidatePath('/ayarlar/firmalar');
		revalidatePath('/', 'layout');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Güncellenemedi. Tekrar deneyin.');
	}
}

/**
 * Firmanın modüllerini yazar.
 *
 * Kapatılan modül SİLİNMİYOR, `aktif = false` oluyor: firma sonradan
 * yeniden alırsa geçmiş ayarları (bildirim tercihleri, yetkiler)
 * yerinde duruyor.
 */
export async function modulleriKaydet(
	firmaId: string,
	acikOlanlar: Modul[]
): Promise<Sonuc> {
	try {
		await superadminDenetle();
		const supabase = await sunucuIstemcisi();

		const tumu: Modul[] = ['ptp', 'otp', 'ttp', 'mtp'];

		const { error } = await supabase.from('firma_modulleri').upsert(
			tumu.map((m) => ({
				firma_id: firmaId,
				modul: m,
				aktif: acikOlanlar.includes(m),
			})),
			{ onConflict: 'firma_id,modul' }
		);

		if (error) throw error;

		revalidatePath('/ayarlar/firmalar');
		revalidatePath('/', 'layout');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Modüller kaydedilemedi. Tekrar deneyin.');
	}
}
