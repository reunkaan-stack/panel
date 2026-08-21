import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import type { GorevGrubu, GorevTuru, Tekrar } from '@/lib/tipler';
import { GorevYonetimi } from './bilesenler/GorevYonetimi';

export const metadata: Metadata = { title: 'Görev tanımları — Karas Panel' };
export const dynamic = 'force-dynamic';

export type GorevTanimi = {
	id: string;
	baslik: string;
	tur: GorevTuru;
	grup: GorevGrubu;
	sira: number;
	zorunlu: boolean;
	tekrarlanabilir: boolean;
	fotograf_ister: boolean;
	ipucu: string;
	aktif: boolean;
	tekrar: Tekrar;
	tekrar_gunleri: number[];
	tek_tarih: string | null;
	atanan_id: string | null;
	maddeler: { id: string; metin: string; sira: number }[];
};

export default async function GorevTanimlariSayfasi() {
	/* Görev tanımı yalnızca yöneticinin işi. Personel bu adresi
	   denerse yetkiDenetle hata fırlatır ve hata sınırına düşer. */
	await yetkiDenetle('ptp', 'yonetim');

	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const [tanimSonuc, kisiSonuc] = await Promise.all([
		supabase
			.from('ptp_gorevler')
			.select('*, maddeler:ptp_gorev_maddeleri(id, metin, sira)')
			.eq('firma_id', firmaId)
			.is('silindi', null)
			.order('grup')
			.order('sira'),

		supabase
			.from('kullanicilar')
			.select('id, ad')
			.eq('firma_id', firmaId)
			.eq('aktif', true)
			.is('silindi', null)
			.order('ad'),
	]);

	const tanimlar = (tanimSonuc.data ?? []) as unknown as GorevTanimi[];
	const kisiler = (kisiSonuc.data ?? []) as { id: string; ad: string }[];

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Tanımlar</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Görev tanımları
			</h1>
			<p className="mt-2 max-w-lg text-sm leading-relaxed text-metin-2">
				Her sabah bu tanımlardan o güne ait görevler üretilir. Buradaki
				değişiklik geçmiş günleri etkilemez.
			</p>

			<div className="mt-8">
				<GorevYonetimi tanimlar={tanimlar} kisiler={kisiler} />
			</div>
		</div>
	);
}
