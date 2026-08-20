'use client';

import { useState, useTransition } from 'react';
import { gunuOlustur } from '../eylemler';

/* Müdür başlığı: gün oluşturma ve ekip özeti.

   "Günü oluştur" ileride her sabah pg_cron ile otomatik çalışacak.
   Düğme, ilk kurulum ve şablon değişikliği sonrası elle tetiklemek için
   duruyor — otomatik iş de bu aynı fonksiyonu çağıracak, iş mantığı
   tek yerde kalsın diye. */

export function MudurBasligi({
	tarih,
	gorevSayisi,
	kisiler,
}: {
	tarih: string;
	gorevSayisi: number;
	kisiler: { id: string; ad: string }[];
}) {
	const [bekliyor, basla] = useTransition();
	const [mesaj, setMesaj] = useState<string | null>(null);
	const [hata, setHata] = useState<string | null>(null);

	function olustur() {
		setMesaj(null);
		setHata(null);
		basla(async () => {
			try {
				const adet = await gunuOlustur(tarih);
				setMesaj(
					adet === 0
						? 'Eklenecek yeni görev yok — bu günün görevleri zaten oluşturulmuş.'
						: `${adet} görev oluşturuldu.`
				);
			} catch (e) {
				setHata(e instanceof Error ? e.message : 'Oluşturulamadı');
			}
		});
	}

	return (
		<div className="mt-6 flex flex-col gap-4 border border-kenarlik p-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<span className="etiket">Yönetici görünümü</span>
				<p className="mt-1.5 text-sm text-metin-2">
					{gorevSayisi} görev · {kisiler.length} kişi
				</p>
			</div>

			<div className="shrink-0">
				<button
					type="button"
					onClick={olustur}
					disabled={bekliyor}
					className="dugme dugme-bos"
				>
					{bekliyor ? 'Oluşturuluyor…' : 'Günü oluştur'}
				</button>
			</div>

			{(mesaj || hata) && (
				<p
					role="status"
					className={`w-full text-sm ${hata ? 'text-hata' : 'text-metin-2'}`}
				>
					{hata ?? mesaj}
				</p>
			)}
		</div>
	);
}
