'use client';

import { useMemo, useState } from 'react';
import {
	DUGUMLER,
	KATMAN_ADLARI,
	MODUL_ADLARI,
	TUR_ADLARI,
	type Dugum,
	type Katman,
	type ModulKodu,
} from '@/lib/harita/veri';

/* Bağlantı diyagramı.

   Düğümler KATMANA göre sütunlara diziliyor: tarayıcı → sunucu → lib
   → veritabanı → dış servis. Okun yönü hep sağa, yani "bunu yapmak
   için şuna ihtiyacım var" yönü. Kuvvet tabanlı serbest yerleşim
   denenmedi: her açılışta farklı çıkardı ve "geçen sefer şuradaydı"
   diye aranan şey bulunamazdı. Katmanlı yerleşim her seferinde aynı.

   Bir düğüme tıklayınca yalnızca ONA bağlı oklar kalıyor, gerisi
   soluyor. Seksen düğümün bağlantısı aynı anda çizilirse ağ değil
   gürültü olur. */

const SUTUN = 210;
const SATIR = 32;
const KUTU_EN = 168;
const KUTU_BOY = 22;
const UST = 54;

const TUR_RENGI: Record<string, string> = {
	sayfa: 'var(--color-vurgu-metin)',
	eylem: 'var(--color-basarili)',
	uc: 'var(--color-uyari)',
	lib: 'var(--color-metin-2)',
	tablo: 'var(--color-vurgu-metin)',
	islev: 'var(--color-metin-2)',
	dis: 'var(--color-hata)',
};

