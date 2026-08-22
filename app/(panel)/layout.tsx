import { redirect } from 'next/navigation';
import { AltBilgi } from '@/bilesenler/arayuz/AltBilgi';
import { TemaSecici } from '@/bilesenler/arayuz/TemaSecici';
import { CikisDugmesi } from '@/bilesenler/panel/CikisDugmesi';
import { supabaseAyarli } from '@/lib/supabase/ayar';
import { oturumdakiKullanici } from '@/lib/supabase/sunucu';

/* Panel kabuğu — oturum zorunlu.

   Orta katman da yönlendirme yapıyor ama denetim burada TEKRARLANIR:
   tek bir yönlendirme hatasının bütün korumayı kaldırmaması için.
   Bkz. standartlar/02-GUVENLIK.md */
export default async function PanelDuzeni({
	children,
}: {
	children: React.ReactNode;
}) {
	/* Yapılandırma yoksa oturum da olamaz; kullanıcı giriş ekranını
	   görsün ve eksiğin ne olduğunu okusun. */
	if (!supabaseAyarli()) redirect('/giris');

	const kullanici = await oturumdakiKullanici();
	if (!kullanici) redirect('/giris');

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between gap-4 border-b border-kenarlik px-6 py-4">
				<span className="etiket text-vurgu-metin">Takip Paneli</span>

				<div className="flex items-center gap-4">
					<span className="hidden font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3 sm:inline">
						{kullanici.email}
					</span>
					<TemaSecici />
					<CikisDugmesi />
				</div>
			</header>

			<main className="flex-1">{children}</main>

			<AltBilgi />
		</div>
	);
}
