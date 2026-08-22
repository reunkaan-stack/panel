'use client';

import { useState, useTransition } from 'react';
import { gunKisaAdi, gunVeAy } from '@/lib/ortak/tarih';
import { paraBicimle, paraCoz } from '@/lib/ortak/para';
import type { Ciro } from '@/lib/tipler';
import { ciroKaydet, ciroSil } from '../eylemler';

/* Ay tablosu.

   Girilmeyen günler de satır olarak duruyor. Yalnızca dolu günler
   listelenseydi eksik gün fark edilmezdi — "unutulan gün" ancak
   boşluğuyla görünür. */

export function CiroTablosu({
	gunler,
	cirolar,
}: {
	gunler: string[];
	cirolar: Record<string, Ciro>;
}) {
	const [duzenlenen, setDuzenlenen] = useState<string | null>(null);

	return (
		<ul className="border-t border-kenarlik">
			{gunler.map((gun) => (
				<CiroSatir
					key={gun}
					gun={gun}
					ciro={cirolar[gun] ?? null}
					acik={duzenlenen === gun}
					ac={() => setDuzenlenen(gun)}
					kapat={() => setDuzenlenen(null)}
				/>
			))}
		</ul>
	);
}

function CiroSatir({
	gun,
	ciro,
	acik,
	ac,
	kapat,
}: {
	gun: string;
	ciro: Ciro | null;
	acik: boolean;
	ac: () => void;
	kapat: () => void;
}) {
	const [tutar, setTutar] = useState(ciro ? String(ciro.tutar) : '');
	const [fis, setFis] = useState(ciro?.fis_sayisi ? String(ciro.fis_sayisi) : '');
	const [not, setNot] = useState(ciro?.not_metni ?? '');
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	const haftaSonu = ['Cmt', 'Paz'].includes(gunKisaAdi(gun));
	const sepet =
		ciro && ciro.fis_sayisi && ciro.fis_sayisi > 0
			? Number(ciro.tutar) / ciro.fis_sayisi
			: null;

	function kaydet() {
		setHata(null);
		if (paraCoz(tutar) === null) return setHata('Tutarı okuyamadım');
		basla(async () => {
			const sonuc = await ciroKaydet(gun, tutar, fis, not);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			kapat();
		});
	}

	function sil() {
		if (!ciro) return;
		setHata(null);
		basla(async () => {
			const sonuc = await ciroSil(ciro.id);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setTutar('');
			setFis('');
			setNot('');
			kapat();
		});
	}

	return (
		<li className="border-b border-kenarlik-2 py-3">
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<span
					className={`w-32 shrink-0 font-mono text-[0.6875rem] tracking-[0.04em] ${
						haftaSonu ? 'text-vurgu-metin' : 'text-metin-3'
					}`}
				>
					{gunVeAy(gun)} · {gunKisaAdi(gun)}
				</span>

				{ciro ? (
					<>
						<span className="flex-1 font-medium tabular-nums">
							{paraBicimle(Number(ciro.tutar))}
						</span>
						<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
							{ciro.fis_sayisi ? `${ciro.fis_sayisi} fiş` : 'fiş —'}
							{sepet !== null && ` · sepet ${paraBicimle(sepet)}`}
							{ciro.giren && ` · ${ciro.giren.ad}`}
						</span>
					</>
				) : (
					<span className="flex-1 text-sm text-metin-3">girilmedi</span>
				)}

				{!acik && (
					<button
						type="button"
						onClick={ac}
						className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
					>
						{ciro ? 'Düzelt' : 'Gir'}
					</button>
				)}
			</div>

			{ciro?.not_metni && !acik && (
				<p className="mt-1 pl-36 text-sm text-metin-2">{ciro.not_metni}</p>
			)}

			{acik && (
				<div className="mt-3 border border-kenarlik bg-zemin-2 p-4">
					<div className="flex flex-wrap gap-4">
						<label className="min-w-40 flex-1">
							<span className="etiket">Tutar</span>
							<input
								type="text"
								inputMode="decimal"
								value={tutar}
								onChange={(e) => setTutar(e.target.value)}
								placeholder="12.500"
								className="alan mt-2"
								autoFocus
							/>
						</label>
						<label className="w-32">
							<span className="etiket">Fiş</span>
							<input
								type="text"
								inputMode="numeric"
								value={fis}
								onChange={(e) => setFis(e.target.value)}
								className="alan mt-2"
							/>
						</label>
					</div>

					<p className="mt-2 font-mono text-sm text-metin-2" aria-live="polite">
						{tutar.trim() === ''
							? ' '
							: paraCoz(tutar) === null
								? 'Bu bir tutar gibi görünmüyor.'
								: paraBicimle(paraCoz(tutar)!, true)}
					</p>

					<label className="mt-4 block">
						<span className="etiket">Not (isteğe bağlı)</span>
						<input
							type="text"
							value={not}
							onChange={(e) => setNot(e.target.value)}
							placeholder="Yarım gün açıldı, elektrik kesintisi…"
							className="alan mt-2"
						/>
					</label>

					{hata && (
						<p role="alert" className="mt-3 text-sm text-hata">
							{hata}
						</p>
					)}

					<div className="mt-4 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={kaydet}
							disabled={bekliyor}
							className="dugme dugme-dolu"
						>
							{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
						</button>
						<button
							type="button"
							onClick={kapat}
							disabled={bekliyor}
							className="dugme dugme-bos"
						>
							Vazgeç
						</button>
						{ciro && (
							<button
								type="button"
								onClick={sil}
								disabled={bekliyor}
								className="ml-auto font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-hata"
							>
								Bu günü sil
							</button>
						)}
					</div>
				</div>
			)}
		</li>
	);
}
