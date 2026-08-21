'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import type {
	EksikKategori,
	GorevGrubu,
	GorevTuru,
	Tekrar,
} from '@/lib/tipler';
import type { Sonuc } from '../eylemler';

/* Görev şablonu yönetimi — yalnızca yönetici.

   Şablon, günlük görevlerin kalıbıdır. Her sabah bunlardan o güne ait
   görevler üretilir. Bkz. CLAUDE.md → PTP nasıl çalışır. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	console.error('[ptp/gorevler]', e);
	return { tamam: false, mesaj: varsayilan };
}

export type GorevGirdisi = {
	id?: string;
	baslik: string;
	tur: GorevTuru;
	grup: GorevGrubu;
	zorunlu: boolean;
	tekrarlanabilir: boolean;
	fotograf_ister: boolean;
	ipucu: string;
	tekrar: Tekrar;
	tekrar_gunleri: number[];
	tek_tarih: string | null;
	sira: number;
	atanan_id: string | null;
	eksik_kategori: EksikKategori | null;
	/** Yalnızca tur = 'kontrol' iken kullanılır */
	maddeler: string[];
};

function dogrula(g: GorevGirdisi): string | null {
	if (!g.baslik.trim()) return 'Görev başlığı yazılmalı.';
	if (g.baslik.length > 200) return 'Başlık çok uzun.';
	if (g.tekrar === 'haftalik' && g.tekrar_gunleri.length === 0) {
		return 'Haftalık görevde en az bir gün seçilmeli.';
	}
	if (g.tekrar !== 'haftalik' && g.tekrar_gunleri.length > 0) {
		return 'Gün seçimi yalnızca haftalık görevlerde kullanılır.';
	}
	if (g.tekrar === 'tek_seferlik' && !g.tek_tarih) {
		return 'Tek seferlik görevde tarih seçilmeli.';
	}
	if (g.tur === 'eksik' && !g.eksik_kategori) {
		return 'Eksik görevinde hangi listeye yazacağı seçilmeli.';
	}
	if (g.tur === 'kontrol') {
		const dolu = g.maddeler.filter((m) => m.trim());
		if (dolu.length === 0) return 'Kontrol listesinde en az bir madde olmalı.';
	}
	return null;
}

/** Şablonun kontrol maddelerini kaydeder: eskiler silinir, yeniler yazılır. */
async function maddeleriYaz(
	gorevId: string,
	firmaId: string,
	maddeler: string[]
) {
	const supabase = await sunucuIstemcisi();
	await supabase.from('ptp_gorev_maddeleri').delete().eq('gorev_id', gorevId);

	const temiz = maddeler.map((m) => m.trim()).filter(Boolean);
	if (temiz.length === 0) return;

	const { error } = await supabase.from('ptp_gorev_maddeleri').insert(
		temiz.map((metin, i) => ({
			firma_id: firmaId,
			gorev_id: gorevId,
			metin,
			sira: i,
		}))
	);
	if (error) throw error;
}

export async function gorevKaydet(girdi: GorevGirdisi): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const hata = dogrula(girdi);
		if (hata) return { tamam: false, mesaj: hata };

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const alanlar = {
			firma_id: firmaId,
			baslik: girdi.baslik.trim(),
			tur: girdi.tur,
			grup: girdi.grup,
			zorunlu: girdi.zorunlu,
			tekrarlanabilir: girdi.tekrarlanabilir,
			fotograf_ister: girdi.fotograf_ister,
			ipucu: girdi.ipucu.trim(),
			tekrar: girdi.tekrar,
			tekrar_gunleri: girdi.tekrar === 'haftalik' ? girdi.tekrar_gunleri : [],
			tek_tarih: girdi.tekrar === 'tek_seferlik' ? girdi.tek_tarih : null,
			sira: girdi.sira,
			atanan_id: girdi.atanan_id,
			/* Yalnızca eksik görevinde anlamlı; kısıt da bunu zorluyor */
			eksik_kategori: girdi.tur === 'eksik' ? (girdi.eksik_kategori ?? 'urun') : null,
		};

		let gorevId = girdi.id;

		if (gorevId) {
			const { error } = await supabase
				.from('ptp_gorevler')
				.update(alanlar)
				.eq('id', gorevId);
			if (error) throw error;
		} else {
			const { data, error } = await supabase
				.from('ptp_gorevler')
				.insert(alanlar)
				.select('id')
				.single();
			/* Benzersizlik kısıtı: aynı grup + aynı başlık iki kez olamaz */
			if (error?.code === '23505') {
				return {
					tamam: false,
					mesaj: 'Bu grupta aynı başlıkla bir görev zaten var.',
				};
			}
			if (error) throw error;
			gorevId = data.id;
		}

		await maddeleriYaz(gorevId!, firmaId, girdi.tur === 'kontrol' ? girdi.maddeler : []);

		revalidatePath('/ptp/gorevler');
		revalidatePath('/ptp');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Görev kaydedilemedi. Tekrar deneyin.');
	}
}

/**
 * Şablonu pasife alır ya da geri açar.
 * Silmiyoruz: geçmiş görevler bu şablona bağlı ve "hangi görevdi"
 * bilgisi kaybolmamalı.
 */
export async function gorevAktiflik(
	gorevId: string,
	aktif: boolean
): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('ptp_gorevler')
			.update({ aktif })
			.eq('id', gorevId);
		if (error) throw error;
		revalidatePath('/ptp/gorevler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Değiştirilemedi. Tekrar deneyin.');
	}
}

/** Şablonu yumuşak siler. Geçmiş görevler etkilenmez. */
export async function gorevSil(gorevId: string): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');
		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('ptp_gorevler')
			.update({ silindi: new Date().toISOString(), aktif: false })
			.eq('id', gorevId);
		if (error) throw error;
		revalidatePath('/ptp/gorevler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}
