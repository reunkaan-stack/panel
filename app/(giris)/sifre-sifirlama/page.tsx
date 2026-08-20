import type { Metadata } from 'next';
import { SifreSifirlamaFormu } from '@/bilesenler/arayuz/SifreSifirlamaFormu';
import { supabaseAyarli } from '@/lib/supabase/ayar';

export const metadata: Metadata = { title: 'Şifre sıfırlama — Karas Panel' };

export default function SifreSifirlamaSayfasi() {
	return (
		<>
			<h1 className="text-2xl font-semibold tracking-[-0.015em]">
				Şifre sıfırlama
			</h1>
			<p className="mt-2 text-sm leading-relaxed text-metin-2">
				E-posta adresinizi girin; sıfırlama bağlantısını gönderelim.
			</p>

			<div className="mt-8">
				{supabaseAyarli() ? (
					<SifreSifirlamaFormu />
				) : (
					<p className="border border-kenarlik px-4 py-3 text-sm text-metin-2">
						Supabase bağlantısı tanımlı olmadığı için bu işlem şu anda
						yapılamıyor.
					</p>
				)}
			</div>

			<p className="mt-6 text-center">
				<a
					href="/giris"
					className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
				>
					Girişe dön
				</a>
			</p>
		</>
	);
}
