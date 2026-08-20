import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle, YetkisizHata } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { bugun, tarihiBicimle } from '@/lib/ortak/tarih';
import type { Bolge, GorevSatiri } from '@/lib/tipler';
import { GunListesi } from './bilesenler/GunListesi';
import { MudurBasligi } from './bilesenler/MudurBasligi';

export const metadata: Metadata = { title: 'Personel Takip — Karas Panel' };

/* Kullanıcıya özel veri; önbelleğe alınmaz.
   Çok firmalı sistemde yanlış önbellek, bir firmanın verisini diğerine
   göstermek demektir. Bkz. standartlar/04-KOD.md */
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

	/* Süperadmin RLS gereği BÜTÜN firmaların görevlerini görebilir.
	   Hangi firmaya baktığı belirlenmeden liste gösterilmez; yoksa iki
	   firmanın görevleri aynı ekranda karışır. */
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
					{e instanceof YetkisizHata
						? e.message
						: 'Firma bilgisi çözülemedi.'}
				</p>
			</div>
		);
	}

	const supabase = await sunucuIstemcisi();

	/* Müdür günün tamamını görür; personel yalnızca kendine atananı ve
	   henüz kimseye atanmamış olanları. */
	let sorgu = supabase
		.from('ptp_gorevler')
		.select(
			'*, atanan:atanan_id(ad), tamamlayan:tamamlayan_id(ad), bolge:deger_bolge_id(ad), ' +
				'maddeler:ptp_gorev_maddeleri(id, gorev_id, metin, sira, isaretli, isaretleyen_id, isaretlenme_zamani), ' +
				'kayitlar:ptp_gorev_kayitlari(id, gorev_id, zaman, deger_bolge_id, deger_metin, deger_sayi, yapan:yapan_id(ad), bolge:deger_bolge_id(ad))'
		)
		.eq('firma_id', firmaId)
		.eq('tarih', tarih)
		.is('silindi', null)
		.order('grup')
		.order('baslik');

	if (!yonetici) {
		sorgu = sorgu.or(`atanan_id.eq.${kullanici.id},atanan_id.is.null`);
	}

	/* Üç sorgu birbirini beklemez — PARALEL çalışır.
	   Ardışık yazıldığında her biri ayrı bir Atlantik gidiş-dönüşü
	   ekliyordu; veri tabanı Frankfurt'ta, fonksiyon orada çalışsa bile
	   sıraya dizmenin bir faydası yok. */
	const [gorevSonucu, eksikSonucu, kisiSonucu, bolgeSonucu] = await Promise.all([
		sorgu,

		/* Yalnızca sayım isteniyor, satırlar değil — head: true ile
		   veri taşınmıyor. */
		supabase
			.from('ptp_eksikler')
			.select('id', { count: 'exact', head: true })
			.eq('firma_id', firmaId)
			.eq('durum', 'bekliyor')
			.is('silindi', null),

		/* Atama listesi yalnızca müdüre gerekiyor. */
		yonetici
			? supabase
					.from('kullanicilar')
					.select('id, ad')
					.eq('firma_id', firmaId)
					.eq('aktif', true)
					.is('silindi', null)
					.order('ad')
			: Promise.resolve({ data: null }),

		/* Bölge seçmeli görevlerde listeden seçilecek bölümler */
		supabase
			.from('ptp_bolumler')
			.select('id, ad')
			.eq('firma_id', firmaId)
			.eq('aktif', true)
			.is('silindi', null)
			.order('ad'),
	]);

	const { data, error } = gorevSonucu;
	const gorevler = (data ?? []) as unknown as GorevSatiri[];
	const eksikSayisi = eksikSonucu.count;
	const kisiler = kisiSonucu.data;
	const bolgeler = (bolgeSonucu.data ?? []) as Bolge[];

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<span className="etiket text-vurgu-metin">Personel Takip</span>
			<div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-[-0.015em]">
					{tarihiBicimle(tarih)}
				</h1>

				<Link
					href="/ptp/eksikler"
					className="dugme dugme-bos !px-3 !py-2"
				>
					Eksikler
					{!!eksikSayisi && eksikSayisi > 0 && (
						<span className="ml-1 bg-vurgu-metin px-1.5 py-0.5 text-zemin">
							{eksikSayisi}
						</span>
					)}
				</Link>
			</div>

			{yonetici && (
				<MudurBasligi
					tarih={tarih}
					gorevSayisi={gorevler.length}
					kisiler={kisiler ?? []}
				/>
			)}

			{error ? (
				<p className="mt-8 border border-hata px-4 py-3 text-sm text-hata">
					Görevler okunamadı. Sayfayı yenileyin; sorun sürerse yöneticinize
					bildirin.
				</p>
			) : (
				<div className="mt-8">
					<GunListesi
						gorevler={gorevler}
						yonetici={yonetici}
						kullaniciId={kullanici.id}
						kisiler={kisiler ?? []}
						bolgeler={bolgeler}
					/>
				</div>
			)}
		</div>
	);
}
