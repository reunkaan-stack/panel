import type { NextConfig } from 'next';

const yapilandirma: NextConfig = {
	/* Tip veya kod hatası olan bir sürüm yayına çıkmasın.
	   Vercel derlemeyi bu yüzden reddedebilir — istenen davranış budur. */
	typescript: { ignoreBuildErrors: false },

	async headers() {
		return [
			{
				source: '/:yol*',
				headers: [
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					/* Panel hiçbir yerde iframe'e gömülmez. Yerel sistemde
					   modüller iframe ile gömülüyordu; webde bu hem çerez
					   kısıtları hem tıklama hırsızlığı riski demek. */
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
				],
			},
		];
	},
};

export default yapilandirma;
