'use client';

import { useRef, useState, useTransition } from 'react';
import { eksikBildir } from '../eylemler';

/* Eksik bildirme formu.

   Tek satırla başlıyor: mağazada telefondan yazan bir personelin
   önüne dört alanlı bir form koymak, listenin hiç dolmamasına yol
   açar. Ayrıntı ve "acil" işareti isteyene açılıyor. */

export function EksikFormu() {
	const [genis, setGenis] = useState(false);
	const [metin, setMetin] = useState('');
	const [aciklama, setAciklama] = useState('');
	const [acil, setAcil] = useState(false);
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();
	const girdiRef = useRef<HTMLInputElement>(null);

	function gonder(olay: React.FormEvent) {
		olay.preventDefault();
		setHata(null);
		basla(async () => {
			const sonuc = await eksikBildir(metin, aciklama, acil);
			if (!sonuc.tamam) {
				setHata(sonuc.mesaj);
				return;
			}
			setMetin('');
			setAciklama('');
			setAcil(false);
			setGenis(false);
			/* Odak alanda kalsın: art arda birkaç eksik yazmak yaygın. */
			girdiRef.current?.focus();
		});
	}

	return (
		<form onSubmit={gonder} className="border border-kenarlik p-4">
			<label className="block">
				<span className="etiket">Ne eksik?</span>
				<input
					ref={girdiRef}
					type="text"
					value={metin}
					onChange={(e) => setMetin(e.target.value)}
					onFocus={() => setGenis(true)}
					placeholder="Örnek: kahve filtresi bitti"
					className="alan mt-2"
					required
				/>
			</label>

			{genis && (
				<>
					<label className="mt-4 block">
						<span className="etiket">Ayrıntı (isteğe bağlı)</span>
						<input
							type="text"
							value={aciklama}
							onChange={(e) => setAciklama(e.target.value)}
							placeholder="Marka, adet, nereden alındığı…"
							className="alan mt-2"
						/>
					</label>

					<label className="mt-4 flex cursor-pointer items-center gap-3">
						<input
							type="checkbox"
							checked={acil}
							onChange={(e) => setAcil(e.target.checked)}
							className="onay shrink-0"
						/>
						<span className="text-sm text-metin-2">
							Acil — bugün gerekiyor
						</span>
					</label>
				</>
			)}

			{hata && (
				<p role="alert" className="mt-3 text-sm text-hata">
					{hata}
				</p>
			)}

			<button
				type="submit"
				disabled={bekliyor || !metin.trim()}
				className="dugme dugme-dolu mt-4"
			>
				{bekliyor ? 'Ekleniyor…' : 'Listeye ekle'}
			</button>
		</form>
	);
}
