import { AltBilgi } from '@/bilesenler/arayuz/AltBilgi';
import { TemaSecici } from '@/bilesenler/arayuz/TemaSecici';

/* Oturumsuz sayfaların çatısı: giriş, şifre sıfırlama.
   Panel kabuğu (sekmeler, yan menü) burada yok — henüz giriş yapılmadı. */
export default function GirisDuzeni({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between border-b border-kenarlik px-6 py-4">
				<span className="etiket text-vurgu-metin">Karas Teknoloji</span>
				<TemaSecici />
			</header>

			<main className="flex flex-1 items-center justify-center px-6 py-12">
				<div className="w-full max-w-sm">{children}</div>
			</main>

			<AltBilgi />
		</div>
	);
}
