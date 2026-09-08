import { NextResponse } from 'next/server';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { bugun } from '@/lib/ortak/tarih';
import { gunlukOzet } from '@/lib/ptp/ozet';
import { mesajGonder, telegramAyarli } from '@/lib/telegram';

/* Zamanlanmış Telegram gönderimi.

   Supabase'in pg_cron'u bu adresi belirli aralıklarla çağırıyor.
   Vercel'in ücretsiz planında sık çalışan zamanlanmış iş yok, o
   yüzden tetik veri tabanı tarafında.

   "Bugün gönderildi mi" bilgisi TABLODA duruyor. Yerel programda
   bellekteydi; sunucusuzda her çağrı yeni bir süreç, bellekte hiçbir
   şey kalmıyor. Damga olmasa özet her tetikte tekrar giderdi. */

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

type Ayar = {
	firma_id: string;
	telegram_chat_id: string | null;
	gunluk_ozet_saati: string;
	kapanis_hatirlatma_saati: string;
	ozet_gonderilen_gun: string | null;
	hatirlatma_gonderilen_gun: string | null;
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

		const { data } = await supabase
			.from('ptp_ayarlar')
			.select(
				'firma_id, telegram_chat_id, gunluk_ozet_saati, kapanis_hatirlatma_saati, ozet_gonderilen_gun, hatirlatma_gonderilen_gun'
			)
			.eq('telegram_aktif', true)
			.not('telegram_chat_id', 'is', null);

		const ayarlar = (data ?? []) as Ayar[];
		const yapilan: string[] = [];

		for (const a of ayarlar) {
			const chatId = a.telegram_chat_id!;

			/* Saat karşılaştırması "geçti mi" biçiminde: tetik tam
			   dakikayı ıskalarsa (ağ gecikmesi, cron kayması) özet hiç
			   gitmesin istemiyoruz. Damga zaten tekrarı engelliyor. */
			const ozetSaati = a.gunluk_ozet_saati.slice(0, 5);
			if (saat >= ozetSaati && a.ozet_gonderilen_gun !== gun) {
				const gonderildi = await mesajGonder(
					chatId,
					await gunlukOzet(a.firma_id, gun)
				);
				if (gonderildi) {
					await supabase
						.from('ptp_ayarlar')
						.update({ ozet_gonderilen_gun: gun })
						.eq('firma_id', a.firma_id);
					yapilan.push(`ozet:${a.firma_id}`);
				}
			}

			const hatirlatmaSaati = a.kapanis_hatirlatma_saati.slice(0, 5);
			if (
				saat >= hatirlatmaSaati &&
				saat < ozetSaati &&
				a.hatirlatma_gonderilen_gun !== gun
			) {
				const { data: gorevler } = await supabase.rpc('ptp_gunun_gorevleri', {
					p_firma_id: a.firma_id,
					p_tarih: gun,
				});
				const { data: kayitlar } = await supabase
					.from('ptp_kayitlar')
					.select('gorev_id')
					.eq('firma_id', a.firma_id)
					.eq('tarih', gun);

				const kapali = new Set(
					((kayitlar ?? []) as { gorev_id: string }[]).map((k) => k.gorev_id)
				);
				const acik = ((gorevler ?? []) as { id: string }[]).filter(
					(g) => !kapali.has(g.id)
				).length;

				/* Her şey bitmişse hatırlatma göndermiyoruz: gereksiz
				   bildirim, bildirimlerin tümünü değersizleştirir. */
				if (acik > 0) {
					const gonderildi = await mesajGonder(
						chatId,
						`🔔 Kapanışa az kaldı — <b>${acik} görev</b> henüz kapatılmadı.`
					);
					if (gonderildi) {
						await supabase
							.from('ptp_ayarlar')
							.update({ hatirlatma_gonderilen_gun: gun })
							.eq('firma_id', a.firma_id);
						yapilan.push(`hatirlatma:${a.firma_id}`);
					}
				} else {
					/* Damgayı yine de bas: bu gün için tekrar bakılmasın. */
					await supabase
						.from('ptp_ayarlar')
						.update({ hatirlatma_gonderilen_gun: gun })
						.eq('firma_id', a.firma_id);
				}
			}
		}

		return NextResponse.json({ saat, firma: ayarlar.length, yapilan });
	} catch (e) {
		console.error('[telegram/zamanli]', e);
		return NextResponse.json({ hata: 'işlenemedi' }, { status: 500 });
	}
}
