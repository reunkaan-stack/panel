import type { NextConfig } from 'next';

const yapilandirma: NextConfig = {
	/* Tip veya kod hatası olan bir sürüm yayına çıkmasın.
	   Vercel derlemeyi bu yüzden reddedebilir — istenen davranış budur. */
	typescript: { ignoreBuildErrors: false },

	async headers() {
		return [
			{
				/* Ödeme Takip arayüzü hariç her yol. Dışarıda bırakmak
				   yerine aşağıdaki kuralla ezmeye güvenilebilirdi ama
				   sıraya bağlı davranış sessizce değişebilir; burada
				   eşleşme hiç olmuyor, belirsizlik kalmıyor. */
				source: '/((?!otp/uygulama\\.html).*)',
				headers: [
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					/* Panel dışarıdan iframe'e gömülmez: tıklama hırsızlığına
					   karşı. Tek istisna aşağıda. */
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
				],
			},

			/* Ödeme Takip arayüzü kendi çerçevesinde açılıyor: yerel
			   programdan olduğu gibi geldi ve React bileşenine çevirmek
			   1400 satırı yeniden yazmak demekti.

			   DENY, AYNI KAYNAKTAN gömmeyi de engelliyor — hata buydu.
			   SAMEORIGIN yalnızca panelin kendisine izin veriyor; başka
			   bir site bu sayfayı çerçeveye alamıyor, yani tıklama
			   hırsızlığı koruması duruyor.

			   Bu yol yukarıdaki kuralın dışında kaldığı için diğer
			   güvenlik başlıkları da burada tekrarlanıyor — dışarıda
			   bırakmak, korumasız bırakmak olmamalı. */
			{
				source: '/otp/uygulama.html',
				headers: [
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					{ key: 'X-Frame-Options', value: 'SAMEORIGIN' },
					{ key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
					{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
				],
			},
		];
	},
};

export default yapilandirma;
