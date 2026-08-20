import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { EksikFormu } from './bilesenler/EksikFormu';
import { EksikListesi } from './bilesenler/EksikListesi';

export const metadata: Metadata = { title: 'Eksikler — Karas Panel' };
export const dynamic = 'force-dynamic';

export type EksikSatiri = {
	id: string;
	metin: string;
	aciklama: string;
	acil: boolean;
	durum: 'bekliyor' | 'giderildi' | 'iptal';
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

			<div className="mt-10">
				<EksikListesi
					bekleyen={bekleyen}
					kapanan={kapanan}
					yonetici={yonetici}
				/>
			</div>
		</div>
	);
}
