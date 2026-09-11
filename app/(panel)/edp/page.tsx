import type { Metadata } from 'next';
import Link from 'next/link';
import { modulSeviyesi } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';

export const metadata: Metadata = {
	title: 'Excel Dosya Yükleme Programı — Karas Panel',
};
export const dynamic = 'force-dynamic';

/* Excel Dosya Yükleme Programı (edp).

   Tedarikçiden gelen sipariş PDF'i ya da fiyat listesi Excel'i
   okunup, Dia'ya yüklenebilir Excel üretiliyor.

   ⚠️ ÖTP'DEKİ "DIA RAPORU YÜKLE" İLE KARIŞTIRILMAMALI. O, DIA'dan
   veri ÇEKER; bu, DIA'ya YÜKLENECEK dosyayı ÜRETİR.

   Arayüz yereldeki programdan olduğu gibi geldi ve çerçevede
   açılıyor; dönüşümler araclar/edp-arayuz-tasi.mjs içinde tanımlı.
   ÖTP ile aynı yöntem — orada kanıtlandı.

   ADRESTE SÜRÜM VAR: public/ altındaki sabit dosya önbelleğe
   alındığında yeni sürüm yayına çıksa bile eskisi görünüyordu.
   Yayın kimliği eklenince her yayında adres değişiyor. */

const SURUM =
	process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
	(process.env.NODE_ENV === 'development' ? String(Date.now()) : 'yerel');

export default async function EdpSayfasi() {
	const seviye = await modulSeviyesi('edp');

	if (!seviye) {
		return (
			<Uyari
				etiket="Yetki yok"
				baslik="Excel Dosya Yükleme açılamadı"
				metin="Bu modüle yetkiniz yok ya da firmanızda kapalı. Süperadmin, Kişiler ekranından yetki verdikten sonra burası açılır."
			/>
		);
	}

	const firmaId = await islemFirmasi();
	if (!firmaId) {
		return (
			<Uyari
				etiket="Firma seçilmedi"
				baslik="Hangi firma?"
				metin="Sayfanın sağ üstündeki firma kutusundan seçim yapın. Fiyat kuralları ve tedarikçi oranları firmaya bağlı tutulur."
			/>
		);
	}

	return (
		<div className="flex h-[calc(100vh-8.5rem)] flex-col">
			<iframe
				src={`/edp/uygulama.html?firma=${firmaId}&s=${SURUM}`}
				title="Excel Dosya Yükleme Programı"
				className="min-h-0 flex-1 border-0"
			/>
		</div>
	);
}

function Uyari({
	etiket,
	baslik,
	metin,
}: {
	etiket: string;
	baslik: string;
	metin: string;
}) {
	return (
		<div className="mx-auto max-w-2xl px-6 py-16">
			<span className="etiket text-uyari">{etiket}</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				{baslik}
			</h1>
			<p className="mt-4 text-sm leading-relaxed text-metin-2">{metin}</p>
			<Link href="/?menu=1" className="dugme dugme-bos mt-6 inline-block">
				← Panele dön
			</Link>
		</div>
	);
}
