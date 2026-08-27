import type { Metadata } from 'next';
import { yetkiDenetle } from '@/lib/yetki';
import { otpFirmalari } from '@/lib/otp/veri';

export const metadata: Metadata = { title: 'Ödeme Takip — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Ödeme Takip.

   Arayüz yerel programdan olduğu gibi geldi: public/otp/uygulama.html.
   Tek değişiklik API adreslerinin /api/otp/ olması. Tasarım, düzen ve
   akış aynen korundu — tek satır yeniden yazılmadı.

   Çerçeve içinde açılıyor. Sayfa kendi içinde tam bir uygulama; React
   bileşenine çevirmek 1400 satırlık bir arayüzü yeniden yazmak
   demekti ve her satırı bozma ihtimali taşıyordu. Aynı kaynaktan
   servis edildiği için oturum çerezi de sorunsuz geçiyor.

   Uygulama zaten çerçeve içinde olduğunu anlıyor ve kendi modül
   çubuğunu gizliyor (window.top !== window.self denetimi) — yereldeki
   portal da böyle gömüyordu. */

export default async function OtpSayfasi() {
	await yetkiDenetle('otp', 'okuma');
	const firmalar = await otpFirmalari();

	if (firmalar.length === 0) {
		return (
			<div className="mx-auto max-w-2xl px-6 py-16">
				<span className="etiket text-uyari">Firma yok</span>
				<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
					Ödeme Takip açılamadı
				</h1>
				<p className="mt-4 text-sm leading-relaxed text-metin-2">
					Bu modül hiçbir firmada açık değil ya da hesabınızın eriştiği
					firmalarda kapalı. Süperadmin, firmaya <code>otp</code> modülünü
					açtıktan sonra burası çalışır.
				</p>
			</div>
		);
	}

	return (
		<iframe
			src="/otp/uygulama.html"
			title="Ödeme Takip"
			className="h-[calc(100vh-8.5rem)] w-full border-0"
		/>
	);
}
