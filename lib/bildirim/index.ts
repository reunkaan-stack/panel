import 'server-only';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { mesajGonder, telegramAyarli } from '@/lib/telegram';
import { olayTanimi } from './katalog';

/* Bildirim gönderimi — panelin her modülü buradan geçer.

   TEK GİRİŞ NOKTASI: `bildir(firmaId, olay, mesaj)`. Modül ne
   Telegram'ı ne ayar tablosunu bilir; yalnızca "şu olay oldu, mesajı
   bu" der. İleride ikinci bir kanal (e-posta, WhatsApp) eklenirse
   modüllere dokunmadan buraya eklenir.

   ASLA HATA FIRLATMAZ. Bildirim asıl işi engellememeli: görev
   kaydedildi ama Telegram ulaşılamadı diye kayıt geri alınmamalı. */

export type BildirimDurumu = {
	aktif: boolean;
	chatId: string | null;
};

/** Firmanın bot bağlantısı. */
export async function telegramDurumu(
	firmaId: string
): Promise<BildirimDurumu> {
	try {
		const supabase = yonetimIstemcisi();
		const { data } = await supabase
			.from('telegram_ayarlari')
			.select('aktif, chat_id')
			.eq('firma_id', firmaId)
			.maybeSingle();

		return {
			aktif: !!data?.aktif && !!data.chat_id,
			chatId: data?.chat_id ?? null,
		};
	} catch {
		return { aktif: false, chatId: null };
	}
}

/**
 * Olay bildirimi gönderir.
 *
 * Üç kapı: jeton tanımlı mı, firmanın botu açık mı, bu olay açık mı.
 * Üçü de geçilirse mesaj gider.
 */
export async function bildir(
	firmaId: string,
	olay: string,
	mesaj: string
): Promise<void> {
	try {
		if (!telegramAyarli()) return;
		if (!olayTanimi(olay)) {
			/* Katalogda olmayan kod: yazım hatası. Sessizce yutmak
			   yerine görünür olsun — mesaj gitmiyor ve sebebi belli. */
			console.error('[bildirim] katalogda olmayan olay:', olay);
			return;
		}

		const durum = await telegramDurumu(firmaId);
		if (!durum.aktif || !durum.chatId) return;

		const supabase = yonetimIstemcisi();
		const { data: tercih } = await supabase
			.from('bildirim_tercihleri')
			.select('acik')
			.eq('firma_id', firmaId)
			.eq('olay', olay)
			.maybeSingle();

		/* Tercih satırı yoksa katalogdaki varsayılan geçerli: yeni
		   eklenen bir olay, ayarlar ekranına girilmeden de çalışsın. */
		const acik = tercih ? tercih.acik : (olayTanimi(olay)?.varsayilanAcik ?? false);
		if (!acik) return;

		await mesajGonder(durum.chatId, mesaj);
	} catch (e) {
		console.error('[bildirim] gönderilemedi', olay, e);
	}
}
