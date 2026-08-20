import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { bugun } from '@/lib/ortak/tarih';
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

/** Gün sayısına göre geriye giden tarih, 'YYYY-MM-DD'. */
function gunOnce(sayi: number): string {
	const d = new Date(bugun() + 'T12:00:00');
	d.setDate(d.getDate() - sayi);
	return d.toLocaleDateString('en-CA');
}

export default async function KrokiSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ aralik?: string }>;
}) {
	await yetkiDenetle('ptp', 'yonetim');

	const { aralik } = await searchParams;
	const gun = aralik === '7' ? 7 : aralik === '90' ? 90 : 30;
	const baslangic = gunOnce(gun);

	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const [bolgeSonucu, yogunlukSonucu] = await Promise.all([
		supabase
			.from('ptp_bolumler')
			.select('id, ad, kroki_x, kroki_y, kroki_en, kroki_boy')
			.eq('firma_id', firmaId)
			.is('silindi', null)
			.order('ad'),

		supabase
			.from('ptp_bolge_yogunlugu')
			.select('bolge_id, adet')
			.eq('firma_id', firmaId)
			.gte('tarih', baslangic),
	]);

	const bolgeler = (bolgeSonucu.data ?? []) as BolgeSatiri[];

	/* Aynı bölge birden çok güne yayılmış satırlarla geliyor; toplama
	   burada yapılıyor. Veri tabanında gün kırılımı korunuyor çünkü
	   ileride "hangi gün" sorusu da sorulacak. */
	const yogunluk = new Map<string, number>();
	for (const satir of yogunlukSonucu.data ?? []) {
		const s = satir as { bolge_id: string; adet: number };
		yogunluk.set(s.bolge_id, (yogunluk.get(s.bolge_id) ?? 0) + Number(s.adet));
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
				{[
					{ deger: '7', ad: '7 gün' },
					{ deger: '30', ad: '30 gün' },
					{ deger: '90', ad: '90 gün' },
				].map((s) => (
					<Link
						key={s.deger}
						href={`/ptp/kroki?aralik=${s.deger}`}
						className={`border px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
							String(gun) === s.deger
								? 'border-vurgu-metin bg-vurgu-metin text-zemin'
								: 'border-kenarlik text-metin-3 hover:border-metin hover:text-metin'
						}`}
					>
						{s.ad}
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
