'use client';

import { useState, useTransition } from 'react';
import { KATALOG, type OlayTanimi } from '@/lib/bildirim/katalog';
import {
	botKaydet,
	tercihleriKaydet,
	testGonder,
	webhookAyarla,
	type TercihGirdisi,
} from '../eylemler';

/* Bildirim ayarları.

   Olay listesi katalogdan üretiliyor. Yeni modül eklendiğinde bu
   dosyaya dokunulmuyor: katalogdaki grup burada kendiliğinden
   görünüyor. */

export function BildirimAyarlari({
	jetonVar,
	gizliVar,
	bot,
	tercihler,
	acikModuller,
}: {
	jetonVar: boolean;
	gizliVar: boolean;
	bot: { aktif: boolean; chatId: string };
	tercihler: Record<string, { acik: boolean; saat: string }>;
	/** Firmanın aldığı modüller — almadığı modülün olayları gizleniyor */
	acikModuller: string[];
}) {
	const [botAlan, setBotAlan] = useState(bot);
	const [tercih, setTercih] = useState(tercihler);
	const [durum, setDurum] = useState<{ iyi: boolean; metin: string } | null>(
		null
	);
	const [bekliyor, basla] = useTransition();

	function calistir(
		is: () => Promise<{ tamam: boolean; mesaj?: string }>,
		basarili: string
	) {
		setDurum(null);
		basla(async () => {
			const s = await is();
			setDurum({
				iyi: s.tamam,
				metin: s.tamam ? basarili : (s.mesaj ?? 'Olmadı'),
			});
		});
	}

	function olayYaz(kod: string, deger: Partial<{ acik: boolean; saat: string }>) {
		setTercih((t) => ({ ...t, [kod]: { ...t[kod], ...deger } }));
	}

	/* Sistem olayları her zaman görünür; modül olayları yalnızca o
	   modül firmada açıksa. Kapalı modülün ayarını göstermek, çalışmayan
	   bir düğme koymak olurdu. */
	const gruplar = KATALOG.filter(
		(g) => g.modul === 'sistem' || acikModuller.includes(g.modul)
	);

	return (
		<>
			{/* ---- Bağlantı ---- */}
			<section className="border border-kenarlik p-4">
				<span className="etiket">Telegram bağlantısı</span>

				<ul className="mt-3 space-y-2 text-sm">
					<Kontrol
						tamam={jetonVar}
						ad="Bot jetonu"
						eksik="TELEGRAM_BOT_TOKEN Vercel'e eklenmeli"
					/>
					<Kontrol
						tamam={gizliVar}
						ad="Webhook gizli anahtarı"
						eksik="TELEGRAM_WEBHOOK_GIZLI Vercel'e eklenmeli"
					/>
					<Kontrol
						tamam={!!botAlan.chatId}
						ad="Sohbet kimliği"
						eksik="aşağıya girilmeli"
					/>
				</ul>

				<label className="mt-5 flex cursor-pointer items-start gap-3">
					<input
						type="checkbox"
						checked={botAlan.aktif}
						onChange={(e) =>
							setBotAlan((b) => ({ ...b, aktif: e.target.checked }))
						}
						className="onay mt-0.5 shrink-0"
					/>
					<span className="text-sm">
						<strong>Telegram açık</strong>
						<span className="block text-metin-2">
							Kapalıyken hiçbir bildirim gitmez ve bota yazılan mesajlar
							işlenmez.
						</span>
					</span>
				</label>

				<label className="mt-4 block">
					<span className="etiket">Sohbet kimliği (chat id)</span>
					<input
						type="text"
						inputMode="numeric"
						value={botAlan.chatId}
						onChange={(e) =>
							setBotAlan((b) => ({ ...b, chatId: e.target.value }))
						}
						placeholder="1690340527"
						className="alan mt-2 font-mono"
					/>
				</label>

				<div className="mt-4 flex flex-wrap gap-3">
					<button
						type="button"
						disabled={bekliyor}
						onClick={() =>
							calistir(
								() => botKaydet(botAlan.aktif, botAlan.chatId),
								'Bağlantı kaydedildi.'
							)
						}
						className="dugme dugme-dolu"
					>
						Kaydet
					</button>
					<button
						type="button"
						disabled={bekliyor || !jetonVar}
						onClick={() => calistir(testGonder, 'Test mesajı gönderildi.')}
						className="dugme dugme-bos"
					>
						Test mesajı
					</button>
					<button
						type="button"
						disabled={bekliyor || !jetonVar || !gizliVar}
						onClick={() =>
							calistir(
								webhookAyarla,
								'Webhook kuruldu. Bota mesaj yazıp deneyin.'
							)
						}
						className="dugme dugme-bos"
					>
						Webhook&apos;u kur
					</button>
				</div>

				<p className="mt-3 text-sm leading-relaxed text-metin-3">
					Bota yazdığınız her mesaj <strong>Personel Takip&apos;te bugüne
					görev</strong> olarak eklenir. <code className="font-mono">/durum</code>{' '}
					ve <code className="font-mono">/ozet</code> komutları da çalışır.
				</p>
			</section>

			{/* ---- Olaylar ---- */}
			{gruplar.map((grup) => (
				<section key={grup.modul} className="mt-6 border border-kenarlik p-4">
					<span className="etiket text-vurgu-metin">{grup.ad}</span>

					<ul className="mt-4 space-y-5">
						{grup.olaylar.map((olay) => (
							<Olay
								key={olay.kod}
								olay={olay}
								acik={tercih[olay.kod]?.acik ?? olay.varsayilanAcik}
								saat={
									tercih[olay.kod]?.saat ?? olay.varsayilanSaat ?? '09:00'
								}
								degistir={(d) => olayYaz(olay.kod, d)}
							/>
						))}
					</ul>
				</section>
			))}

			{durum && (
				<p
					role="status"
					className={`mt-6 text-sm ${durum.iyi ? 'text-basarili' : 'text-hata'}`}
				>
					{durum.metin}
				</p>
			)}

			<div className="mt-6">
				<button
					type="button"
					disabled={bekliyor}
					onClick={() => {
						const girdi: TercihGirdisi[] = KATALOG.flatMap((g) =>
							g.olaylar.map((o) => ({
								olay: o.kod,
								acik: tercih[o.kod]?.acik ?? o.varsayilanAcik,
								saat: tercih[o.kod]?.saat ?? o.varsayilanSaat ?? '',
							}))
						);
						calistir(() => tercihleriKaydet(girdi), 'Bildirimler kaydedildi.');
					}}
					className="dugme dugme-dolu"
				>
					{bekliyor ? 'Kaydediliyor…' : 'Bildirimleri kaydet'}
				</button>
			</div>
		</>
	);
}

