'use server';

import { hataya } from '@/lib/hata';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici, YetkisizHata } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { mesajGonder, telegramAyarli, webhookKur, WEBHOOK_GIZLI } from '@/lib/telegram';
import { olayTanimi } from '@/lib/bildirim/katalog';
import type { Sonuc } from '../../ptp/eylemler';

/* Bildirim ayarları — firma yöneticisi ve süperadmin. */

async function yoneticiDenetle() {
	const kullanici = await aktifKullanici();
	if (kullanici.rol === 'kullanici') {
		throw new YetkisizHata('Bildirim ayarları yöneticiye açıktır.');
	}
	return kullanici;
}


/** Bot bağlantısı: açık mı, hangi sohbete. */
export async function botKaydet(
	aktif: boolean,
	chatId: string
): Promise<Sonuc> {
	try {
		await yoneticiDenetle();

		const temiz = chatId.trim();
		if (aktif && !temiz) {
			return { tamam: false, mesaj: 'Sohbet kimliği (chat id) girilmeli.' };
		}
		if (temiz && !/^-?\d+$/.test(temiz)) {
			return {
				tamam: false,
				mesaj:
					'Sohbet kimliği yalnızca rakamlardan oluşur; grup sohbetlerinde başında eksi olabilir.',
			};
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase.from('telegram_ayarlari').upsert(
			{ firma_id: firmaId, aktif, chat_id: temiz || null },
			{ onConflict: 'firma_id' }
		);

		if (error) throw error;
		revalidatePath('/ayarlar/bildirimler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.', 'ayarlar/bildirimler');
	}
}

export type TercihGirdisi = {
	olay: string;
	acik: boolean;
	/** Zamanlı olaylarda 'SS:DD'; anlık olaylarda boş */
	saat: string;
};

/** Olay tercihlerini topluca yazar. */
export async function tercihleriKaydet(
	tercihler: TercihGirdisi[]
): Promise<Sonuc> {
	try {
		await yoneticiDenetle();

		for (const t of tercihler) {
			const tanim = olayTanimi(t.olay);
			if (!tanim) {
				return { tamam: false, mesaj: `Bilinmeyen olay: ${t.olay}` };
			}
			if (tanim.tur === 'zamanli' && !/^\d{2}:\d{2}$/.test(t.saat)) {
				return {
					tamam: false,
					mesaj: `${tanim.ad} için saat SS:DD biçiminde olmalı.`,
				};
			}
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase.from('bildirim_tercihleri').upsert(
			tercihler.map((t) => ({
				firma_id: firmaId,
				olay: t.olay,
				acik: t.acik,
				saat: olayTanimi(t.olay)?.tur === 'zamanli' ? t.saat : null,
			})),
			{ onConflict: 'firma_id,olay' }
		);

		if (error) throw error;
		revalidatePath('/ayarlar/bildirimler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Tercihler kaydedilemedi. Tekrar deneyin.', 'ayarlar/bildirimler');
	}
}

export async function testGonder(): Promise<Sonuc> {
	try {
		await yoneticiDenetle();

		if (!telegramAyarli()) {
			return {
				tamam: false,
				mesaj:
					'TELEGRAM_BOT_TOKEN tanımlı değil. Vercel ortam değişkenlerine ekleyip yeniden yayınlayın.',
			};
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { data } = await supabase
			.from('telegram_ayarlari')
			.select('chat_id')
			.eq('firma_id', firmaId)
			.maybeSingle();

		if (!data?.chat_id) {
			return { tamam: false, mesaj: 'Önce sohbet kimliğini kaydedin.' };
		}

		const oldu = await mesajGonder(
			data.chat_id,
			'🔔 Test — Karas Panel bağlantısı çalışıyor.'
		);

		return oldu
			? { tamam: true, veri: undefined }
			: {
					tamam: false,
					mesaj: 'Telegram kabul etmedi. Jeton ve sohbet kimliğini kontrol edin.',
				};
	} catch (e) {
		return hataya(e, 'Test gönderilemedi.', 'ayarlar/bildirimler');
	}
}

/**
 * Webhook adresini Telegram'a bildirir.
 *
 * Adres istekten okunuyor: panelin adresi ayrıca bir yere yazılmasın,
 * yanlış yazılırsa mesajlar sessizce kaybolur.
 */
export async function webhookAyarla(): Promise<Sonuc<string>> {
	try {
		await yoneticiDenetle();

		if (!WEBHOOK_GIZLI) {
			return {
				tamam: false,
				mesaj:
					'TELEGRAM_WEBHOOK_GIZLI tanımlı değil. Uzun ve rastgele bir değer üretip Vercel\'e ekleyin.',
			};
		}

		const basliklar = await headers();
		const host = basliklar.get('host');
		if (!host) return { tamam: false, mesaj: 'Adres çözülemedi.' };

		const adres = `https://${host}/api/telegram`;
		const sonuc = await webhookKur(adres);

		return sonuc.tamam
			? { tamam: true, veri: adres }
			: { tamam: false, mesaj: sonuc.mesaj };
	} catch (e) {
		return hataya(e, 'Webhook kurulamadı.', 'ayarlar/bildirimler');
	}
}
