import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/* Yazı tipleri Next tarafından indirilip kendi sunucumuzdan servis
   edilir — Google'a istek gitmez. latin-ext altkümesi Türkçe
   karakterler (ğ ş ı İ) için zorunlu. */
const plexSans = IBM_Plex_Sans({
	variable: '--font-plex-sans',
	subsets: ['latin', 'latin-ext'],
	weight: ['400', '500', '600', '700'],
	display: 'swap',
});

const plexMono = IBM_Plex_Mono({
	variable: '--font-plex-mono',
	subsets: ['latin', 'latin-ext'],
	weight: ['400', '500', '600'],
	display: 'swap',
});

export const metadata: Metadata = {
	title: 'Karas Panel',
	description: 'İşletme yazılımlarınız tek girişte.',
	/* Panel arama motorlarında görünmez — müşteri verisi barındıran
	   bir uygulamanın dizine girmesi için hiçbir sebep yok. */
	robots: { index: false, follow: false },
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#faf9f6' },
		{ media: '(prefers-color-scheme: dark)', color: '#14140f' },
	],
};

/* Tema, sayfa boyanmadan ÖNCE uygulanmalı; yoksa karanlık modda bir
   kare beyaz parlar. React yüklenmeden çalışması gerektiği için satır
   içi betik zorunlu.

   Üç durum: kayıt yoksa sistem tercihine uyulur (kökte data-tema
   bulunmaz), varsa kullanıcının açık seçimi uygulanır. */
const temaBetigi = `
try {
  var t = localStorage.getItem('karas-tema');
  if (t === 'acik' || t === 'karanlik') {
    document.documentElement.setAttribute('data-tema', t);
  }
} catch (e) {}
`;

export default function KokDuzen({ children }: { children: React.ReactNode }) {
	return (
		<html
			lang="tr"
			className={`${plexSans.variable} ${plexMono.variable}`}
			suppressHydrationWarning
		>
			<head>
				<script dangerouslySetInnerHTML={{ __html: temaBetigi }} />
			</head>
			<body className="min-h-screen bg-zemin text-metin">{children}</body>
		</html>
	);
}
