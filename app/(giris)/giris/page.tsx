import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GirisFormu } from '@/bilesenler/arayuz/GirisFormu';
import { supabaseAyarli } from '@/lib/supabase/ayar';

export const metadata: Metadata = { title: 'Giriş — Karas Panel' };

export default function GirisSayfasi() {
	const ayarli = supabaseAyarli();

	return (
		<>
			<h1 className="text-2xl font-semibold tracking-[-0.015em]">
				Takip Paneli
			</h1>
			<p className="mt-2 text-sm leading-relaxed text-metin-2">
				Devam etmek için giriş yapın.
			</p>

			<div className="mt-8">
				{ayarli ? (
					/* useSearchParams kullandığı için Suspense şart */
					<Suspense fallback={<GirisIskeleti />}>
						<GirisFormu />
					</Suspense>
				) : (
					<YapilandirmaEksik />
				)}
			</div>
		</>
	);
}

function GirisIskeleti() {
	return (
		<div className="animate-pulse">
			<div className="h-3 w-16 bg-zemin-3" />
			<div className="mt-2.5 h-[3rem] border border-kenarlik bg-zemin-2" />
			<div className="mt-5 h-3 w-12 bg-zemin-3" />
			<div className="mt-2.5 h-[3rem] border border-kenarlik bg-zemin-2" />
			<div className="mt-7 h-[3rem] bg-zemin-3" />
		</div>
	);
}

/* Anahtarlar girilmeden önce görünen durum. Beyaz bir hata sayfası
   yerine ne eksik olduğunu ve nereye yazılacağını söyler. */
function YapilandirmaEksik() {
	return (
		<div className="kose-nisan border border-kenarlik p-5">
			<span className="etiket text-uyari">Yapılandırma eksik</span>
			<p className="mt-3 text-sm leading-relaxed text-metin-2">
				Supabase bağlantı bilgileri tanımlı değil, bu yüzden giriş
				yapılamıyor. Aşağıdaki iki değer hem <code>.env.local</code>{' '}
				dosyasına hem Vercel ortam değişkenlerine girilmeli:
			</p>
			<ul className="mt-4 space-y-1.5 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
				<li>NEXT_PUBLIC_SUPABASE_URL</li>
				<li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
			</ul>
			<p className="mt-4 text-xs leading-relaxed text-metin-3">
				Vercel'e eklendikten sonra yeniden yayın gerekir — değerler
				derleme sırasında koda gömülüyor.
			</p>
		</div>
	);
}
