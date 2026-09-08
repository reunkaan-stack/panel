'use client';

import { useState, useTransition } from 'react';
import { telegramKaydet, testGonder, webhookAyarla } from '../eylemler';

/* Telegram ayarları.

   Sıra bilinçli: önce jeton (panel dışında), sonra sohbet kimliği,
   sonra webhook. Webhook kurulmadan gelen mesajlar Telegram'da
   birikir ve hiç işlenmez — o yüzden kurulum düğmesi ayrı ve
   sonucu ekranda yazıyor. */

export function TelegramAyarlari({
	jetonVar,
	gizliVar,
	baslangic,
}: {
	jetonVar: boolean;
	gizliVar: boolean;
	baslangic: {
		aktif: boolean;
		chatId: string;
		gorevBildir: boolean;
		ozetSaati: string;
		hatirlatmaSaati: string;
	};
}) {
	const [alan, setAlan] = useState(baslangic);
	const [durum, setDurum] = useState<{ iyi: boolean; metin: string } | null>(
		null
	);
	const [bekliyor, basla] = useTransition();

	function yaz<A extends keyof typeof alan>(ad: A, deger: (typeof alan)[A]) {
		setAlan((a) => ({ ...a, [ad]: deger }));
	}

	function calistir(is: () => Promise<{ tamam: boolean; mesaj?: string }>, basarili: string) {
		setDurum(null);
		basla(async () => {
			const s = await is();
			setDurum({ iyi: s.tamam, metin: s.tamam ? basarili : (s.mesaj ?? 'Olmadı') });
		});
	}

	return (
		<>
			{/* ---- Kurulum durumu ---- */}
			<div className="border border-kenarlik p-4">
				<span className="etiket">Kurulum</span>
				<ul className="mt-3 space-y-2 text-sm">
					<Satir
						tamam={jetonVar}
						ad="Bot jetonu"
						eksikNotu="TELEGRAM_BOT_TOKEN Vercel'e eklenmeli"
					/>
					<Satir
						tamam={gizliVar}
						ad="Webhook gizli anahtarı"
						eksikNotu="TELEGRAM_WEBHOOK_GIZLI Vercel'e eklenmeli"
					/>
					<Satir
						tamam={!!alan.chatId}
						ad="Sohbet kimliği"
						eksikNotu="aşağıya girilmeli"
					/>
				</ul>

				{(!jetonVar || !gizliVar) && (
					<p className="mt-3 text-sm leading-relaxed text-metin-2">
						Eksik değerler Vercel → Settings → Environment Variables altına
						eklenip yeniden yayınlanır. İkisi de sunucuda kalır, başına{' '}
						<code className="font-mono">NEXT_PUBLIC_</code> konmaz.
					</p>
				)}
			</div>

			{/* ---- Ayarlar ---- */}
			<div className="mt-6 border border-kenarlik p-4">
				<span className="etiket">Bildirimler</span>

				<label className="mt-4 flex cursor-pointer items-start gap-3">
					<input
						type="checkbox"
						checked={alan.aktif}
						onChange={(e) => yaz('aktif', e.target.checked)}
						className="onay mt-0.5 shrink-0"
					/>
					<span className="text-sm">
						<strong>Telegram açık</strong>
						<span className="block text-metin-2">
							Kapalıyken hiçbir mesaj gitmez ve Telegram'dan gelen mesajlar
							işlenmez.
						</span>
					</span>
				</label>

				<label className="mt-4 block">
					<span className="etiket">Sohbet kimliği (chat id)</span>
					<input
						type="text"
						inputMode="numeric"
						value={alan.chatId}
						onChange={(e) => yaz('chatId', e.target.value)}
						placeholder="1690340527"
						className="alan mt-2 font-mono"
					/>
					<span className="mt-1.5 block text-sm text-metin-3">
						Mesajların gideceği sohbet. Bota bir mesaj yazıp{' '}
						<code className="font-mono">/getUpdates</code> ile ya da{' '}
						<code className="font-mono">@userinfobot</code> ile öğrenilir.
					</span>
				</label>

				<label className="mt-5 flex cursor-pointer items-start gap-3">
					<input
						type="checkbox"
						checked={alan.gorevBildir}
						onChange={(e) => yaz('gorevBildir', e.target.checked)}
						className="onay mt-0.5 shrink-0"
					/>
					<span className="text-sm">
						<strong>Her görev kapatıldığında haber ver</strong>
						<span className="block text-metin-2">
							Günde yirmiden fazla mesaj olabilir. Kapatırsanız yalnızca
							hatırlatma, günlük özet ve eksik bildirimleri gelir.
						</span>
					</span>
				</label>

				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<label className="block">
						<span className="etiket">Kapanış hatırlatması</span>
						<input
							type="time"
							value={alan.hatirlatmaSaati}
							onChange={(e) => yaz('hatirlatmaSaati', e.target.value)}
							className="alan mt-2"
						/>
						<span className="mt-1.5 block text-sm text-metin-3">
							Kapatılmamış görev varsa hatırlatır. Hepsi bittiyse mesaj
							gitmez.
						</span>
					</label>

					<label className="block">
						<span className="etiket">Günlük özet</span>
						<input
							type="time"
							value={alan.ozetSaati}
							onChange={(e) => yaz('ozetSaati', e.target.value)}
							className="alan mt-2"
						/>
						<span className="mt-1.5 block text-sm text-metin-3">
							Tamamlanma oranı, ciro, yapılmayanlar ve notlar.
						</span>
					</label>
				</div>

				{durum && (
					<p
						role="status"
						className={`mt-4 text-sm ${durum.iyi ? 'text-basarili' : 'text-hata'}`}
					>
						{durum.metin}
					</p>
				)}

				<div className="mt-5 flex flex-wrap gap-3">
					<button
						type="button"
						disabled={bekliyor}
						onClick={() => calistir(() => telegramKaydet(alan), 'Kaydedildi')}
						className="dugme dugme-dolu"
					>
						{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
					</button>

					<button
						type="button"
						disabled={bekliyor || !jetonVar}
						onClick={() => calistir(testGonder, 'Test mesajı gönderildi.')}
						className="dugme dugme-bos"
					>
						Test mesajı gönder
					</button>
				</div>
			</div>

			{/* ---- Webhook ---- */}
			<div className="mt-6 border border-kenarlik p-4">
				<span className="etiket">Telegram'dan gelen mesajlar</span>
				<p className="mt-2 text-sm leading-relaxed text-metin-2">
					Bota yazdığınız her mesaj <strong>bugüne görev</strong> olarak
					eklenir. <code className="font-mono">/durum</code> ve{' '}
					<code className="font-mono">/ozet</code> komutları da çalışır.
				</p>
				<p className="mt-2 text-sm leading-relaxed text-metin-3">
					Bunun çalışması için Telegram'a panelin adresini bir kez bildirmek
					gerekiyor. Adres değişirse tekrar basın.
				</p>

				<button
					type="button"
					disabled={bekliyor || !jetonVar || !gizliVar}
					onClick={() =>
						calistir(webhookAyarla, 'Webhook kuruldu. Bota mesaj yazıp deneyin.')
					}
					className="dugme dugme-bos mt-4"
				>
					Webhook&apos;u kur
				</button>
			</div>
		</>
	);
}

function Satir({
	tamam,
	ad,
	eksikNotu,
}: {
	tamam: boolean;
	ad: string;
	eksikNotu: string;
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
				{!tamam && <span className="text-metin-3"> — {eksikNotu}</span>}
			</span>
		</li>
	);
}
