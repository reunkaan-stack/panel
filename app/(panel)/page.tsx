import Link from 'next/link';
import { redirect } from 'next/navigation';
import { aktifKullanici, modulSeviyesi } from '@/lib/yetki';
import type { Modul, Seviye } from '@/lib/tipler';

/* Panel ana ekranı.

   Modül listesi YETKİDEN TÜRER — buraya elle sekme eklenmez. Yeni bir
   modül geldiğinde tek yapılacak, aşağıdaki katalog satırını eklemek ve
   firmaya modülü tanımlamak. Bkz. CLAUDE.md bölüm 5. */

export const dynamic = 'force-dynamic';

const KATALOG: { kod: Modul; ad: string; aciklama: string; yol: string }[] = [
	{ kod: 'ptp', ad: 'Personel Takip', aciklama: 'Günlük iş emri ve checklist', yol: '/ptp' },
	{ kod: 'otp', ad: 'Ödeme Takip', aciklama: 'Çek, kredi, ödeme planı', yol: '/otp' },
	{ kod: 'ttp', ad: 'Tahsilat Takip', aciklama: 'Müşteri alacak takibi', yol: '/ttp' },
	{ kod: 'mtp', ad: 'Mağaza Takip', aciklama: 'Ciro, stok, hedef, prim', yol: '/mtp' },
];

const SEVIYE_ADLARI: Record<Seviye, string> = {
	okuma: 'görüntüleme',
	yazma: 'personel',
	yonetim: 'yönetici',
};

export default async function PanelAnaSayfa() {
	const kullanici = await aktifKullanici();

	const seviyeler = await Promise.all(
		KATALOG.map(async (m) => ({ ...m, seviye: await modulSeviyesi(m.kod) }))
	);
	const acikOlanlar = seviyeler.filter((m) => m.seviye !== null);

	/* Tek modüle yetkiliyse ara ekran gereksiz tıklamadır. */
	if (acikOlanlar.length === 1) redirect(acikOlanlar[0].yol);

	return (
		<div className="mx-auto max-w-3xl px-6 py-12">
			<span className="etiket">Merhaba {kullanici.ad}</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				{acikOlanlar.length > 0
					? 'Hangi modülle çalışacaksınız?'
					: 'Henüz bir modüle yetkiniz yok'}
			</h1>

			{acikOlanlar.length === 0 ? (
				<div className="kose-nisan mt-8 border border-kenarlik p-6">
					<p className="text-sm leading-relaxed text-metin-2">
						Hesabınız açık ama hiçbir modüle yetkilendirilmemiş. Firma
						yöneticinizden size yetki vermesini isteyin.
					</p>
				</div>
			) : (
				<ul className="kose-nisan mt-8 border border-kenarlik">
					{acikOlanlar.map((modul, i) => (
						<li key={modul.kod} className={i > 0 ? 'border-t border-kenarlik-2' : ''}>
							<Link
								href={modul.yol}
								className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-zemin-2"
							>
								<span
									className="w-10 shrink-0 font-mono text-[0.6875rem] font-medium tracking-[0.14em] text-vurgu-metin"
									aria-hidden="true"
								>
									{String(i + 1).padStart(2, '0')}
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-medium">{modul.ad}</p>
									<p className="mt-0.5 text-sm text-metin-2">{modul.aciklama}</p>
								</div>
								<span className="etiket shrink-0">
									{SEVIYE_ADLARI[modul.seviye as Seviye]}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
