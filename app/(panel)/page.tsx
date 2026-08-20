/* Panel ana ekranı.

   Şimdilik modül listesini gösteriyor. Modüller kurulduğunda burası
   "bugün ne yapılması gerekiyor" özetine dönüşecek — boş bir hoş
   geldiniz sayfası değil. Bkz. standartlar/05-EKRANLAR.md */

const moduller = [
	{ kod: 'ptp', ad: 'Personel Takip', aciklama: 'Günlük iş emri ve checklist', durum: 'kuruluyor' },
	{ kod: 'otp', ad: 'Ödeme Takip', aciklama: 'Çek, kredi, ödeme planı', durum: 'sırada' },
	{ kod: 'ttp', ad: 'Tahsilat Takip', aciklama: 'Müşteri alacak takibi', durum: 'sırada' },
	{ kod: 'mtp', ad: 'Mağaza Takip', aciklama: 'Ciro, stok, hedef, prim', durum: 'sırada' },
] as const;

export default function PanelAnaSayfa() {
	return (
		<div className="mx-auto max-w-3xl px-6 py-12">
			<span className="etiket">Modüller</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Hangi modülle çalışacaksınız?
			</h1>

			<div className="kose-nisan mt-8 border border-kenarlik">
				<ul>
					{moduller.map((modul, i) => (
						<li
							key={modul.kod}
							className={`flex items-center gap-4 px-5 py-4 ${
								i > 0 ? 'border-t border-kenarlik-2' : ''
							}`}
						>
							<span
								className="w-10 shrink-0 font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-vurgu-metin"
								aria-hidden="true"
							>
								{String(i + 1).padStart(2, '0')}
							</span>
							<div className="flex-1">
								<p className="font-medium">{modul.ad}</p>
								<p className="mt-0.5 text-sm text-metin-2">{modul.aciklama}</p>
							</div>
							<span className="etiket shrink-0">{modul.durum}</span>
						</li>
					))}
				</ul>
			</div>

			<p className="mt-8 text-sm leading-relaxed text-metin-3">
				Modüller sırayla devreye alınıyor. Yetkiniz olan modüller burada
				görünür; göremediğiniz bir modül varsa firma yöneticinizden yetki
				isteyin.
			</p>
		</div>
	);
}
