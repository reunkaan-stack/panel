import type { Metadata } from 'next';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle, YetkisizHata } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import { bugun, tarihiBicimle } from '@/lib/ortak/tarih';
import type { GorevSatiri } from '@/lib/tipler';
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
		.select('*, atanan:atanan_id(ad), tamamlayan:tamamlayan_id(ad)')
		.eq('firma_id', firmaId)
		.eq('tarih', tarih)
		.is('silindi', null)
		.order('grup')
		.order('baslik');

	if (!yonetici) {
		sorgu = sorgu.or(`atanan_id.eq.${kullanici.id},atanan_id.is.null`);
	}

	const { data, error } = await sorgu;
	const gorevler = (data ?? []) as unknown as GorevSatiri[];

	/* Atama listesi yalnızca müdüre gerekiyor. */
	const { data: kisiler } = yonetici
		? await supabase
				.from('kullanicilar')
				.select('id, ad')
				.eq('firma_id', firmaId)
				.eq('aktif', true)
				.is('silindi', null)
				.order('ad')
		: { data: null };

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<span className="etiket text-vurgu-metin">Personel Takip</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				{tarihiBicimle(tarih)}
			</h1>

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
					/>
				</div>
			)}
		</div>
	);
}
