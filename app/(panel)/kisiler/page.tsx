import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yonetimAyarli } from '@/lib/supabase/yonetim';
import { superadminDenetle } from '@/lib/yetki';
import type { Modul, Rol, Seviye } from '@/lib/tipler';
import { KisiYonetimi } from './bilesenler/KisiYonetimi';

export const metadata: Metadata = { title: 'Kişiler — Karas Panel' };
export const dynamic = 'force-dynamic';

export type KisiSatiri = {
	id: string;
	ad: string;
	eposta: string;
	rol: Rol;
	firma_id: string | null;
	aktif: boolean;
	son_giris: string | null;
	olusturuldu: string;
};

export type Firma = { id: string; ad: string; kisa_ad: string };
export type YetkiSatiri = {
	kullanici_id: string;
	modul: Modul;
	seviye: Seviye;
};

export default async function KisilerSayfasi() {
	const ben = await superadminDenetle();
	const supabase = await sunucuIstemcisi();

	const [kisiSonuc, firmaSonuc, yetkiSonuc] = await Promise.all([
		supabase
			.from('kullanicilar')
			.select('id, ad, eposta, rol, firma_id, aktif, son_giris, olusturuldu')
			.is('silindi', null)
			.order('aktif', { ascending: false })
			.order('ad'),

		supabase.from('firmalar').select('id, ad, kisa_ad').order('ad'),

		supabase.from('modul_yetkileri').select('kullanici_id, modul, seviye'),
	]);

	const kisiler = (kisiSonuc.data ?? []) as KisiSatiri[];
	const firmalar = (firmaSonuc.data ?? []) as Firma[];
	const yetkiler = (yetkiSonuc.data ?? []) as YetkiSatiri[];

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/" className="etiket text-metin-3 hover:text-metin">
				← Panel
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Süperadmin</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Kişiler
			</h1>
			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Hesap açar, yetki verir, girişi kapatırsınız. Kaydı olan bir kişi
				kalıcı silinemez — pasife alınır, böylece “bu işi kim yaptı”
				sorusunun cevabı kaybolmaz.
			</p>

			{!yonetimAyarli() && (
				<div className="mt-6 border border-uyari p-4">
					<span className="etiket text-uyari">Hesap açma kapalı</span>
					<p className="mt-2 text-sm leading-relaxed text-metin-2">
						<code className="font-mono text-[0.8125rem]">
							SUPABASE_SERVICE_ROLE_KEY
						</code>{' '}
						tanımlı değil. Vercel → Settings → Environment Variables altına
						ekleyip yeniden yayınlayın. Anahtar yalnızca sunucuda kullanılıyor;
						başına <code className="font-mono">NEXT_PUBLIC_</code>{' '}
						<strong>konmamalı</strong>.
					</p>
				</div>
			)}

			{kisiSonuc.error && (
				<p className="mt-6 border border-hata px-4 py-3 text-sm text-hata">
					Kişiler okunamadı. Sayfayı yenileyin.
				</p>
			)}

			<div className="mt-8">
				<KisiYonetimi
					kisiler={kisiler}
					firmalar={firmalar}
					yetkiler={yetkiler}
					benimId={ben.id}
					acikMi={yonetimAyarli()}
				/>
			</div>
		</div>
	);
}