export function Diyagram() {
	const [secili, setSecili] = useState<string | null>(null);
	const [modul, setModul] = useState<ModulKodu | 'hepsi'>('hepsi');

	/* Yerleşim bir kez hesaplanıyor; süzme yalnızca soldurma yapıyor,
	   düğümleri yerinden oynatmıyor. Yer değiştirseydi süzgeç açılıp
	   kapandıkça göz her seferinde yeniden arardı. */
	const { yerler, en, boy } = useMemo(() => {
		const sayac: Record<number, number> = {};
		const yerler = new Map<string, { x: number; y: number }>();

		for (const d of DUGUMLER) {
			const sira = sayac[d.katman] ?? 0;
			sayac[d.katman] = sira + 1;
			yerler.set(d.kod, { x: d.katman * SUTUN + 20, y: UST + sira * SATIR });
		}

		const enYuksek = Math.max(...Object.values(sayac));
		return {
			yerler,
			en: 5 * SUTUN + 20,
			boy: UST + enYuksek * SATIR + 20,
		};
	}, []);

	const seciliDugum = secili ? DUGUMLER.find((d) => d.kod === secili) ?? null : null;

	/* Seçili düğümün komşuları: hem bağlandıkları hem ona bağlananlar.
	   Tek yön gösterilseydi "bunu kim kullanıyor" sorusu cevapsız
	   kalırdı ve o soru en az diğeri kadar sık soruluyor. */
	const komsular = useMemo(() => {
		if (!secili) return null;
		const küme = new Set<string>([secili]);
		for (const d of DUGUMLER) {
			if (d.kod === secili) d.baglar.forEach((b) => küme.add(b));
			else if (d.baglar.includes(secili)) küme.add(d.kod);
		}
		return küme;
	}, [secili]);

	function solukMu(d: Dugum): boolean {
		if (komsular) return !komsular.has(d.kod);
		if (modul !== 'hepsi') return d.modul !== modul;
		return false;
	}

	const oklar: { a: Dugum; b: Dugum }[] = [];
	for (const d of DUGUMLER) {
		for (const hedefKod of d.baglar) {
			const hedef = DUGUMLER.find((x) => x.kod === hedefKod);
			if (hedef) oklar.push({ a: d, b: hedef });
		}
	}

	return (
		<div>
			{/* Süzgeç */}
			<div className="flex flex-wrap items-center gap-2">
				{(['hepsi', ...Object.keys(MODUL_ADLARI)] as (ModulKodu | 'hepsi')[]).map(
					(m) => (
						<button
							key={m}
							type="button"
							onClick={() => {
								setModul(m);
								setSecili(null);
							}}
							aria-pressed={modul === m}
							className={`border px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] transition-colors ${
								modul === m
									? 'border-vurgu-metin bg-vurgu-metin text-zemin'
									: 'border-kenarlik text-metin-2 hover:border-metin'
							}`}
						>
							{m === 'hepsi' ? 'Hepsi' : MODUL_ADLARI[m]}
						</button>
					)
				)}
				{secili && (
					<button
						type="button"
						onClick={() => setSecili(null)}
						className="ml-auto font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
					>
						Seçimi bırak
					</button>
				)}
			</div>

			<p className="mt-3 text-sm leading-relaxed text-metin-3">
				Ok yönü <strong>ihtiyaç</strong> yönüdür: soldaki, sağdakine ihtiyaç
				duyar. Bir kutuya tıklayınca yalnızca onun bağlantıları kalır.
			</p>

			<div className="mt-4 overflow-x-auto border border-kenarlik">
				<svg
					viewBox={`0 0 ${en} ${boy}`}
					width={en}
					height={boy}
					className="block max-w-none"
					role="img"
					aria-label="Panel bağlantı diyagramı"
				>
					{/* Katman başlıkları */}
					{([0, 1, 2, 3, 4] as Katman[]).map((k) => (
						<g key={k}>
							<rect
								x={k * SUTUN + 12}
								y={10}
								width={KUTU_EN + 16}
								height={26}
								fill="var(--color-zemin-2)"
							/>
							<text
								x={k * SUTUN + 20}
								y={27}
								fontSize={10}
								fontFamily="var(--font-mono, monospace)"
								letterSpacing={1}
								fill="var(--color-metin-3)"
							>
								{k}. {KATMAN_ADLARI[k].toUpperCase()}
							</text>
						</g>
					))}

					{/* Oklar önce: kutuların altında kalsınlar */}
					{oklar.map(({ a, b }, i) => {
						const p1 = yerler.get(a.kod);
						const p2 = yerler.get(b.kod);
						if (!p1 || !p2) return null;

						const vurgulu =
							komsular != null && (a.kod === secili || b.kod === secili);
						const soluk = komsular
							? !vurgulu
							: modul !== 'hepsi' && a.modul !== modul && b.modul !== modul;

						const x1 = p1.x + KUTU_EN;
						const y1 = p1.y + KUTU_BOY / 2;
						const x2 = p2.x;
						const y2 = p2.y + KUTU_BOY / 2;
						const orta = (x1 + x2) / 2;

						return (
							<path
								key={i}
								d={`M ${x1} ${y1} C ${orta} ${y1}, ${orta} ${y2}, ${x2} ${y2}`}
								fill="none"
								stroke={
									vurgulu ? 'var(--color-vurgu-metin)' : 'var(--color-kenarlik)'
								}
								strokeWidth={vurgulu ? 1.4 : 0.7}
								opacity={soluk ? 0.12 : vurgulu ? 0.95 : 0.5}
							/>
						);
					})}

					{/* Kutular */}
					{DUGUMLER.map((d) => {
						const p = yerler.get(d.kod);
						if (!p) return null;
						const soluk = solukMu(d);
						const bu = d.kod === secili;

						return (
							<g
								key={d.kod}
								onClick={() => setSecili(bu ? null : d.kod)}
								style={{ cursor: 'pointer' }}
								opacity={soluk ? 0.22 : 1}
							>
								<rect
									x={p.x}
									y={p.y}
									width={KUTU_EN}
									height={KUTU_BOY}
									fill={bu ? 'var(--color-vurgu-metin)' : 'var(--color-zemin-2)'}
									stroke={
										d.sorun
											? 'var(--color-uyari)'
											: bu
												? 'var(--color-vurgu-metin)'
												: 'var(--color-kenarlik)'
									}
									strokeWidth={d.sorun ? 1.4 : 0.8}
								/>
								{/* Tür şeridi: renk körlüğüne karşı konum da bilgi taşısın */}
								<rect
									x={p.x}
									y={p.y}
									width={3}
									height={KUTU_BOY}
									fill={TUR_RENGI[d.tur]}
								/>
								<text
									x={p.x + 9}
									y={p.y + 15}
									fontSize={10.5}
									fill={bu ? 'var(--color-zemin)' : 'var(--color-metin)'}
								>
									{d.ad.length > 24 ? d.ad.slice(0, 23) + '…' : d.ad}
								</text>
								{d.sorun && (
									<text
										x={p.x + KUTU_EN - 10}
										y={p.y + 15}
										fontSize={11}
										fill="var(--color-uyari)"
									>
										!
									</text>
								)}
							</g>
						);
					})}
				</svg>
			</div>

			{/* Gösterge */}
			<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
				{Object.entries(TUR_ADLARI).map(([tur, ad]) => (
					<span
						key={tur}
						className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3"
					>
						<span
							aria-hidden
							className="inline-block h-3 w-[3px]"
							style={{ background: TUR_RENGI[tur] }}
						/>
						{ad}
					</span>
				))}
				<span className="flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-uyari">
					! sorunlu ya da yarım
				</span>
			</div>

			{/* Ayrıntı */}
			{seciliDugum ? (
				<Ayrinti dugum={seciliDugum} sec={setSecili} />
			) : (
				<p className="mt-6 border border-kenarlik-2 p-4 text-sm leading-relaxed text-metin-3">
					Bir kutuya tıklayın: ne işe yaradığı, neden öyle yapıldığı, hangi
					dosyada olduğu ve neye bağlı olduğu burada açılır.
				</p>
			)}
		</div>
	);
}

