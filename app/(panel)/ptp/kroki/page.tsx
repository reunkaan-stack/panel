import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { ARALIKLAR, araligiCoz, araliginBasi, bugun } from '@/lib/ortak/tarih';
import { Kroki } from './bilesenler/Kroki';

export const metadata: Metadata = { title: 'Mağaza krokisi — Karas Panel' };
export const dynamic = 'force-dynamic';

export type BolgeSatiri = {
	id: string;
	ad: string;
	kroki_x: number | null;
	kroki_y: number | null;
	kroki_en: number | null;
	kroki_boy: number | null;
};

export default async function KrokiSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ aralik?: string }>;
}) {
	await yetkiDenetle('ptp', 'yonetim');

	const { aralik } = await searchParams;
	const gun = araligiCoz(aralik);
	const baslangic = araliginBasi(gun);

	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const [bolgeSonucu, yogunlukSonucu] = await Promise.all([
		supabase
			.from('ptp_bolumler')
			.select('id, ad, kroki_x, kroki_y, kroki_en, kroki_boy')
			.eq('firma_id', firmaId)
			.is('silindi', null)
			.order('ad'),

		supabase.rpc('ptp_bolge_yogunlugu', {
			p_firma_id: firmaId,
			p_baslangic: baslangic,
			p_bitis: bugun(),
		}),
	]);

	const bolgeler = (bolgeSonucu.data ?? []) as BolgeSatiri[];

	/* Fonksiyon bölge başına tek satır döndürüyor. */
	const yogunluk = new Map<string, number>();
	for (const satir of yogunlukSonucu.data ?? []) {
		const s = satir as { bolge_id: string; adet: number };
		yogunluk.set(s.bolge_id, Number(s.adet));
	}

	return (
		<div className="mx-auto max-w-5xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Kroki</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Mağaza planı ve temizlik yoğunluğu
			</h1>
			<p className="mt-2 max-w-2xl text-sm leading-relaxed text-metin-2">
				Bölümleri çizip adlandırın. Çizdiğiniz her kutu bir bölge olur ve
				bölge seçmeli görevlerde listede çıkar. Renk koyuluğu, o bölümün
				seçilme sayısını gösterir.
			</p>

			<div className="mt-6 flex gap-2">
				{ARALIKLAR.map((a) => (
					<Link
						key={a.deger}
						href={`/ptp/kroki?aralik=${a.deger}`}
						className={`border px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
							gun === a.gun
								? 'border-vurgu-metin bg-vurgu-metin text-zemin'
								: 'border-kenarlik text-metin-3 hover:border-metin hover:text-metin'
						}`}
					>
						{a.ad}
					</Link>
				))}
			</div>

			<div className="mt-8">
				<Kroki
					bolgeler={bolgeler}
					yogunluk={Object.fromEntries(yogunluk)}
					gunSayisi={gun}
				/>
			</div>
		</div>
	);
}
