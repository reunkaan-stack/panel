'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { firmaDegistir } from '@/app/(panel)/eylemler';

/* Firma seçici — yalnızca süperadminde ve birden çok firma varsa.

   Süperadminin kendi firması yoktur; firmaların üstündedir. Ama her
   kayıtta somut bir firma gerektiği için "hangi firma adına
   çalışıyorum" sorusunun bir cevabı olmak zorunda.

   Tek firma varken bu seçici görünmüyor: seçilecek bir şey yokken
   ekrana kutu koymak gürültü. */

export function FirmaSecici({
	firmalar,
	secili,
}: {
	firmalar: { id: string; ad: string }[];
	secili: string | null;
}) {
	const router = useRouter();
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	if (firmalar.length < 2) return null;

	return (
		<label className="flex items-center gap-2">
			<span className="sr-only">Firma</span>
			<select
				value={secili ?? ''}
				disabled={bekliyor}
				onChange={(e) => {
					const yeni = e.target.value;
					if (!yeni) return;
					setHata(null);
					basla(async () => {
						const sonuc = await firmaDegistir(yeni);
						if (!sonuc.tamam) return setHata(sonuc.mesaj);
						router.refresh();
					});
				}}
				className="border border-kenarlik bg-zemin px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-2 hover:border-metin-3 disabled:opacity-60"
				aria-label="Hangi firma adına çalışılıyor"
			>
				{/* Seçim yoksa boş seçenek: kullanıcı bir şey seçmediğini
				    görsün, rastgele bir firmayı seçili sanmasın. */}
				{!secili && <option value="">Firma seçin…</option>}
				{firmalar.map((f) => (
					<option key={f.id} value={f.id}>
						{f.ad}
					</option>
				))}
			</select>

			{hata && (
				<span role="alert" className="text-xs text-hata">
					{hata}
				</span>
			)}
		</label>
	);
}
