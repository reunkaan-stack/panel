import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle } from '@/lib/yetki';
import type { Modul } from '@/lib/tipler';
import { FirmaYonetimi, type FirmaSatiri } from './bilesenler/FirmaYonetimi';

export const metadata: Metadata = { title: 'Firmalar — Karas Panel' };
export const dynamic = 'force-dynamic';

export default async function FirmalarSayfasi() {
	await superadminDenetle();
	const supabase = await sunucuIstemcisi();

	const [firmaSonuc, modulSonuc, kisiSonuc] = await Promise.all([
		supabase
			.from('firmalar')
			.select('id, ad, kisa_ad, aktif')
			.is('silindi', null)
			.order('ad'),
		supabase.from('firma_modulleri').select('firma_id, modul, aktif'),
		supabase
			.from('kullanicilar')
			.select('firma_id, aktif, son_giris')
			.is('silindi', null),
	]);

	type Firma = { id: string; ad: string; kisa_ad: string; aktif: boolean };
	type FirmaModul = { firma_id: string; modul: Modul; aktif: boolean };
	type Kisi = { firma_id: string | null; aktif: boolean; son_giris: string | null };

	const firmalar = (firmaSonuc.data ?? []) as Firma[];
	const modulSatirlari = (modulSonuc.data ?? []) as FirmaModul[];
	const kisiler = (kisiSonuc.data ?? []) as Kisi[];

	const satirlar: FirmaSatiri[] = firmalar.map((f) => {
		const kendi = kisiler.filter((k) => k.firma_id === f.id);

		/* En yeni giriş: "bu firma sistemi gerçekten kullanıyor mu"
		   sorusunun en doğrudan cevabı. */
		const sonGiris = kendi
			.map((k) => k.son_giris)
			.filter((t): t is string => !!t)
			.sort()
			.at(-1) ?? null;

		return {
			id: f.id,
			ad: f.ad,
			kisa_ad: f.kisa_ad,
			aktif: f.aktif,
			moduller: modulSatirlari
				.filter((m) => m.firma_id === f.id && m.aktif)
				.map((m) => m.modul),
			kullanici: kendi.length,
			aktifKullanici: kendi.filter((k) => k.aktif).length,
			sonGiris,
		};
	});

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/ayarlar" className="etiket text-metin-3 hover:text-metin">
				← Ayarlar
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Süperadmin</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Firmalar
			</h1>
			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Her firma kendi verisini görür; firmalar birbirinin verisine
				erişemez. Bu ayrım veri tabanında zorlanıyor, uygulama katmanında
				değil.
			</p>

			{firmaSonuc.error && (
				<p className="mt-6 border border-hata px-4 py-3 text-sm text-hata">
					Firmalar okunamadı. Sayfayı yenileyin.
				</p>
			)}

			<div className="mt-8">
				<FirmaYonetimi firmalar={satirlar} />
			</div>
		</div>
	);
}
