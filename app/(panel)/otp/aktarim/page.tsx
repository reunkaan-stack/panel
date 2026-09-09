import type { Metadata } from 'next';
import Link from 'next/link';
import { modulSeviyesi } from '@/lib/yetki';
import { aktifOtpFirmasi } from '@/lib/otp/veri';
import { DiaAktarim } from './bilesenler/DiaAktarim';

export const metadata: Metadata = { title: 'DIA aktarımı — Karas Panel' };
export const dynamic = 'force-dynamic';

/* DIA içe aktarma — ÖTP çerçevesinin DIŞINDA, panelin kendi sayfası.

   Kolon eşleme arayüzü ve önizleme listesi için gereken yer, taşınan
   HTML'in içinde yoktu. Burada tam kontrol var ve arayüzü yeniden
   yazmak gerekmedi. */

export default async function AktarimSayfasi() {
	const seviye = await modulSeviyesi('otp');
	const firma = await aktifOtpFirmasi();

	if (seviye !== 'yonetim' || !firma) {
		return (
			<div className="mx-auto max-w-2xl px-6 py-16">
				<span className="etiket text-uyari">Yetki yok</span>
				<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
					DIA aktarımı
				</h1>
				<p className="mt-4 text-sm leading-relaxed text-metin-2">
					{!firma
						? 'Firma seçilmedi. Sayfanın sağ üstündeki kutudan seçim yapın.'
						: 'İçe aktarma yalnızca yöneticiye açıktır. Tek dosya yüzlerce kaydı değiştirebiliyor.'}
				</p>
				<Link href="/otp" className="dugme dugme-bos mt-6 inline-block">
					← Ödeme Takip
				</Link>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<Link href="/otp" className="etiket text-metin-3 hover:text-metin">
				← Ödeme Takip
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">
				{firma.ad}
			</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				DIA raporu aktar
			</h1>
			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Çek, senet ve kredi taksitleri DIA’dan gelir. Aktarım hiçbir kaydı
				silmez; elle girdikleriniz yerinde kalır.
			</p>

			<div className="mt-8">
				<DiaAktarim />
			</div>
		</div>
	);
}
