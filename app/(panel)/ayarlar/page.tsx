import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici } from '@/lib/yetki';
import { DUGUMLER } from '@/lib/harita/veri';

export const metadata: Metadata = { title: 'Ayarlar — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Ayarlar merkezi.

   Süperadminin sistemi yönettiği tek kapı. Her ekran ayrı bir yerden
   girilseydi "bunu nereden yapıyordum" sorusu her seferinde
   sorulurdu.

   Sayaçlar bilerek var: kapıyı açmadan içeride ne olduğu görünsün. */

const DUGUM_SAYISI = DUGUMLER.length;

export default async function AyarlarSayfasi() {
	const kullanici = await aktifKullanici();
	const superadmin = kullanici.rol === 'superadmin';
	const supabase = await sunucuIstemcisi();

	const [firmaSonuc, kisiSonuc, teklifSonuc, botSonuc] = await Promise.all([
		supabase
			.from('firmalar')
			.select('id, aktif', { count: 'exact' })
			.is('silindi', null),
		supabase
			.from('kullanicilar')
			.select('id, aktif', { count: 'exact' })
			.is('silindi', null),
		supabase
			.from('teklifler')
			.select('id', { count: 'exact', head: true })
			.eq('durum', 'taslak')
			.is('silindi', null),
		supabase.from('telegram_ayarlari').select('aktif'),
	]);

	const firmalar = (firmaSonuc.data ?? []) as { aktif: boolean }[];
	const kisiler = (kisiSonuc.data ?? []) as { aktif: boolean }[];
	const botlar = (botSonuc.data ?? []) as { aktif: boolean }[];

	const kartlar = [
		{
			yol: '/ayarlar/firmalar',
			ad: 'Firmalar',
			aciklama: 'Firma ekle, modüllerini aç, pasife al',
			deger: `${firmalar.filter((f) => f.aktif).length} aktif firma`,
			superadminGerekir: true,
		},
		{
			yol: '/kisiler',
			ad: 'Kişiler',
			aciklama: 'Hesap aç, yetki ver, şifre değiştir',
			deger: `${kisiler.filter((k) => k.aktif).length} aktif kişi`,
			superadminGerekir: true,
		},
		{
			yol: '/ayarlar/bildirimler',
			ad: 'Bildirimler',
			aciklama: 'Telegram bağlantısı ve hangi olayda haber verileceği',
			deger: botlar.some((b) => b.aktif)
				? 'Telegram açık'
				: 'Telegram kapalı',
			superadminGerekir: false,
		},
		{
			yol: '/teklifler',
			ad: 'Teklifler',
			aciklama: 'Müşteri adayına fiyat teklifi hazırla ve PDF gönder',
			deger: `${teklifSonuc.count ?? 0} taslak`,
			superadminGerekir: true,
		},
		{
			yol: '/rapor',
			ad: 'Genel bakış',
			aciklama: 'Bütün firmaların durumu tek ekranda',
			deger: `${firmalar.length} firma`,
			superadminGerekir: true,
		},
		{
			yol: '/ayarlar/harita',
			ad: 'Site haritası',
			aciklama: 'Ne nerede, ne neye bağlı, ne çalışmıyor, sırada ne var',
			deger: `${DUGUM_SAYISI} düğüm`,
			superadminGerekir: true,
		},
	].filter((k) => superadmin || !k.superadminGerekir);

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link href="/" className="etiket text-metin-3 hover:text-metin">
				← Panel
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">
				{superadmin ? 'Süperadmin' : 'Yönetim'}
			</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Ayarlar
			</h1>

			<ul className="kose-nisan mt-8 border border-kenarlik">
				{kartlar.map((k, i) => (
					<li key={k.yol} className={i > 0 ? 'border-t border-kenarlik-2' : ''}>
						<Link
							href={k.yol}
							className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-zemin-2"
						>
							<span
								className="w-8 shrink-0 font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-vurgu-metin"
								aria-hidden="true"
							>
								{String(i + 1).padStart(2, '0')}
							</span>
							<div className="min-w-0 flex-1">
								<p className="font-medium">{k.ad}</p>
								<p className="mt-0.5 text-sm text-metin-2">{k.aciklama}</p>
							</div>
							<span className="etiket shrink-0 text-right">{k.deger}</span>
						</Link>
					</li>
				))}
			</ul>
		</div>
	);
}
