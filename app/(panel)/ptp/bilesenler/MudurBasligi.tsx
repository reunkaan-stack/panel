import Link from 'next/link';

/* Müdür başlığı: özet ve yönetim bağlantıları.

   "Günü oluştur" düğmesi KALDIRILDI. Görev artık üretilmiyor; hangi
   görevin bugün geçerli olduğu tanımdan hesaplanıyor. Basılacak bir
   düğme yok çünkü yapılacak bir üretim yok. */

export function MudurBasligi({
	gorevSayisi,
	kisiSayisi,
	tarih,
}: {
	gorevSayisi: number;
	kisiSayisi: number;
	tarih: string;
}) {
	return (
		<div className="mt-6 flex flex-col gap-4 border border-kenarlik p-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<span className="etiket">Yönetici görünümü</span>
				<p className="mt-1.5 text-sm text-metin-2">
					Bugün {gorevSayisi} görev · {kisiSayisi} kişi
				</p>
			</div>

			<div className="flex flex-wrap gap-3">
				<Link href="/ptp/gorevler" className="dugme dugme-bos">
					Görev tanımları
				</Link>
				<Link href="/ptp/kroki" className="dugme dugme-bos">
					Kroki
				</Link>
				<Link href="/ptp/ciro" className="dugme dugme-bos">
					Ciro
				</Link>
				<Link href={`/ptp/rapor?tarih=${tarih}`} className="dugme dugme-bos">
					Performans
				</Link>
			</div>
		</div>
	);
}
