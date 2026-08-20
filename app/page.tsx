import { TemaSecici } from '@/bilesenler/arayuz/TemaSecici';

/* Geçici karşılama sayfası.

   Görevi, alt alan adının ve yayın hattının çalıştığını doğrulamak.
   Giriş ekranı `app/(giris)/` altına yazıldığında burası ona
   yönlendirilecek ve bu dosya silinecek. */

const moduller = [
	{ kod: 'ptp', ad: 'Personel Takip', durum: 'kuruluyor' },
	{ kod: 'otp', ad: 'Ödeme Takip', durum: 'sırada' },
	{ kod: 'ttp', ad: 'Tahsilat Takip', durum: 'sırada' },
	{ kod: 'mtp', ad: 'Mağaza Takip', durum: 'sırada' },
] as const;

export default function Karsilama() {
	return (
		<main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
			<div className="flex items-start justify-between gap-6">
				<span className="etiket text-vurgu">Karas Teknoloji</span>
				<TemaSecici />
			</div>

			<h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-5xl">
				Takip Paneli
			</h1>

			<p className="mt-5 max-w-xl leading-relaxed text-metin-2">
				İşletme yazılımlarınız tek girişte, tek ekranda. Panel şu anda
				kuruluyor; hazır olduğunda buradan giriş yapacaksınız.
			</p>

			<div className="kose-nisan mt-12 border border-kenarlik">
				<ul>
					{moduller.map((modul, i) => (
						<li
							key={modul.kod}
							className={`flex items-center gap-4 px-5 py-4 ${
								i > 0 ? 'border-t border-kenarlik-2' : ''
							}`}
						>
							<span
								className="w-10 font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-vurgu"
								aria-hidden="true"
							>
								{String(i + 1).padStart(2, '0')}
							</span>
							<span className="flex-1 font-medium">{modul.ad}</span>
							<span className="etiket">{modul.durum}</span>
						</li>
					))}
				</ul>
			</div>

			<p className="mt-10 font-mono text-[0.75rem] tracking-[0.04em] text-metin-3">
				karasteknoloji.com
			</p>
		</main>
	);
}
