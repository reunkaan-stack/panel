import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle, YetkisizHata } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { bugun, tarihiBicimle } from '@/lib/ortak/tarih';
import type { Bolge, GunlukGorev, Kayit } from '@/lib/tipler';
import { GunListesi } from './bilesenler/GunListesi';
import { GunuKapat } from './bilesenler/GunuKapat';
import { MudurBasligi } from './bilesenler/MudurBasligi';

export const metadata: Metadata = { title: 'Personel Takip — Karas Panel' };

/* Kullanıcıya özel veri; önbelleğe alınmaz. Çok firmalı sistemde
   yanlış önbellek, bir firmanın verisini diğerine göstermek demektir. */
export const dynamic = 'force-dynamic';

export default async function PtpSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ tarih?: string }>;
}) {
	const { kullanici, yonetici } = await yetkiDenetle('ptp', 'okuma');
	const { tarih: istenenTarih } = await searchParams;
	const tarih = /^\d{4}-\d{2}-\d{2}$/.test(istenenTarih ?? '')
		? istenenTarih!
		: bugun();

	let firmaId: string;
	try {
		firmaId = await islemFirmasi();
	} catch (e) {
		return (
			<div className="mx-auto max-w-3xl px-6 py-12">
				<span className="etiket text-uyari">Firma seçilmedi</span>
				<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
					Hangi firma?
				</h1>
				<p className="mt-4 max-w-lg text-sm leading-relaxed text-metin-2">
					{e instanceof YetkisizHata ? e.message : 'Firma bilgisi çözülemedi.'}
				</p>
			</div>
		);
	}

	const supabase = await sunucuIstemcisi();

	/* Görev üretmiyoruz: "bugün hangi görevler geçerli" tanımdan
	   hesaplanıyor. Karar veri tabanındaki ptp_gunun_gorevleri()
	   fonksiyonunda — raporlar da aynı fonksiyonu kullanıyor, iki
	   ayrı yerde hesaplansaydı biri diğerinden sapardı. */
	const [gorevSonuc, kayitSonuc, kisiSonuc, bolgeSonuc, maddeSonuc, eksikSonuc] =
		await Promise.all([
			supabase.rpc('ptp_gunun_gorevleri', {
				p_firma_id: firmaId,
				p_tarih: tarih,
			}),

			supabase
				.from('ptp_kayitlar')
				.select('*, yapan:yapan_id(ad)')
				.eq('firma_id', firmaId)
				.eq('tarih', tarih)
				.order('zaman', { ascending: false }),

			supabase
				.from('kullanicilar')
				.select('id, ad')
				.eq('firma_id', firmaId)
				.eq('aktif', true)
				.is('silindi', null)
				.order('ad'),

			supabase
				.from('ptp_bolumler')
				.select('id, ad, kroki_x, kroki_y, kroki_en, kroki_boy')
				.eq('firma_id', firmaId)
				.eq('aktif', true)
				.is('silindi', null)
				.order('ad'),

			supabase
				.from('ptp_gorev_maddeleri')
				.select('id, gorev_id, metin, sira')
				.eq('firma_id', firmaId)
				.is('silindi', null)
				.order('sira'),

			supabase
				.from('ptp_eksikler')
				.select('id', { count: 'exact', head: true })
				.eq('firma_id', firmaId)
				.eq('durum', 'bekliyor')
				.is('silindi', null),
		]);

	const kisiler = (kisiSonuc.data ?? []) as { id: string; ad: string }[];
	const kisiAdi = new Map(kisiler.map((k) => [k.id, k.ad]));
	const kayitlar = (kayitSonuc.data ?? []) as unknown as Kayit[];
	const maddeler = (maddeSonuc.data ?? []) as {
		id: string;
		gorev_id: string;
		metin: string;
		sira: number;
	}[];

	/* Tanım + o güne ait kayıtlar tek yapıda birleştiriliyor. */
	const gorevler: GunlukGorev[] = ((gorevSonuc.data ?? []) as GunlukGorev[])
		.map((g) => ({
			...g,
			atanan: g.atanan_id ? { ad: kisiAdi.get(g.atanan_id) ?? '—' } : null,
			maddeler: maddeler.filter((m) => m.gorev_id === g.id),
			kayitlar: kayitlar.filter((k) => k.gorev_id === g.id),
		}))
		.filter(
			/* Personel yalnızca kendine atanan ve atanmamış görevleri görür. */
			(g) => yonetici || !g.atanan_id || g.atanan_id === kullanici.id
		)
		.sort((a, b) => a.grup.localeCompare(b.grup) || a.sira - b.sira);

	/* Kapanış grubu ve ciro listede DEĞİL: ikisi de "Günü kapat"
	   kutusunda. Aynı görevin iki yerde durması, hangisinden
	   yapıldığını belirsizleştiriyordu. */
	const kapanisGorevleri = gorevler.filter(
		(g) => g.grup === 'kapanis' || g.tur === 'ciro'
	);
	const listeGorevleri = gorevler.filter(
		(g) => g.grup !== 'kapanis' && g.tur !== 'ciro'
	);

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<span className="etiket text-vurgu-metin">Personel Takip</span>
			<div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-[-0.015em]">
					{tarihiBicimle(tarih)}
				</h1>

				<Link href="/ptp/eksikler" className="dugme dugme-bos !px-3 !py-2">
					Eksikler
					{!!eksikSonuc.count && eksikSonuc.count > 0 && (
						<span className="ml-1 bg-vurgu-metin px-1.5 py-0.5 text-zemin">
							{eksikSonuc.count}
						</span>
					)}
				</Link>
			</div>

			{/* Akşam kapanışı tek ekranda. Gelecek bir güne bakılıyorsa
			    kapatılacak bir şey yok. */}
			{tarih <= bugun() && (
				<GunuKapat
					gorevler={kapanisGorevleri}
					bolgeler={(bolgeSonuc.data ?? []) as Bolge[]}
					tarih={tarih}
				/>
			)}

			{yonetici && (
				<MudurBasligi
					gorevSayisi={gorevler.length}
					kisiSayisi={kisiler.length}
					tarih={tarih}
				/>
			)}

			{gorevSonuc.error ? (
				<p className="mt-8 border border-hata px-4 py-3 text-sm text-hata">
					Görevler okunamadı. Sayfayı yenileyin; sorun sürerse yöneticinize
					bildirin.
				</p>
			) : (
				<div className="mt-8">
					<GunListesi
						gorevler={listeGorevleri}
						yonetici={yonetici}
						kullaniciId={kullanici.id}
						kisiler={kisiler}
						bolgeler={(bolgeSonuc.data ?? []) as Bolge[]}
						tarih={tarih}
					/>
				</div>
			)}
		</div>
	);
}
