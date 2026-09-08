import 'server-only';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { saatiBicimle } from '@/lib/ortak/tarih';
import { kacir, mesajGonder, telegramAyarli } from '@/lib/telegram';

/* Anlık görev bildirimi.

   ASLA HATA FIRLATMAZ. Bildirim asıl işi engellememeli: görev
   kaydedildi ama Telegram ulaşılamadı diye kayıt geri alınmamalı.
   Sorun günlüğe yazılıp geçiliyor.

   Beklemeden dönmüyoruz (fire-and-forget değil): sunucusuz ortamda
   yanıt döndükten sonra süreç dondurulabiliyor ve bekleyen istek
   yarıda kalıyor. Birkaç yüz milisaniye, kaybolan bildirimden iyidir. */

export async function gorevBildir(
	firmaId: string,
	baslik: string,
	kisiAdi: string,
	ayrinti?: string
): Promise<void> {
	try {
		if (!telegramAyarli()) return;

		const supabase = yonetimIstemcisi();
		const { data: ayar } = await supabase
			.from('ptp_ayarlar')
			.select('telegram_aktif, telegram_chat_id, telegram_gorev_bildir')
			.eq('firma_id', firmaId)
			.maybeSingle();

		if (
			!ayar?.telegram_aktif ||
			!ayar.telegram_chat_id ||
			!ayar.telegram_gorev_bildir
		) {
			return;
		}

		let metin = `✅ <b>${kacir(baslik)}</b>\n`;
		metin += `${kacir(kisiAdi)} · ${saatiBicimle(new Date())}`;
		if (ayrinti) metin += `\n${kacir(ayrinti)}`;

		await mesajGonder(ayar.telegram_chat_id, metin);
	} catch (e) {
		console.error('[bildirim] gönderilemedi', e);
	}
}

/** Eksik bildirimi — tedarik edilecek bir şey eklendiğinde. */
export async function eksikBildir(
	firmaId: string,
	urunler: string[],
	kisiAdi: string
): Promise<void> {
	try {
		if (!telegramAyarli() || urunler.length === 0) return;

		const supabase = yonetimIstemcisi();
		const { data: ayar } = await supabase
			.from('ptp_ayarlar')
			.select('telegram_aktif, telegram_chat_id')
			.eq('firma_id', firmaId)
			.maybeSingle();

		if (!ayar?.telegram_aktif || !ayar.telegram_chat_id) return;

		/* Eksik bildirimi `telegram_gorev_bildir` ayarına bakmıyor:
		   görev kapanışı gürültü olabilir ama "şu ürün bitti" her
		   zaman duyulmak istenen bir şey. */
		let metin = `🛒 <b>Eksik bildirildi</b> — ${kacir(kisiAdi)}\n`;
		for (const u of urunler) metin += `• ${kacir(u)}\n`;

		await mesajGonder(ayar.telegram_chat_id, metin.trimEnd());
	} catch (e) {
		console.error('[bildirim] eksik gönderilemedi', e);
	}
}
