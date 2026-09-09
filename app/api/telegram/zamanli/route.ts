import { NextResponse } from 'next/server';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { bugun } from '@/lib/ortak/tarih';
import { mesajGonder, telegramAyarli } from '@/lib/telegram';
import { ZAMANLI_ISLEYICILER } from '@/lib/bildirim/zamanli';
import { olayTanimi } from '@/lib/bildirim/katalog';

/* Zamanlı bildirim dağıtıcısı.

   Modüle özel hiçbir şey bilmiyor: açık olan zamanlı tercihleri okur,
   saati geldiyse ilgili işleyiciyi çağırır, dönen mesajı gönderir.
   Yeni modül eklendiğinde bu dosyaya dokunulmuyor — katalog ve
   işleyici yeterli.

   Supabase'in pg_cron'u beş dakikada bir çağırıyor. Vercel'in ücretsiz
   planında sık çalışan zamanlanmış iş yok.

   "Bugün gönderildi mi" bilgisi TABLODA. Sunucusuzda her çağrı yeni
   bir süreç; bellekte tutulsaydı damga kaybolur ve özet beş dakikada
   bir tekrar giderdi. */

export const dynamic = 'force-dynamic';

const GIZLI = process.env.CRON_GIZLI_ANAHTAR ?? '';

/** 'HH:MM' — İstanbul saatiyle şu an. */
function suan(): string {
	return new Date().toLocaleTimeString('tr-TR', {
		timeZone: 'Europe/Istanbul',
		hour: '2-digit',
		minute: '2-digit',
	});
}

type Tercih = {
	firma_id: string;
	olay: string;
	saat: string | null;
	son_gonderim: string | null;
};

export async function POST(istek: Request) {
	if (!GIZLI) {
		return NextResponse.json(
			{ hata: 'CRON_GIZLI_ANAHTAR tanımlı değil' },
			{ status: 503 }
		);
	}

	const gelen =
		istek.headers.get('x-cron-anahtar') ??
		new URL(istek.url).searchParams.get('anahtar');

	if (gelen !== GIZLI) {
		return NextResponse.json({ hata: 'yetkisiz' }, { status: 401 });
	}

	if (!telegramAyarli()) {
		return NextResponse.json({ atlandi: 'jeton yok' });
	}

	try {
		const supabase = yonetimIstemcisi();
		const gun = bugun();
		const saat = suan();

		/* Botu açık firmalar. Kapalıysa tercihlere hiç bakılmıyor. */
		const { data: botlar } = await supabase
			.from('telegram_ayarlari')
			.select('firma_id, chat_id')
			.eq('aktif', true)
			.not('chat_id', 'is', null);

		const sohbet = new Map(
			((botlar ?? []) as { firma_id: string; chat_id: string }[]).map((b) => [
				b.firma_id,
				b.chat_id,
			])
		);

		if (sohbet.size === 0) {
			return NextResponse.json({ saat, atlandi: 'açık bot yok' });
		}

		const { data } = await supabase
			.from('bildirim_tercihleri')
			.select('firma_id, olay, saat, son_gonderim')
			.eq('acik', true)
			.not('saat', 'is', null)
			.in('firma_id', [...sohbet.keys()]);

		const tercihler = (data ?? []) as Tercih[];
		const gonderilen: string[] = [];

		for (const t of tercihler) {
			const chatId = sohbet.get(t.firma_id);
			if (!chatId || !t.saat) continue;

			const tanim = olayTanimi(t.olay);
			const isleyici = ZAMANLI_ISLEYICILER[t.olay];
			if (!tanim || !isleyici) {
				/* Tabloda var, katalogda yok: kaldırılmış bir olay.
				   Sessizce geçmek yerine görünür olsun. */
				console.error('[zamanli] işleyicisi olmayan olay:', t.olay);
				continue;
			}

			/* Saat karşılaştırması "geçti mi" biçiminde: tetik tam
			   dakikayı ıskalarsa (ağ gecikmesi, cron kayması) mesaj hiç
			   gitmesin istemiyoruz. Damga tekrarı zaten engelliyor. */
			if (saat < t.saat.slice(0, 5)) continue;
			if (t.son_gonderim === gun) continue;

			const mesaj = await isleyici(t.firma_id, gun);

			/* Mesaj yoksa da damga basılıyor: gün içinde tekrar tekrar
			   hesaplanmasın. */
			if (mesaj) {
				const oldu = await mesajGonder(chatId, mesaj);
				if (!oldu) continue; // damga basma, sonraki turda tekrar dene
				gonderilen.push(t.olay);
			}

			await supabase
				.from('bildirim_tercihleri')
				.update({ son_gonderim: gun })
				.eq('firma_id', t.firma_id)
				.eq('olay', t.olay);
		}

		return NextResponse.json({
			saat,
			bakilan: tercihler.length,
			gonderilen,
		});
	} catch (e) {
		console.error('[telegram/zamanli]', e);
		return NextResponse.json({ hata: 'işlenemedi' }, { status: 500 });
	}
}
