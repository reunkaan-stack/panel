import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import type { GorevGrubu, GorevTuru, Tekrar } from '@/lib/tipler';
import { SablonYonetimi } from './bilesenler/SablonYonetimi';

export const metadata: Metadata = { title: 'Görev tanımları — Karas Panel' };
export const dynamic = 'force-dynamic';

export type SablonSatiri = {
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
	maddeler: { id: string; metin: string; sira: number }[];
};

export default async function GorevTanimlariSayfasi() {
	/* Görev tanımı yalnızca yöneticinin işi. Personel bu adresi
	   denerse yetkiDenetle hata fırlatır ve hata sınırına düşer. */
	await yetkiDenetle('ptp', 'yonetim');

	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const { data } = await supabase
		.from('ptp_sablonlar')
		.select('*, maddeler:ptp_sablon_maddeleri(id, metin, sira)')
		.eq('firma_id', firmaId)
		.is('silindi', null)
		.order('grup')
		.order('sira');

	const sablonlar = (data ?? []) as unknown as SablonSatiri[];

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Tanımlar</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Görev şablonları
			</h1>
			<p className="mt-2 max-w-lg text-sm leading-relaxed text-metin-2">
				Her sabah bu tanımlardan o güne ait görevler üretilir. Buradaki
				değişiklik geçmiş günleri etkilemez.
			</p>

			<div className="mt-8">
				<SablonYonetimi sablonlar={sablonlar} />
			</div>
		</div>
	);
}
