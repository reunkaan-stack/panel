import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { telegramAyarli, WEBHOOK_GIZLI } from '@/lib/telegram';
import { BildirimAyarlari } from './bilesenler/BildirimAyarlari';

export const metadata: Metadata = { title: 'Bildirimler — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Bildirim ayarları — panel geneli.

   PTP'ye özel değil: her modül kendi olaylarını katalogda tanımlıyor,
   bu ekran listeyi oradan üretiyor. Yeni modül geldiğinde bu dosyaya
   dokunulmuyor. */

export default async function BildirimlerSayfasi() {
	const kullanici = await aktifKullanici();

	if (kullanici.rol === 'kullanici') {
		return (
			<div className="mx-auto max-w-2xl px-6 py-16">
				<span className="etiket text-uyari">Yetki yok</span>
				<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
					Bildirim ayarları
				</h1>
				<p className="mt-4 text-sm leading-relaxed text-metin-2">
					Bu sayfa firma yöneticisine ve süperadmine açıktır.
				</p>
			</div>
		);
	}

	let firmaId: string;
	try {
		firmaId = await islemFirmasi();
	} catch {
		return (
			<div className="mx-auto max-w-2xl px-6 py-16">
				<span className="etiket text-uyari">Firma seçilmedi</span>
				<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
					Hangi firma?
				</h1>
				<p className="mt-4 text-sm leading-relaxed text-metin-2">
					Bildirimler firma başına ayarlanıyor. Sayfanın sağ üstündeki firma
					kutusundan seçim yapın.
				</p>
			</div>
		);
	}

	const supabase = await sunucuIstemcisi();

	const [botSonuc, tercihSonuc, modulSonuc] = await Promise.all([
		supabase
			.from('telegram_ayarlari')
			.select('aktif, chat_id')
			.eq('firma_id', firmaId)
			.maybeSingle(),
		supabase
			.from('bildirim_tercihleri')
			.select('olay, acik, saat')
			.eq('firma_id', firmaId),
		supabase
			.from('firma_modulleri')
			.select('modul')
			.eq('firma_id', firmaId)
			.eq('aktif', true),
	]);

	const bot = botSonuc.data as { aktif: boolean; chat_id: string | null } | null;

	const tercihler = Object.fromEntries(
		((tercihSonuc.data ?? []) as {
			olay: string;
			acik: boolean;
			saat: string | null;
		}[]).map((t) => [
			t.olay,
			{ acik: t.acik, saat: (t.saat ?? '').slice(0, 5) },
		])
	);

	const acikModuller = ((modulSonuc.data ?? []) as { modul: string }[]).map(
		(m) => m.modul
	);

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link href="/" className="etiket text-metin-3 hover:text-metin">
				← Panel
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Ayarlar</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Bildirimler
			</h1>
			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Panelin bütün modülleri bildirimlerini buradan gönderiyor. Hangi olayda
				haber verileceğini ve zamanlı olanların saatini burada belirlersiniz.
			</p>

			<div className="mt-8">
				<BildirimAyarlari
					jetonVar={telegramAyarli()}
					gizliVar={WEBHOOK_GIZLI.length > 0}
					bot={{ aktif: bot?.aktif ?? false, chatId: bot?.chat_id ?? '' }}
					tercihler={tercihler}
					acikModuller={acikModuller}
				/>
			</div>
		</div>
	);
}
