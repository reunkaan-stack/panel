import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle } from '@/lib/yetki';
import type { Teklif, TeklifKalemi } from '@/lib/teklif';
import { TeklifDuzenle } from '../bilesenler/TeklifDuzenle';

export const metadata: Metadata = { title: 'Teklif — Karas Panel' };
export const dynamic = 'force-dynamic';

export default async function TeklifSayfasi({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await superadminDenetle();
	const { id } = await params;
	const supabase = await sunucuIstemcisi();

	const [teklifSonuc, kalemSonuc] = await Promise.all([
		supabase
			.from('teklifler')
			.select('*')
			.eq('id', id)
			.is('silindi', null)
			.maybeSingle(),
		supabase
			.from('teklif_kalemleri')
			.select('*')
			.eq('teklif_id', id)
			.order('sira'),
	]);

	if (!teklifSonuc.data) notFound();

	const teklif = teklifSonuc.data as Teklif;
	const kalemler = (kalemSonuc.data ?? []) as TeklifKalemi[];

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/teklifler" className="etiket text-metin-3 hover:text-metin">
				← Teklifler
			</Link>

			<TeklifDuzenle teklif={teklif} kalemler={kalemler} />
		</div>
	);
}
