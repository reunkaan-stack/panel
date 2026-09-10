import type { Metadata } from 'next';
import Link from 'next/link';
import { superadminDenetle } from '@/lib/yetki';
import {
	BEKLEYENLER,
	DUGUMLER,
	MODUL_ADLARI,
	NEREYE_BAK,
	OLU_TABLOLAR,
	ONCELIK_ADLARI,
	TUZAKLAR,
	type Oncelik,
} from '@/lib/harita/veri';
import { Diyagram } from './bilesenler/Diyagram';

export const metadata: Metadata = { title: 'Site haritası — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Panel haritası.

   YALNIZCA SÜPERADMİN: sayfa açık açık "şu çalışmıyor", "yedek yok",
   "şu yarım kaldı" yazıyor. Müşteri firmaların yöneticilerinin
   görmesi gereken şeyler değil.

   İçerik lib/harita/veri.ts dosyasından geliyor ve o dosya
   npm run kontrol ile koda karşı denetleniyor: yeni sayfa, tablo ya
   da eylem eklenip haritaya yazılmazsa denetim düşüyor. Kurumsal
   sitede "haritayı güncelle" kuralı yazılıydı ve harita yine de
   aylarca bayatladı; kural yetmiyor. */

export default async function HaritaSayfasi() {
	await superadminDenetle();

	const sorunlular = DUGUMLER.filter((d) => d.sorun);
	const oncelikSirasi: Oncelik[] = ['risk', 'yarim', 'yeni'];

	return (
		<div className="mx-auto max-w-5xl px-6 py-10">
			<Link href="/ayarlar" className="etiket text-metin-3 hover:text-metin">
				← Ayarlar
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Site haritası</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Ne nerede, ne neye bağlı
			</h1>
			<p className="mt-3 max-w-2xl text-sm leading-relaxed text-metin-2">
				Panelin bütün parçaları, aralarındaki bağlar ve bunların{' '}
				<strong>neden</strong> öyle yapıldığı. Bir işe başlamadan önce buraya
				bakmak, kodu yeniden keşfetmekten hızlı.
			</p>

			<div className="kose-nisan mt-8 grid gap-6 border border-kenarlik p-6 sm:grid-cols-4">
				<Kutu etiket="Düğüm" deger={String(DUGUMLER.length)} />
				<Kutu etiket="Modül" deger={String(Object.keys(MODUL_ADLARI).length)} />
				<Kutu
					etiket="Sorunlu"
					deger={String(sorunlular.length)}
					vurgu={sorunlular.length > 0}
				/>
				<Kutu etiket="Bekleyen iş" deger={String(BEKLEYENLER.length)} />
			</div>

			{/* — Diyagram — */}
			<section className="mt-12">
				<span className="etiket">Bağlantı ağı</span>
				<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
					Parçalar birbirine nasıl bağlı
				</h2>
				<div className="mt-4">
					<Diyagram />
				</div>
			</section>

			{/* — Nereye bakılır — */}
			<section className="mt-14">
				<span className="etiket">Kısayol</span>
				<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
					“Şunu yapmak istiyorum” → nereye bakılır
				</h2>
				<p className="mt-2 max-w-2xl text-sm leading-relaxed text-metin-3">
					Haritanın en çok iş gören kısmı burası. Kod aramadan önce bu tabloya
					bakın.
				</p>

				<div className="mt-4 space-y-px border border-kenarlik bg-kenarlik">
					{NEREYE_BAK.map((y) => (
						<div key={y.istek} className="bg-zemin p-4">
							<p className="text-sm font-medium">{y.istek}</p>
							<p className="mt-1.5 font-mono text-[0.6875rem] leading-relaxed tracking-[0.02em] text-metin-2">
								{y.yer}
							</p>
							{y.not && (
								<p className="mt-1.5 text-sm leading-relaxed text-metin-3">
									{y.not}
								</p>
							)}
						</div>
					))}
				</div>
			</section>

			{/* — Neden olmuyor — */}
			{sorunlular.length > 0 && (
				<section className="mt-14">
					<span className="etiket text-uyari">Neden olmuyor</span>
					<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
						Çalışmayan ya da yarım kalan yerler
					</h2>

					<ul className="mt-4 space-y-px border border-uyari bg-kenarlik">
						{sorunlular.map((d) => (
							<li key={d.kod} className="bg-zemin p-4">
								<div className="flex flex-wrap items-baseline gap-x-3">
									<p className="text-sm font-medium">{d.ad}</p>
									<span className="etiket text-metin-3">
										{MODUL_ADLARI[d.modul]}
									</span>
								</div>
								<p className="mt-1.5 text-sm leading-relaxed text-metin-2">
									{d.sorun}
								</p>
							</li>
						))}
					</ul>
				</section>
			)}

			{/* — Bekleyen işler — */}
			<section className="mt-14">
				<span className="etiket">Sırada</span>
				<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
					Bekleyen işler
				</h2>

				{oncelikSirasi.map((o) => {
					const grup = BEKLEYENLER.filter((b) => b.oncelik === o);
					if (grup.length === 0) return null;

					return (
						<div key={o} className="mt-6">
							<span
								className={`etiket ${o === 'risk' ? 'text-hata' : o === 'yarim' ? 'text-uyari' : 'text-metin-3'}`}
							>
								{ONCELIK_ADLARI[o]} · {grup.length}
							</span>
							<ul className="mt-3 space-y-px border border-kenarlik bg-kenarlik">
								{grup.map((b) => (
									<li key={b.baslik} className="bg-zemin p-4">
										<div className="flex flex-wrap items-baseline gap-x-3">
											<p className="text-sm font-medium">{b.baslik}</p>
											<span className="etiket text-metin-3">
												{MODUL_ADLARI[b.modul]}
											</span>
										</div>
										<p className="mt-1.5 text-sm leading-relaxed text-metin-2">
											{b.neden}
										</p>
										{b.engel && (
											<p className="mt-1.5 text-sm leading-relaxed text-uyari">
												Engel: {b.engel}
											</p>
										)}
									</li>
								))}
							</ul>
						</div>
					);
				})}
			</section>

			{/* — Tuzaklar — */}
			<section className="mt-14">
				<span className="etiket">Hafıza</span>
				<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
					Tuzaklar — hepsi yaşandı
				</h2>
				<p className="mt-2 max-w-2xl text-sm leading-relaxed text-metin-3">
					Her biri en az bir kez zaman kaybettirdi. Yeniden düşmemek için
					duruyorlar.
				</p>

				<ol className="mt-4 space-y-px border border-kenarlik bg-kenarlik">
					{TUZAKLAR.map((t, i) => (
						<li key={t.baslik} className="bg-zemin p-4">
							<div className="flex gap-3">
								<span className="shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] text-metin-3">
									{String(i + 1).padStart(2, '0')}
								</span>
								<div>
									<p className="text-sm font-medium">{t.baslik}</p>
									<p className="mt-1.5 text-sm leading-relaxed text-metin-3">
										{t.olan}
									</p>
									<p className="mt-1.5 text-sm leading-relaxed text-metin-2">
										→ {t.kural}
									</p>
								</div>
							</div>
						</li>
					))}
				</ol>
			</section>

			{/* — Ölü tablolar — */}
			<section className="mt-14">
				<span className="etiket">Dikkat</span>
				<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
					Artık olmayan tablolar
				</h2>
				<p className="mt-2 max-w-2xl text-sm leading-relaxed text-metin-3">
					Eski migration dosyalarında adları geçiyor. Kod aramasında çıkarlar
					ama <strong>canlı değiller</strong> — yanlış tabloya bakmak buradan
					başlıyor.
				</p>

				<ul className="mt-4 space-y-px border border-kenarlik bg-kenarlik">
					{OLU_TABLOLAR.map((t) => (
						<li key={t.ad} className="flex flex-wrap gap-x-3 bg-zemin p-3">
							<span className="font-mono text-[0.6875rem] tracking-[0.02em] text-metin-3 line-through">
								{t.ad}
							</span>
							<span className="text-sm text-metin-2">{t.ne_oldu}</span>
						</li>
					))}
				</ul>
			</section>

			<p className="mt-14 border-t border-kenarlik pt-6 text-sm leading-relaxed text-metin-3">
				Bu sayfanın kaynağı{' '}
				<span className="font-mono text-[0.6875rem]">lib/harita/veri.ts</span>.
				Yeni ekran, tablo, uç ya da sunucu eylemi eklenip oraya yazılmazsa{' '}
				<span className="font-mono text-[0.6875rem]">npm run kontrol</span>{' '}
				düşer — harita bayatlayamaz.
			</p>
		</div>
	);
}

function Kutu({
	etiket,
	deger,
	vurgu,
}: {
	etiket: string;
	deger: string;
	vurgu?: boolean;
}) {
	return (
		<div>
			<span className="etiket">{etiket}</span>
			<p
				className={`mt-1.5 text-2xl font-semibold tabular-nums ${vurgu ? 'text-uyari' : ''}`}
			>
				{deger}
			</p>
		</div>
	);
}
