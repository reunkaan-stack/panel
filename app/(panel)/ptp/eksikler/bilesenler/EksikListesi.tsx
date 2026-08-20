'use client';

import { useState, useTransition } from 'react';
import { saatiBicimle } from '@/lib/ortak/tarih';
import type { EksikSatiri } from '../page';
import { eksikGeriAl, eksikKapat } from '../eylemler';

/* Eksik listesi.

   Bekleyenler üstte, kapananlar altta ve katlanmış. Yöneticinin asıl
   ihtiyacı "ne bekliyor" — kapananlar kontrol için var, ekranı
   doldurmasın. */

export function EksikListesi({
	bekleyen,
	kapanan,
	yonetici,
}: {
	bekleyen: EksikSatiri[];
	kapanan: EksikSatiri[];
	yonetici: boolean;
}) {
	const [gecmisAcik, setGecmisAcik] = useState(false);

	return (
		<>
			{bekleyen.length === 0 ? (
				<div className="kose-nisan border border-kenarlik p-8 text-center">
					<span className="etiket">Liste boş</span>
					<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
						Bekleyen eksik yok. Bir şey bittiğinde yukarıdaki kutuya yazın.
					</p>
				</div>
			) : (
				<ul className="border-t border-kenarlik">
					{bekleyen.map((eksik) => (
						<EksikSatir key={eksik.id} eksik={eksik} yonetici={yonetici} />
					))}
				</ul>
			)}

			{kapanan.length > 0 && (
				<div className="mt-10">
					<button
						type="button"
						onClick={() => setGecmisAcik((a) => !a)}
						className="etiket text-metin-3 hover:text-metin"
						aria-expanded={gecmisAcik}
					>
						{gecmisAcik ? '−' : '+'} Kapatılanlar ({kapanan.length})
					</button>

					{gecmisAcik && (
						<ul className="mt-4 border-t border-kenarlik">
							{kapanan.map((eksik) => (
								<EksikSatir key={eksik.id} eksik={eksik} yonetici={yonetici} />
							))}
						</ul>
					)}
				</div>
			)}
		</>
	);
}

function EksikSatir({
	eksik,
	yonetici,
}: {
	eksik: EksikSatiri;
	yonetici: boolean;
}) {
	const [acik, setAcik] = useState(false);
	const [not, setNot] = useState('');
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	const kapali = eksik.durum !== 'bekliyor';

	function kapat(durum: 'giderildi' | 'iptal') {
		setHata(null);
		basla(async () => {
			const sonuc = await eksikKapat(eksik.id, durum, not);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setAcik(false);
			setNot('');
		});
	}

	function geriAl() {
		setHata(null);
		basla(async () => {
			const sonuc = await eksikGeriAl(eksik.id);
			if (!sonuc.tamam) setHata(sonuc.mesaj);
		});
	}

	return (
		<li className="border-b border-kenarlik-2 py-4">
			<div className="flex items-start gap-3">
				<div className="min-w-0 flex-1">
					<p className={kapali ? 'text-metin-2 line-through' : 'font-medium'}>
						{eksik.metin}
						{eksik.acil && !kapali && (
							<span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-hata">
								acil
							</span>
						)}
					</p>

					{eksik.aciklama && (
						<p className="mt-1 text-sm text-metin-2">{eksik.aciklama}</p>
					)}

					<div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
						<span>{eksik.bildiren?.ad ?? 'bilinmiyor'}</span>
						{kapali && eksik.kapanma_zamani && (
							<span
								className={
									eksik.durum === 'giderildi' ? 'text-basarili' : 'text-metin-3'
								}
							>
								{eksik.durum === 'giderildi' ? 'giderildi' : 'iptal'}{' '}
								{saatiBicimle(eksik.kapanma_zamani)}
								{eksik.kapatan && ` · ${eksik.kapatan.ad}`}
							</span>
						)}
					</div>

					{eksik.kapanma_notu && (
						<p className="mt-1.5 text-sm text-metin-2">{eksik.kapanma_notu}</p>
					)}
				</div>

				{yonetici && !kapali && !acik && (
					<button
						type="button"
						onClick={() => setAcik(true)}
						className="dugme dugme-bos shrink-0 !px-3 !py-1.5"
					>
						İşaretle
					</button>
				)}

				{yonetici && kapali && (
					<button
						type="button"
						onClick={geriAl}
						disabled={bekliyor}
						className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
					>
						Geri al
					</button>
				)}
			</div>

			{acik && (
				<div className="mt-4 border border-kenarlik bg-zemin-2 p-4">
					<label className="block">
						<span className="etiket">Not (isteğe bağlı)</span>
						<input
							type="text"
							value={not}
							onChange={(e) => setNot(e.target.value)}
							placeholder="Nereden alındı, ne zaman gelecek…"
							className="alan mt-2"
							autoFocus
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
							onClick={() => kapat('giderildi')}
							disabled={bekliyor}
							className="dugme dugme-dolu"
						>
							{bekliyor ? 'Kaydediliyor…' : 'Giderildi'}
						</button>
						<button
							type="button"
							onClick={() => kapat('iptal')}
							disabled={bekliyor}
							className="dugme dugme-bos"
						>
							Gerek yok
						</button>
						<button
							type="button"
							onClick={() => setAcik(false)}
							disabled={bekliyor}
							className="dugme dugme-bos"
						>
							Vazgeç
						</button>
					</div>
				</div>
			)}
		</li>
	);
}
