'use client';

import type { Bolge } from '@/lib/tipler';

/* Görev kapatırken bölüm seçmek için küçük kroki.

   Yönetici ekranındaki krokinin düzenlenebilir sürümünden AYRI bir
   bileşen. Sebep: buradaki ihtiyaçlar farklı — sürükleme yok,
   boyutlandırma yok, sayı yok. Ortak bir bileşene iki modu birden
   sığdırmak, ikisini de karmaşıklaştırırdı.

   Temizlik sayısı bilinçli olarak GÖSTERİLMİYOR: personel "burası az
   temizlenmiş" diye değil, gerçekten yaptığı yeri işaretlemeli. Sayı
   göstermek seçimi yönlendirirdi. */

const EN = 1000;
const BOY = 600;

export function KrokiSecici({
	bolgeler,
	secili,
	degistir,
	kapali,
}: {
	bolgeler: Bolge[];
	secili: Set<string>;
	degistir: (bolgeId: string) => void;
	kapali: boolean;
}) {
	const haritadakiler = bolgeler.filter((b) => b.kroki_x !== null);
	const haritaDisindakiler = bolgeler.filter((b) => b.kroki_x === null);

	return (
		<>
			{haritadakiler.length > 0 && (
				<svg
					viewBox={`0 0 ${EN} ${BOY}`}
					className="w-full border border-kenarlik bg-zemin"
					role="group"
					aria-label="Mağaza krokisi — bölüm seçin"
				>
					{haritadakiler.map((b) => {
						const isSecili = secili.has(b.id);
						return (
							<g
								key={b.id}
								role="checkbox"
								aria-checked={isSecili}
								aria-label={b.ad}
								tabIndex={kapali ? -1 : 0}
								onClick={() => !kapali && degistir(b.id)}
								onKeyDown={(olay) => {
									if (kapali) return;
									if (olay.key === 'Enter' || olay.key === ' ') {
										olay.preventDefault();
										degistir(b.id);
									}
								}}
								className={kapali ? '' : 'cursor-pointer'}
							>
								<rect
									x={b.kroki_x!}
									y={b.kroki_y!}
									width={b.kroki_en!}
									height={b.kroki_boy!}
									fill="var(--color-vurgu)"
									fillOpacity={isSecili ? 0.45 : 0.05}
									stroke={
										isSecili ? 'var(--color-vurgu)' : 'var(--color-metin-3)'
									}
									strokeWidth={isSecili ? 4 : 1.5}
								/>

								{/* Seçili olanda köşe nişanı: renk tek başına anlam
								    taşımamalı, işaret de olsun. */}
								{isSecili && (
									<path
										d={`M ${b.kroki_x! + 12} ${b.kroki_y! + b.kroki_boy! - 22}
										    l 10 12 l 20 -26`}
										fill="none"
										stroke="var(--color-vurgu)"
										strokeWidth={6}
										strokeLinecap="square"
									/>
								)}

								<text
									x={b.kroki_x! + 12}
									y={b.kroki_y! + 30}
									className="pointer-events-none select-none"
									fill="var(--color-metin)"
									fontSize="22"
									fontWeight={isSecili ? 700 : 500}
								>
									{kisalt(b.ad, b.kroki_en!)}
									<title>{b.ad}</title>
								</text>
							</g>
						);
					})}
				</svg>
			)}

			{/* Krokiye yerleştirilmemiş bölümler tıklanamaz; liste olarak
			    gösteriliyor ki seçilebilsinler. */}
			{haritaDisindakiler.length > 0 && (
				<div className="mt-3">
					<span className="etiket">Krokide olmayan bölümler</span>
					<div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
						{haritaDisindakiler.map((b) => (
							<label key={b.id} className="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									checked={secili.has(b.id)}
									onChange={() => degistir(b.id)}
									disabled={kapali}
									className="onay shrink-0"
								/>
								<span className="text-sm text-metin-2">{b.ad}</span>
							</label>
						))}
					</div>
				</div>
			)}

			{bolgeler.length === 0 && (
				<p className="text-sm text-metin-2">
					Tanımlı bölüm yok. Yöneticinizden krokiye bölüm eklemesini isteyin.
				</p>
			)}
		</>
	);
}

/* SVG metni sarmaz ve taşar; kutuya sığmayan ad kısaltılır. */
function kisalt(metin: string, kutuEni: number): string {
	const sigan = Math.floor((kutuEni - 24) / 11.5);
	if (metin.length <= sigan) return metin;
	return metin.slice(0, Math.max(1, sigan - 1)) + '…';
}
