'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import type { Sonuc } from '../eylemler';

/* Kroki düzenleme — yalnızca yönetici.

   Çizilen her dikdörtgen bir bölgedir; ayrı bir "kroki nesnesi"
   kavramı yok. Bölge silinince krokiden de gider. */

const EN = 1000;
const BOY = 600;

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	console.error('[ptp/kroki]', e);
	return { tamam: false, mesaj: varsayilan };
}

export type BolgeYerlesimi = {
	id: string;
	kroki_x: number;
	kroki_y: number;
	kroki_en: number;
	kroki_boy: number;
};

/** Koordinatı çizim alanının içinde tutar. */
function sinirla(y: BolgeYerlesimi): BolgeYerlesimi {
	const en = Math.max(40, Math.min(EN, Math.round(y.kroki_en)));
	const boy = Math.max(30, Math.min(BOY, Math.round(y.kroki_boy)));
	return {
		id: y.id,
		kroki_en: en,
		kroki_boy: boy,
		kroki_x: Math.max(0, Math.min(EN - en, Math.round(y.kroki_x))),
		kroki_y: Math.max(0, Math.min(BOY - boy, Math.round(y.kroki_y))),
	};
}

/**
 * Yeni bölge ekler ve krokiye yerleştirir.
 * Bölge listesi ile kroki aynı şey olduğu için tek işlem.
 */
export async function bolgeEkle(
	ad: string,
	yerlesim: Omit<BolgeYerlesimi, 'id'>
): Promise<Sonuc<string>> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const temiz = ad.trim();
		if (!temiz) return { tamam: false, mesaj: 'Bölge adı yazılmalı.' };

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();
		const s = sinirla({ id: '', ...yerlesim });

		const { data, error } = await supabase
			.from('ptp_bolumler')
			.insert({
				firma_id: firmaId,
				ad: temiz,
				kroki_x: s.kroki_x,
				kroki_y: s.kroki_y,
				kroki_en: s.kroki_en,
				kroki_boy: s.kroki_boy,
			})
			.select('id')
			.single();

		if (error?.code === '23505') {
			return { tamam: false, mesaj: 'Bu adla bir bölge zaten var.' };
		}
		if (error) throw error;

		revalidatePath('/ptp/kroki');
		return { tamam: true, veri: data.id };
	} catch (e) {
		return hataya(e, 'Bölge eklenemedi. Tekrar deneyin.');
	}
}

/** Sürükleme ve boyutlandırma sonrası konumları toplu kaydeder. */
export async function yerlesimKaydet(
	yerlesimler: BolgeYerlesimi[]
): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		if (yerlesimler.length === 0) return { tamam: true, veri: undefined };

		const supabase = await sunucuIstemcisi();

		/* Tek tek güncelleme, bölge sayısı kadar gidiş-dönüş demek.
		   Hepsi paralel gönderiliyor; sıra önemli değil. */
		const sonuclar = await Promise.all(
			yerlesimler.map((ham) => {
				const y = sinirla(ham);
				return supabase
					.from('ptp_bolumler')
					.update({
						kroki_x: y.kroki_x,
						kroki_y: y.kroki_y,
						kroki_en: y.kroki_en,
						kroki_boy: y.kroki_boy,
					})
					.eq('id', y.id);
			})
		);

		const hata = sonuclar.find((s) => s.error);
		if (hata?.error) throw hata.error;

		revalidatePath('/ptp/kroki');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Yerleşim kaydedilemedi. Tekrar deneyin.');
	}
}

export async function bolgeAdiDegistir(
	bolgeId: string,
	ad: string
): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const temiz = ad.trim();
		if (!temiz) return { tamam: false, mesaj: 'Bölge adı boş olamaz.' };

		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('ptp_bolumler')
			.update({ ad: temiz })
			.eq('id', bolgeId);

		if (error?.code === '23505') {
			return { tamam: false, mesaj: 'Bu adla bir bölge zaten var.' };
		}
		if (error) throw error;

		revalidatePath('/ptp/kroki');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Ad değiştirilemedi. Tekrar deneyin.');
	}
}

/**
 * Bölgeyi yumuşak siler.
 * Geçmiş görevlerde "hangi bölge seçilmişti" bilgisi kaybolmasın diye
 * gerçekten silinmiyor.
 */
export async function bolgeSil(bolgeId: string): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('ptp_bolumler')
			.update({ silindi: new Date().toISOString(), aktif: false })
			.eq('id', bolgeId);

		if (error) throw error;
		revalidatePath('/ptp/kroki');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}
