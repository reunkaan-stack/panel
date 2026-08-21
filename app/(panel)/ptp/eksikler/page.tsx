import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { EksikFormu } from './bilesenler/EksikFormu';
import { KATEGORI_ADLARI, KATEGORI_NOTU, type EksikKategori } from '@/lib/tipler';
import { EksikListesi } from './bilesenler/EksikListesi';

export const metadata: Metadata = { title: 'Eksikler — Karas Panel' };
export const dynamic = 'force-dynamic';

export type EksikSatiri = {
	id: string;
	metin: string;
	aciklama: string;
	acil: boolean;
	durum: 'bekliyor' | 'giderildi' | 'iptal';
	kategori: EksikKategori;
	kapanma_zamani: string | null;
	kapanma_notu: string;
	olusturuldu: string;
	bildiren: { ad: string } | null;
	kapatan: { ad: string } | null;
};

export default async function EksiklerSayfasi() {
	const { seviye, yonetici } = await yetkiDenetle('ptp', 'okuma');
	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const { data } = await supabase
		.from('ptp_eksikler')
		.select('*, bildiren:bildiren_id(ad), kapatan:kapatan_id(ad)')
		.eq('firma_id', firmaId)
		.is('silindi', null)
		.order('durum')
		.order('acil', { ascending: false })
		.order('olusturuldu', { ascending: false });

	const hepsi = (data ?? []) as unknown as EksikSatiri[];
	const bekleyen = hepsi.filter((e) => e.durum === 'bekliyor');
	const kapanan = hepsi.filter((e) => e.durum !== 'bekliyor');

	/* İki liste ayrı okunuyor: ürünler fuarda, temel ihtiyaçlar
	   markette toplanıyor. Tedarik yolu farklı olduğu için tek listede
	   karışmaları işi zorlaştırırdı. */
	const kategoriler: EksikKategori[] = ['urun', 'temel'];

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link
				href="/ptp"
				className="etiket text-metin-3 hover:text-metin"
			>
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Eksikler</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				{bekleyen.length > 0
					? `${bekleyen.length} eksik bekliyor`
					: 'Bekleyen eksik yok'}
			</h1>
			<p className="mt-2 max-w-lg text-sm leading-relaxed text-metin-2">
				Biten, kalmayan ya da bozulan bir şey gördüğünüzde buraya yazın.
				{yonetici && ' Temin ettikçe işaretleyin.'}
			</p>

			{seviye !== 'okuma' && (
				<div className="mt-8">
					<EksikFormu />
				</div>
			)}

			<div className="mt-10 space-y-12">
				{kategoriler.map((kategori) => {
					const kBekleyen = bekleyen.filter((e) => e.kategori === kategori);
					const kKapanan = kapanan.filter((e) => e.kategori === kategori);
					if (kBekleyen.length === 0 && kKapanan.length === 0) return null;

					return (
						<section key={kategori}>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
								<h2 className="text-xl font-semibold tracking-[-0.015em]">
									{KATEGORI_ADLARI[kategori]}
								</h2>
								<span className="etiket">
									{KATEGORI_NOTU[kategori]} · {kBekleyen.length} bekliyor
								</span>
							</div>
							<div className="mt-4">
								<EksikListesi
									bekleyen={kBekleyen}
									kapanan={kKapanan}
									yonetici={yonetici}
								/>
							</div>
						</section>
					);
				})}

				{bekleyen.length === 0 && kapanan.length === 0 && (
					<div className="kose-nisan border border-kenarlik p-8 text-center">
						<span className="etiket">Liste boş</span>
						<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
							Bekleyen eksik yok. Bir şey bittiğinde yukarıdaki kutuya yazın.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
