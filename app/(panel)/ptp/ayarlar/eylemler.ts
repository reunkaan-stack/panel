'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { mesajGonder, telegramAyarli, webhookKur, WEBHOOK_GIZLI } from '@/lib/telegram';
import type { Sonuc } from '../eylemler';

/* Telegram ayarları — yalnızca yönetici. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	console.error('[ptp/ayarlar]', e);
	return { tamam: false, mesaj: varsayilan };
}

export type TelegramGirdisi = {
	aktif: boolean;
	chatId: string;
	gorevBildir: boolean;
	ozetSaati: string;
	hatirlatmaSaati: string;
};

export async function telegramKaydet(
	girdi: TelegramGirdisi
): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');

		const chatId = girdi.chatId.trim();
		if (girdi.aktif && !chatId) {
			return { tamam: false, mesaj: 'Sohbet kimliği (chat id) girilmeli.' };
		}
		if (chatId && !/^-?\d+$/.test(chatId)) {
			return {
				tamam: false,
				mesaj: 'Sohbet kimliği yalnızca rakamlardan oluşur (grup sohbetlerinde başında eksi olabilir).',
			};
		}
		if (!/^\d{2}:\d{2}$/.test(girdi.ozetSaati)) {
			return { tamam: false, mesaj: 'Özet saati SS:DD biçiminde olmalı.' };
		}
		if (!/^\d{2}:\d{2}$/.test(girdi.hatirlatmaSaati)) {
			return { tamam: false, mesaj: 'Hatırlatma saati SS:DD biçiminde olmalı.' };
		}
		if (girdi.hatirlatmaSaati >= girdi.ozetSaati) {
			return {
				tamam: false,
				mesaj: 'Hatırlatma, özetten önce olmalı — yoksa hiç gönderilmez.',
			};
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('ptp_ayarlar')
			.upsert(
				{
					firma_id: firmaId,
					telegram_aktif: girdi.aktif,
					telegram_chat_id: chatId || null,
					telegram_gorev_bildir: girdi.gorevBildir,
					gunluk_ozet_saati: girdi.ozetSaati,
					kapanis_hatirlatma_saati: girdi.hatirlatmaSaati,
				},
				{ onConflict: 'firma_id' }
			);

		if (error) throw error;
		revalidatePath('/ptp/ayarlar');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Ayarlar kaydedilemedi. Tekrar deneyin.');
	}
}

/** Test mesajı — bağlantının gerçekten çalıştığını görmek için. */
export async function testGonder(): Promise<Sonuc> {
	try {
		await yetkiDenetle('ptp', 'yonetim');

		if (!telegramAyarli()) {
			return {
				tamam: false,
				mesaj: 'TELEGRAM_BOT_TOKEN tanımlı değil. Vercel ortam değişkenlerine ekleyip yeniden yayınlayın.',
			};
		}

		const firmaId = await islemFirmasi();
		const supabase = await sunucuIstemcisi();

		const { data: ayar } = await supabase
			.from('ptp_ayarlar')
			.select('telegram_chat_id')
			.eq('firma_id', firmaId)
			.maybeSingle();

		if (!ayar?.telegram_chat_id) {
			return { tamam: false, mesaj: 'Önce sohbet kimliğini kaydedin.' };
		}

		const gonderildi = await mesajGonder(
			ayar.telegram_chat_id,
			'🔔 Test — Karas Panel bağlantısı çalışıyor.'
		);

		return gonderildi
			? { tamam: true, veri: undefined }
			: {
					tamam: false,
					mesaj: 'Telegram kabul etmedi. Jeton ve sohbet kimliğini kontrol edin.',
				};
	} catch (e) {
		return hataya(e, 'Test gönderilemedi.');
	}
}

/**
 * Webhook'u Telegram'a bildirir.
 *
 * Adres istekten okunuyor: panelin adresi ayrıca bir yere yazılmasın,
 * yanlış yazılırsa mesajlar sessizce kaybolur.
 */
export async function webhookAyarla(): Promise<Sonuc<string>> {
	try {
		await yetkiDenetle('ptp', 'yonetim');

		if (!WEBHOOK_GIZLI) {
			return {
				tamam: false,
				mesaj: 'TELEGRAM_WEBHOOK_GIZLI tanımlı değil. Uzun ve rastgele bir değer üretip Vercel\'e ekleyin.',
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
		return hataya(e, 'Webhook kurulamadı.');
	}
}
