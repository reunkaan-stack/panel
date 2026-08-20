'use client';

import { useState, useTransition } from 'react';
import type { GorevSatiri } from '@/lib/tipler';
import { gorevAtla, gorevTamamla, type GorevDegeri } from '../eylemler';

/* Tek görev satırı.

   Personel kendi görevini kapatır; müdür hepsini görür ve işaretleyip
   toplu atama yapabilir. "Ne zaman yapıldı" her satırda görünür —
   müdürün istediği asıl bilgi buydu. */

export function GorevSatir({
	gorev,
	yonetici,
	benim,
	secili,
	isaretle,
	saatiBicimle,
}: {
	gorev: GorevSatiri;
	yonetici: boolean;
	benim: boolean;
	secili: boolean;
	isaretle: () => void;
	saatiBicimle: (an: string) => string;
}) {
	const [acik, setAcik] = useState(false);
	const [deger, setDeger] = useState('');
	const [sebep, setSebep] = useState('');
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	const kapali = gorev.durum !== 'bekliyor';
	/* Kimseye atanmamış görevi herkes alabilir; atanmışsa yalnızca sahibi
	   ya da müdür kapatır. */
	const kapatabilir = !kapali && (yonetici || benim || !gorev.atanan_id);

	function tamamla() {
		setHata(null);
		const d: GorevDegeri = {};
		if (gorev.tur === 'metin') {
			if (!deger.trim()) return setHata('Bir şey yazmanız gerekiyor');
			d.metin = deger;
		} else if (gorev.tur === 'sayi') {
			const s = Number(deger.replace(',', '.'));
			if (!Number.isFinite(s)) return setHata('Geçerli bir sayı girin');
			d.sayi = s;
		} else {
			d.onay = true;
		}

		basla(async () => {
			const sonuc = await gorevTamamla(gorev.id, gorev.tur, d);
			if (!sonuc.tamam) {
				setHata(sonuc.mesaj);
				return;
			}
			setAcik(false);
		});
	}

	function atla() {
		setHata(null);
		if (!sebep.trim()) return setHata('Neden yapılamadığını yazın');
		basla(async () => {
			const sonuc = await gorevAtla(gorev.id, sebep);
			if (!sonuc.tamam) {
				setHata(sonuc.mesaj);
				return;
			}
			setAcik(false);
		});
	}

	const durumRengi =
		gorev.durum === 'tamamlandi'
			? 'text-basarili'
			: gorev.durum === 'atlandi'
				? 'text-uyari'
				: 'text-metin-3';

	return (
		<li className="border-b border-kenarlik-2 py-4">
			<div className="flex items-start gap-3">
				{yonetici && (
					<input
						type="checkbox"
						checked={secili}
						onChange={isaretle}
						className="onay mt-1 shrink-0"
						aria-label={`${gorev.baslik} — seç`}
					/>
				)}

				<div className="min-w-0 flex-1">
					<p className={kapali ? 'text-metin-2 line-through' : 'font-medium'}>
						{gorev.baslik}
						{gorev.zorunlu && !kapali && (
							<span className="ml-2 text-vurgu-metin" title="Zorunlu">
								*
							</span>
						)}
					</p>

					<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
						<span>
							{gorev.atanan ? gorev.atanan.ad : 'atanmadı'}
						</span>
						{gorev.tamamlanma_zamani && (
							<span className={durumRengi}>
								{gorev.durum === 'atlandi' ? 'atlandı' : 'yapıldı'}{' '}
								{saatiBicimle(gorev.tamamlanma_zamani)}
								{gorev.tamamlayan && ` · ${gorev.tamamlayan.ad}`}
							</span>
						)}
					</div>

					{gorev.durum === 'atlandi' && gorev.atlama_sebebi && (
						<p className="mt-1.5 text-sm text-uyari">
							Sebep: {gorev.atlama_sebebi}
						</p>
					)}
					{gorev.durum === 'tamamlandi' && gorev.deger_metin && (
						<p className="mt-1.5 text-sm text-metin-2">{gorev.deger_metin}</p>
					)}
					{gorev.durum === 'tamamlandi' && gorev.deger_sayi !== null && (
						<p className="mt-1.5 font-mono text-sm text-metin-2">
							{gorev.deger_sayi}
						</p>
					)}
				</div>

				{kapatabilir && !acik && (
					<button
						type="button"
						onClick={() => setAcik(true)}
						className="dugme dugme-bos shrink-0 !px-3 !py-1.5"
					>
						Kapat
					</button>
				)}
			</div>

			{acik && (
				<div className="mt-4 border border-kenarlik bg-zemin-2 p-4">
					{gorev.ipucu && (
						<p className="mb-3 text-sm text-metin-2">{gorev.ipucu}</p>
					)}

					{(gorev.tur === 'metin' || gorev.tur === 'sayi') && (
						<label className="block">
							<span className="etiket">
								{gorev.tur === 'sayi' ? 'Sayı' : 'Açıklama'}
							</span>
							<input
								type={gorev.tur === 'sayi' ? 'text' : 'text'}
								inputMode={gorev.tur === 'sayi' ? 'decimal' : 'text'}
								value={deger}
								onChange={(e) => setDeger(e.target.value)}
								className="alan mt-2"
								autoFocus
							/>
						</label>
					)}

					<label className="mt-4 block">
						<span className="etiket">Yapılamadıysa sebebi</span>
						<input
							type="text"
							value={sebep}
							onChange={(e) => setSebep(e.target.value)}
							placeholder="Boş bırakırsan görev yapıldı sayılır"
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
							onClick={sebep.trim() ? atla : tamamla}
							disabled={bekliyor}
							className="dugme dugme-dolu"
						>
							{bekliyor
								? 'Kaydediliyor…'
								: sebep.trim()
									? 'Atlandı olarak kaydet'
									: 'Yapıldı olarak kaydet'}
						</button>
						<button
							type="button"
							onClick={() => {
								setAcik(false);
								setHata(null);
							}}
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
