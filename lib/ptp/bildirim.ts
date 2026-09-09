import 'server-only';
import { saatiBicimle } from '@/lib/ortak/tarih';
import { kacir } from '@/lib/telegram';
import { bildir } from '@/lib/bildirim';

/* PTP'nin anlık bildirimleri.

   Burada yalnızca MESAJ BİÇİMİ var. Gönderilip gönderilmeyeceğine
   lib/bildirim karar veriyor: bot açık mı, bu olay açık mı. Modül
   Telegram'ı bilmiyor, yalnızca "şu olay oldu" diyor.

   Hiçbiri hata fırlatmaz — bildirim asıl işi engellememeli. */

export async function gorevBildir(
	firmaId: string,
	baslik: string,
	kisiAdi: string,
	ayrinti?: string
): Promise<void> {
	let metin = `✅ <b>${kacir(baslik)}</b>\n`;
	metin += `${kacir(kisiAdi)} · ${saatiBicimle(new Date())}`;
	if (ayrinti) metin += `\n${kacir(ayrinti)}`;

	await bildir(firmaId, 'ptp.gorev_yapildi', metin);
}

export async function gunKapandiBildir(
	firmaId: string,
	kisiAdi: string,
	ayrinti: string
): Promise<void> {
	const metin =
		`🌙 <b>Gün kapatıldı</b>\n` +
		`${kacir(kisiAdi)} · ${saatiBicimle(new Date())}\n${kacir(ayrinti)}`;

	await bildir(firmaId, 'ptp.gun_kapandi', metin);
}

export async function eksikBildir(
	firmaId: string,
	urunler: string[],
	kisiAdi: string
): Promise<void> {
	if (urunler.length === 0) return;

	let metin = `🛒 <b>Eksik bildirildi</b> — ${kacir(kisiAdi)}\n`;
	for (const u of urunler) metin += `• ${kacir(u)}\n`;

	await bildir(firmaId, 'ptp.eksik_bildirildi', metin.trimEnd());
}