function Olay({
	olay,
	acik,
	saat,
	degistir,
}: {
	olay: OlayTanimi;
	acik: boolean;
	saat: string;
	degistir: (d: Partial<{ acik: boolean; saat: string }>) => void;
}) {
	return (
		<li className="border-b border-kenarlik-2 pb-5 last:border-b-0 last:pb-0">
			<label className="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					checked={acik}
					onChange={(e) => degistir({ acik: e.target.checked })}
					className="onay mt-0.5 shrink-0"
				/>
				<span className="min-w-0 flex-1 text-sm">
					<strong>{olay.ad}</strong>
					<span className="block leading-relaxed text-metin-2">
						{olay.aciklama}
					</span>
				</span>
			</label>

			{olay.tur === 'zamanli' && (
				<label className="mt-3 ml-8 flex items-center gap-3">
					<span className="etiket">Saat</span>
					<input
						type="time"
						value={saat}
						disabled={!acik}
						onChange={(e) => degistir({ saat: e.target.value })}
						className="alan w-32 disabled:opacity-50"
					/>
				</label>
			)}
		</li>
	);
}

function Kontrol({
	tamam,
	ad,
	eksik,
}: {
	tamam: boolean;
	ad: string;
	eksik: string;
}) {
	return (
		<li className="flex items-baseline gap-3">
			<span
				className={`font-mono text-xs ${tamam ? 'text-basarili' : 'text-uyari'}`}
				aria-hidden="true"
			>
				{tamam ? '✓' : '✕'}
			</span>
			<span>
				{ad}
				{!tamam && <span className="text-metin-3"> — {eksik}</span>}
			</span>
		</li>
	);
}