function Ayrinti({
	dugum: d,
	sec,
}: {
	dugum: Dugum;
	sec: (k: string) => void;
}) {
	const kullananlar = DUGUMLER.filter((x) => x.baglar.includes(d.kod));
	const ihtiyaclari = d.baglar
		.map((b) => DUGUMLER.find((x) => x.kod === b))
		.filter((x): x is Dugum => Boolean(x));

	return (
		<div className="mt-6 border border-kenarlik p-5">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<h3 className="text-lg font-semibold tracking-[-0.015em]">{d.ad}</h3>
				<span className="etiket">{TUR_ADLARI[d.tur]}</span>
				<span className="etiket text-metin-3">{MODUL_ADLARI[d.modul]}</span>
			</div>

			{d.yol && (
				<p className="mt-2 font-mono text-[0.6875rem] tracking-[0.02em] text-metin-3">
					{d.yol}
				</p>
			)}

			<p className="mt-3 text-sm leading-relaxed text-metin-2">{d.ne}</p>

			{d.neden && (
				<div className="mt-4 border-l-2 border-kenarlik pl-4">
					<span className="etiket">Neden böyle</span>
					<p className="mt-1.5 text-sm leading-relaxed text-metin-2">{d.neden}</p>
				</div>
			)}

			{d.sorun && (
				<div className="mt-4 border border-uyari p-3">
					<span className="etiket text-uyari">Neden olmuyor</span>
					<p className="mt-1.5 text-sm leading-relaxed text-metin-2">{d.sorun}</p>
				</div>
			)}

			<div className="mt-5 grid gap-5 sm:grid-cols-2">
				<Liste baslik="Buna ihtiyaç duyar" dugumler={ihtiyaclari} sec={sec} />
				<Liste baslik="Bunu kullananlar" dugumler={kullananlar} sec={sec} />
			</div>
		</div>
	);
}

function Liste({
	baslik,
	dugumler,
	sec,
}: {
	baslik: string;
	dugumler: Dugum[];
	sec: (k: string) => void;
}) {
	return (
		<div>
			<span className="etiket">
				{baslik} · {dugumler.length}
			</span>
			{dugumler.length === 0 ? (
				<p className="mt-2 text-sm text-metin-3">—</p>
			) : (
				<ul className="mt-2 space-y-1">
					{dugumler.map((x) => (
						<li key={x.kod}>
							<button
								type="button"
								onClick={() => sec(x.kod)}
								className="text-left text-sm text-metin-2 underline underline-offset-4 hover:text-metin"
							>
								{x.ad}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
