import { NextResponse } from 'next/server';
import { aktifKullanici, modulSeviyesi } from '@/lib/yetki';
import { aktifOtpFirmasi, gunlukYaz, yeniKimlik } from '@/lib/otp/veri';
import {
	cekleriAktar,
	dosyayiCoz,
	eslemeyiOgren,
	kredileriAktar,
} from '@/lib/otp/diaAktar';
import { cekleriCoz, taksitleriCoz, CEK_ALANLARI, KREDI_ALANLARI } from '@/lib/otp/dia';
import type { Esleme } from '@/lib/otp/dia';

/* DIA raporu içe aktarma.

   İKİ AŞAMA: önizleme hiçbir şey yazmaz, ne olacağını gösterir;
   onaydan sonra uygulanır. Para verisinde doğrusu bu.

   Yalnızca YÖNETİCİ: tek dosya yüzlerce kaydı değiştirebiliyor. */

export const dynamic = 'force-dynamic';

/* Excel dosyası; sunucusuz ortamda gövde sınırı var, açıkça
   sınırlıyoruz ki belirsiz bir hata yerine anlaşılır mesaj çıksın. */
const AZAMI = 8 * 1024 * 1024;

export async function POST(istek: Request) {
	try {
		const seviye = await modulSeviyesi('otp');
		if (seviye !== 'yonetim') {
			return NextResponse.json(
				{ error: 'İçe aktarma yalnızca yöneticiye açıktır.' },
				{ status: 403 }
			);
		}

		const firma = await aktifOtpFirmasi();
		if (!firma) {
			return NextResponse.json(
				{ error: 'Firma seçilmedi. Sayfanın sağ üstündeki kutudan seçin.' },
				{ status: 403 }
			);
		}

		const url = new URL(istek.url);
		const onizle = url.searchParams.has('onizle');

		const form = await istek.formData();
		const dosya = form.get('dosya');
		if (!(dosya instanceof File)) {
			return NextResponse.json({ error: 'Dosya gelmedi.' }, { status: 400 });
		}
		if (dosya.size > AZAMI) {
			return NextResponse.json(
				{ error: 'Dosya 8 MB’den büyük. DIA raporunu tarih aralığıyla daraltın.' },
				{ status: 400 }
			);
		}

		/* Kullanıcı kolon seçtiyse onu kullan; yoksa öğrenilmiş ya da
		   otomatik eşleme. */
		let elle: Esleme | undefined;
		const eslemeMetni = form.get('esleme');
		if (typeof eslemeMetni === 'string' && eslemeMetni) {
			try {
				elle = JSON.parse(eslemeMetni) as Esleme;
			} catch {
				return NextResponse.json({ error: 'Kolon eşlemesi okunamadı.' }, { status: 400 });
			}
		}

		const govde = Buffer.from(await dosya.arrayBuffer());
		const cozum = await dosyayiCoz(govde, firma.id, elle);

		if ('hata' in cozum) {
			return NextResponse.json({ error: cozum.hata }, { status: 400 });
		}

		/* Zorunlu alan bulunamadı: kullanıcıya hangi kolonun ne olduğu
		   soruluyor. Tahminle devam etmek yanlış veriyi sessizce
		   içeri alırdı. */
		if (cozum.eksik.length > 0) {
			const alanlar = cozum.tur === 'cek' ? CEK_ALANLARI : KREDI_ALANLARI;
			return NextResponse.json({
				eslemeGerekli: true,
				tur: cozum.tur,
				basliklar: cozum.basliklar,
				ornekler: cozum.ornekler,
				esleme: cozum.esleme,
				eksik: cozum.eksik.map((a) => ({ kod: a.kod, ad: a.ad })),
				alanlar: alanlar.map((a) => ({
					kod: a.kod,
					ad: a.ad,
					zorunlu: a.zorunlu,
				})),
			});
		}

		if (cozum.tur === 'cek') {
			const cekler = cekleriCoz(cozum.satirlar, cozum.baslikSatiri, cozum.esleme);
			if (cekler.length === 0) {
				return NextResponse.json(
					{ error: 'Dosyada çek/senet kaydı bulunamadı. Kolon eşlemesi yanlış olabilir.' },
					{ status: 400 }
				);
			}

			const sonuc = await cekleriAktar(firma.id, cekler, !onizle, yeniKimlik);

			if (!onizle) {
				const kullanici = await aktifKullanici();
				await eslemeyiOgren(firma.id, cozum.parmak, 'cek', cozum.esleme, kullanici.id);
				await gunlukYaz(firma.id, 'DIA ÇEK LİSTESİ YÜKLENDİ', null, {
					yeni: sonuc.yeni.length,
					guncellenen: sonuc.guncellenen.length,
					korunan: sonuc.korunan.length,
					degismeyen: sonuc.degismeyen,
				});
			}

			return NextResponse.json({ ...sonuc, onizleme: onizle });
		}

		const taksitler = taksitleriCoz(cozum.satirlar, cozum.baslikSatiri, cozum.esleme);
		if (taksitler.length === 0) {
			return NextResponse.json(
				{ error: 'Dosyada kredi taksidi bulunamadı. Kolon eşlemesi yanlış olabilir.' },
				{ status: 400 }
			);
		}

		const sonuc = await kredileriAktar(firma.id, taksitler, !onizle);

		if (!onizle) {
			const kullanici = await aktifKullanici();
			await eslemeyiOgren(firma.id, cozum.parmak, 'kredi', cozum.esleme, kullanici.id);
			await gunlukYaz(firma.id, 'DIA KREDİ LİSTESİ YÜKLENDİ', null, {
				krediYeni: sonuc.krediYeni,
				taksitYeni: sonuc.taksitYeni,
				guncellenen: sonuc.guncellenen,
			});
		}

		return NextResponse.json({ ...sonuc, onizleme: onizle });
	} catch (e) {
		console.error('[otp/dia-import]', e);
		return NextResponse.json(
			{ error: 'İçe aktarma sırasında hata oldu. Hiçbir şey değişmedi.' },
			{ status: 500 }
		);
	}
}
