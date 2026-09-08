import { NextResponse } from 'next/server';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { bugun } from '@/lib/ortak/tarih';
import { anlikDurum, gunlukOzet } from '@/lib/ptp/ozet';
import { kacir, mesajGonder, telegramAyarli, WEBHOOK_GIZLI } from '@/lib/telegram';

/* Telegram webhook — Telegram bu adrese mesaj gönderiyor.

   Yerel program getUpdates ile sürekli döngüde bekliyordu; sunucusuz
   ortamda sürekli çalışan süreç yok, Telegram bize geliyor.

   KİMLİK DENETİMİ İKİ KATMAN:
   1. Telegram'ın gönderdiği gizli başlık (setWebhook ile tanımlandı) —
      adresi bilen ama anahtarı bilmeyen kimse yazamaz
   2. Gelen chat_id ayarlardaki chat_id ile eşleşmeli — bot başkasına
      da eklense o kişi görev ekleyemez

   Yönetim istemcisi kullanılıyor: ortada oturum yok. Firma kimliği
   çağırandan değil, chat_id eşleşmesinden geliyor. */

export const dynamic = 'force-dynamic';

/* Telegram yanıt beklemez ama hata kodu görürse tekrar dener; her
   durumda 200 dönüyoruz ki aynı mesaj sonsuz tekrar etmesin. */
const TAMAM = NextResponse.json({ ok: true });

type Mesaj = {
	message?: {
		text?: string;
		chat?: { id?: number | string };
		from?: { first_name?: string };
	};
};

export async function POST(istek: Request) {
	try {
		if (!telegramAyarli() || !WEBHOOK_GIZLI) return TAMAM;

		const gizli = istek.headers.get('x-telegram-bot-api-secret-token');
		if (gizli !== WEBHOOK_GIZLI) {
			/* Adresi bilen ama anahtarı bilmeyen biri. Sessizce reddet. */
			return NextResponse.json({ ok: false }, { status: 401 });
		}

		const govde = (await istek.json()) as Mesaj;
		const metin = govde.message?.text?.trim();
		const chatId = String(govde.message?.chat?.id ?? '');
		if (!metin || !chatId) return TAMAM;

		const supabase = yonetimIstemcisi();

		const { data: ayar } = await supabase
			.from('ptp_ayarlar')
			.select('firma_id, telegram_aktif')
			.eq('telegram_chat_id', chatId)
			.maybeSingle();

		if (!ayar || !ayar.telegram_aktif) {
			/* Tanımsız sohbet: ne olduğunu söyleyip bırak. Görev
			   eklemesine izin verilmiyor. */
			await mesajGonder(
				chatId,
				'Bu sohbet bir firmaya bağlı değil. Panelden Telegram ayarlarını kontrol edin.'
			);
			return TAMAM;
		}

		const firmaId = ayar.firma_id as string;
		const gun = bugun();
		const komut = metin.toLowerCase();

		if (komut === '/ozet' || komut === '/özet') {
			await mesajGonder(chatId, await gunlukOzet(firmaId, gun));
			return TAMAM;
		}

		if (komut === '/durum') {
			await mesajGonder(chatId, await anlikDurum(firmaId, gun));
			return TAMAM;
		}

		if (komut === '/yardim' || komut === '/start' || komut === '/help') {
			await mesajGonder(
				chatId,
				'<b>Komutlar</b>\n' +
					'/durum — bugün ne yapıldı\n' +
					'/ozet — günlük özet\n\n' +
					'Başka ne yazarsanız <b>bugüne görev</b> olarak eklenir.'
			);
			return TAMAM;
		}

		/* Komut değilse bugüne görev olur — yerel programın davranışı
		   buydu ve en çok kullanılan özelliği. */
		if (komut.startsWith('/')) {
			await mesajGonder(chatId, 'Bilinmeyen komut. /yardim yazın.');
			return TAMAM;
		}

		const baslik = metin.slice(0, 200);

		const { error } = await supabase.from('ptp_gorevler').insert({
			firma_id: firmaId,
			baslik,
			tur: 'onay',
			grup: 'gunici',
			sira: 99,
			zorunlu: false,
			tekrarlanabilir: false,
			/* Tek seferlik ve bugüne: Telegram'dan gelen iş "şunu da
			   yap" demek, kalıcı bir görev tanımı değil. */
			tekrar: 'tek_seferlik',
			tek_tarih: gun,
			ipucu: 'Telegram üzerinden eklendi',
			aktif: true,
		});

		if (error) {
			console.error('[telegram/webhook] görev eklenemedi', error);
			await mesajGonder(
				chatId,
				'Görev eklenemedi. Aynı adla bir görev zaten olabilir.'
			);
			return TAMAM;
		}

		await supabase.from('denetim_kayitlari').insert({
			firma_id: firmaId,
			eylem: 'telegram_gorev_eklendi',
			hedef_tablo: 'ptp_gorevler',
			ayrinti: { baslik, chat_id: chatId },
		});

		await mesajGonder(
			chatId,
			`✅ Bugüne görev eklendi:\n<b>${kacir(baslik)}</b>`
		);
		return TAMAM;
	} catch (e) {
		console.error('[telegram/webhook]', e);
		return TAMAM;
	}
}
