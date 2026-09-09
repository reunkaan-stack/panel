import type { Metadata } from 'next';
import Link from 'next/link';
import { modulSeviyesi } from '@/lib/yetki';
import { aktifOtpFirmasi } from '@/lib/otp/veri';

export const metadata: Metadata = { title: 'Ödeme Takip — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Ödeme Takip.

   Arayüz yerel programdan olduğu gibi geldi: public/otp/uygulama.html.
   Dönüşümler araclar/otp-arayuz-tasi.mjs içinde tanımlı; tasarım, düzen
   ve akış aynen korundu.

   Çerçeve içinde açılıyor. React bileşenine çevirmek 1400 satırlık bir
   arayüzü yeniden yazmak demekti. Aynı kaynaktan servis edildiği için
   oturum çerezi sorunsuz geçiyor.

   ADRESTE SÜRÜM VAR. Arayüz public/ altında duran sabit bir dosya;
   tarayıcı onu önbelleğe alınca yeni sürüm yayına çıksa bile eskisi
   görünüyordu — "değişikliği göremiyorum" şikâyetinin kaynağı bu.
   Adrese yayın kimliği eklenince her yayında adres değişiyor ve
   çerçeve kendiliğinden tazeleniyor. Kimlik yayın başına sabit
   olduğu için önbellek yine çalışıyor, yalnızca yeni yayında
   geçersizleşiyor.

   FİRMA SEÇİMİ ÜST ÇUBUKTA. Arayüzün kendi seçicisi kapatıldı; hangi
   firmanın verisi geleceğine sunucu karar veriyor. Çerçevenin adresine
   firma kimliği ekleniyor: adres değişince tarayıcı çerçeveyi yeniden
   yüklüyor. Olmasaydı üstten firma değiştirildiğinde dıştaki sayfa
   yenilenir ama içerideki uygulama eski firmanın verisini göstermeye
   devam ederdi — en sinsi hata türü. */

/* Yayın kimliği. Vercel her yayında commit karmasını veriyor;
   geliştirmede sunucu her açıldığında değişsin ki elle yenilemek
   gerekmesin. */
const SURUM =
	process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
	(process.env.NODE_ENV === 'development' ? String(Date.now()) : 'yerel');

export default async function OtpSayfasi() {
	const seviye = await modulSeviyesi('otp');

	if (!seviye) {
		return (
			<Uyari
				etiket="Yetki yok"
				baslik="Ödeme Takip açılamadı"
				metin="Bu modüle yetkiniz yok ya da firmanızda kapalı. Süperadmin, Kişiler ekranından Ödeme Takip yetkisi verdikten sonra burası açılır."
			/>
		);
	}

	const firma = await aktifOtpFirmasi();

	if (!firma) {
		return (
			<Uyari
				etiket="Firma seçilmedi"
				baslik="Hangi firma?"
				metin="Sayfanın sağ üstündeki firma kutusundan seçim yapın. Seçtiğiniz firma hatırlanır ve panelin bütün ekranları o firmayı gösterir."
			/>
		);
	}

	return (
		<div className="flex h-[calc(100vh-8.5rem)] flex-col">
			<iframe
				src={`/otp/uygulama.html?firma=${firma.id}&s=${SURUM}`}
				title={`Ödeme Takip — ${firma.ad}`}
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
			<Link href="/" className="dugme dugme-bos mt-6 inline-block">
				← Panele dön
			</Link>
		</div>
	);
}
