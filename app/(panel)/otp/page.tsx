import type { Metadata } from 'next';
import Link from 'next/link';
import { modulSeviyesi } from '@/lib/yetki';

export const metadata: Metadata = { title: 'Ödeme Takip — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Ödeme Takip.

   Arayüz yerel programdan olduğu gibi geldi: public/otp/uygulama.html.
   Tasarım, düzen ve akış aynen korundu — tek satır yeniden yazılmadı.
   Dönüşümler araclar/otp-arayuz-tasi.mjs içinde tanımlı.

   Çerçeve içinde açılıyor. React bileşenine çevirmek 1400 satırlık bir
   arayüzü yeniden yazmak demekti. Aynı kaynaktan servis edildiği için
   oturum çerezi sorunsuz geçiyor.

   Sayfa BİLEREK sade: yetki dışında hiçbir sorgu yapmıyor. Önceki
   hâlinde firma listesi de buradan okunuyordu ve o sorgu hata verince
   bütün sayfa açılmıyordu — oysa listeyi arayüz zaten kendi ucundan
   alıyor. Bir ekranın açılması, göstereceği şeyden fazlasına bağlı
   olmamalı. */

const ADRES = '/otp/uygulama.html';

export default async function OtpSayfasi() {
	/* yetkiDenetle yerine seviye sorgusu: hata fırlatmıyor, yetkisizlik
	   ekranda anlaşılır biçimde anlatılıyor. */
	const seviye = await modulSeviyesi('otp');

	if (!seviye) {
		return (
			<div className="mx-auto max-w-2xl px-6 py-16">
				<span className="etiket text-uyari">Yetki yok</span>
				<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
					Ödeme Takip açılamadı
				</h1>
				<p className="mt-4 text-sm leading-relaxed text-metin-2">
					Bu modüle yetkiniz yok ya da firmanızda kapalı. Süperadmin,{' '}
					<strong>Kişiler</strong> ekranından Ödeme Takip yetkisi verdikten
					sonra burası açılır.
				</p>
				<Link href="/" className="dugme dugme-bos mt-6 inline-block">
					← Panele dön
				</Link>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100vh-8.5rem)] flex-col">
			<iframe
				src={ADRES}
				title="Ödeme Takip"
				className="min-h-0 flex-1 border-0"
			/>

			{/* Çerçeve bir sebeple açılmazsa kullanıcı burada kalmasın. */}
			<noscript>
				<a href={ADRES}>Ödeme Takip’i aç</a>
			</noscript>
		</div>
	);
}
