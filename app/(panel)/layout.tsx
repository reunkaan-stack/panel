import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AltBilgi } from '@/bilesenler/arayuz/AltBilgi';
import { TemaSecici } from '@/bilesenler/arayuz/TemaSecici';
import { CikisDugmesi } from '@/bilesenler/panel/CikisDugmesi';
import { FirmaSecici } from '@/bilesenler/panel/FirmaSecici';
import { supabaseAyarli } from '@/lib/supabase/ayar';
import { oturumdakiKullanici } from '@/lib/supabase/sunucu';
import { superadminMi } from '@/lib/yetki';
import { secilebilirFirmalar, seciliFirma } from '@/lib/yetki/firma';

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

	/* Kişi yönetimi modüllerin üstünde durur; bağlantı yalnızca
	   süperadminde görünür. */
	const superadmin = await superadminMi();

	/* Birden çok firma varsa süperadmin hangisi adına çalıştığını
	   seçer. Seçici başlıkta duruyor: her ekran bu seçime bağlı,
	   tek bir sayfaya koymak yetmezdi. */
	const [firmalar, aktifFirma] = await Promise.all([
		secilebilirFirmalar(),
		seciliFirma(),
	]);

	return (
		<div className="flex min-h-screen flex-col">
			<header className="flex items-center justify-between gap-4 border-b border-kenarlik px-6 py-4">
				{/* Ana sayfaya dönüş. Modül içindeyken — özellikle ÖTP
				    çerçevesinin içinde — panele dönecek bir yol yoktu;
				    kullanıcı tarayıcının geri düğmesine kalıyordu. */}
				<Link
					/* ?menu=1 — tek modüllü kullanıcıda ana sayfa yine o
					   modüle atıyordu; bu bağlantı listeyi zorluyor. */
					href="/?menu=1"
					className="etiket text-vurgu-metin transition-colors hover:text-metin"
					title="Panel ana sayfası"
				>
					Takip Paneli
				</Link>

				<div className="flex items-center gap-4">
					<FirmaSecici firmalar={firmalar} secili={aktifFirma} />
					{/* Tek kapı: ayrı ayrı bağlantı koymak üst çubuğu
					    şişiriyordu ve "bunu nereden yapıyordum" sorusunu
					    her seferinde doğuruyordu. */}
					<Link
						href="/ayarlar"
						className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 hover:text-metin"
					>
						Ayarlar
					</Link>
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
