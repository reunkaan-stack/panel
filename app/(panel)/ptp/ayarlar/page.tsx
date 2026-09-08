import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { telegramAyarli, WEBHOOK_GIZLI } from '@/lib/telegram';
import { TelegramAyarlari } from './bilesenler/TelegramAyarlari';

export const metadata: Metadata = { title: 'Ayarlar — Karas Panel' };
export const dynamic = 'force-dynamic';

type Ayar = {
	telegram_aktif: boolean;
	telegram_chat_id: string | null;
	telegram_gorev_bildir: boolean;
	gunluk_ozet_saati: string;
	kapanis_hatirlatma_saati: string;
};

export default async function AyarlarSayfasi() {
	await yetkiDenetle('ptp', 'yonetim');
	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const { data } = await supabase
		.from('ptp_ayarlar')
		.select(
			'telegram_aktif, telegram_chat_id, telegram_gorev_bildir, gunluk_ozet_saati, kapanis_hatirlatma_saati'
		)
		.eq('firma_id', firmaId)
		.maybeSingle();

	const a = (data ?? null) as Ayar | null;

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Ayarlar</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Telegram
			</h1>
			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Görev kapanışları, kapanış hatırlatması ve günlük özet Telegram&apos;a
				düşer. Bota yazdığınız mesajlar da bugüne görev olur.
			</p>

			<div className="mt-8">
				<TelegramAyarlari
					jetonVar={telegramAyarli()}
					gizliVar={WEBHOOK_GIZLI.length > 0}
					baslangic={{
						aktif: a?.telegram_aktif ?? false,
						chatId: a?.telegram_chat_id ?? '',
						gorevBildir: a?.telegram_gorev_bildir ?? true,
						ozetSaati: (a?.gunluk_ozet_saati ?? '22:00').slice(0, 5),
						hatirlatmaSaati: (a?.kapanis_hatirlatma_saati ?? '21:30').slice(0, 5),
					}}
				/>
			</div>
		</div>
	);
}
