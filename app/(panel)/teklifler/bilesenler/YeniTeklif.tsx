'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { teklifAc } from '../eylemler';

/* Yeni teklif düğmesi.

   Teklif hazır kalemlerle açılıp doğrudan düzenleme ekranına
   geçiliyor. Boş bir formun karşısında "ne yazacağım" diye durmak,
   aceleyle gönderilen eksik teklif üretiyor. */

export function YeniTeklif() {
	const router = useRouter();
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<div className="flex flex-wrap items-center gap-3">
			{hata && (
				<span role="alert" className="text-sm text-hata">
					{hata}
				</span>
			)}
			<button
				type="button"
				disabled={bekliyor}
				onClick={() =>
					basla(async () => {
						const sonuc = await teklifAc();
						if (!sonuc.tamam) return setHata(sonuc.mesaj);
						router.push(`/teklifler/${sonuc.veri}`);
					})
				}
				className="dugme dugme-dolu"
			>
				{bekliyor ? 'Açılıyor…' : 'Yeni teklif'}
			</button>
		</div>
	);
}
