import 'server-only';

/* Telegram bağlantısı.

   Jeton yalnızca ortam değişkeninde. Veri tabanına yazılsaydı
   yedeklerde, günlüklerde ve ekran görüntülerinde dolaşırdı — yerel
   programda kaynak dosyanın içinde açık metin duruyordu ve dağıtılan
   kurulum paketine de girmişti.

   `server-only`: bu dosya bir istemci bileşenine sızarsa derleme hata
   verir. Jetonun tarayıcıya inmesi, botun ele geçmesi demek. */

const JETON = process.env.TELEGRAM_BOT_TOKEN ?? '';

/** Telegram'ın webhook çağrılarında göndereceği gizli başlık. */
export const WEBHOOK_GIZLI = process.env.TELEGRAM_WEBHOOK_GIZLI ?? '';

export function telegramAyarli(): boolean {
	return JETON.length > 0;
}

/**
 * Mesaj gönderir. Başarısız olursa HATA FIRLATMAZ, false döner.
 *
 * Bildirim asıl işi engellememeli: görev kaydedildi ama Telegram
 * ulaşılamadı diye kayıt geri alınmamalı. Sorun günlüğe yazılıp
 * geçiliyor.
 */
export async function mesajGonder(
	chatId: string,
	metin: string
): Promise<boolean> {
	if (!telegramAyarli() || !chatId) return false;

	try {
		const yanit = await fetch(
			`https://api.telegram.org/bot${JETON}/sendMessage`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chat_id: chatId,
					text: metin,
					parse_mode: 'HTML',
					/* Bağlantı önizlemesi kapalı: özet mesajları uzun ve
					   önizleme ekranı gereksiz şişiriyor. */
					disable_web_page_preview: true,
				}),
			}
		);

		if (!yanit.ok) {
			console.error('[telegram] gönderilemedi', yanit.status, await yanit.text());
			return false;
		}
		return true;
	} catch (e) {
		console.error('[telegram] ağ hatası', e);
		return false;
	}
}

/**
 * Webhook adresini Telegram'a bildirir. Ayarlar ekranından bir kez
 * çağrılıyor; Telegram bundan sonra mesajları o adrese gönderiyor.
 */
export async function webhookKur(adres: string): Promise<{ tamam: boolean; mesaj: string }> {
	if (!telegramAyarli()) {
		return { tamam: false, mesaj: 'TELEGRAM_BOT_TOKEN tanımlı değil.' };
	}
	if (!WEBHOOK_GIZLI) {
		return { tamam: false, mesaj: 'TELEGRAM_WEBHOOK_GIZLI tanımlı değil.' };
	}

	try {
		const yanit = await fetch(`https://api.telegram.org/bot${JETON}/setWebhook`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url: adres,
				secret_token: WEBHOOK_GIZLI,
				/* Yalnızca mesajlar. Diğer olay türleri (düzenleme,
				   kanal gönderisi) bize lazım değil ve gereksiz çağrı. */
				allowed_updates: ['message'],
				drop_pending_updates: true,
			}),
		});

		const sonuc = (await yanit.json()) as { ok?: boolean; description?: string };
		return sonuc.ok
			? { tamam: true, mesaj: 'Webhook kuruldu.' }
			: { tamam: false, mesaj: sonuc.description ?? 'Telegram reddetti.' };
	} catch (e) {
		console.error('[telegram] webhook', e);
		return { tamam: false, mesaj: 'Telegram\'a ulaşılamadı.' };
	}
}

/** HTML kaçışı: mesaj metni parse_mode HTML ile gidiyor. */
export function kacir(metin: string): string {
	return metin
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
