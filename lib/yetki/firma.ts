import 'server-only';
import { cookies } from 'next/headers';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici, YetkisizHata } from './index';

/* Süperadmin hangi firma adına çalışıyor?

   Normal kullanıcının firması bellidir. Süperadminin firması YOKTUR —
   firmaların üstündedir. Ama kayıt oluştururken somut bir firma gerekir
   (her satırda firma_id zorunlu).

   Bu yüzden süperadmin bir firma "seçer". Seçim çerezde durur.
   Tek firma varsa seçim sorulmaz, o kullanılır.

   ⚠️ Süperadminin bir firma adına YAZMA yapması denetim kaydına
   yazılmalı. Şimdilik yalnızca okuma/oluşturma var; kayıt akışı
   eklendiğinde bu fonksiyonun çağrıldığı yerler işaretlenecek. */

const CEREZ = 'karas-firma';

/**
 * İşlemin yapılacağı firma kimliği.
 * Normal kullanıcıda kendi firması; süperadminde seçili firma.
 */
export async function islemFirmasi(): Promise<string> {
	const kullanici = await aktifKullanici();

	if (kullanici.rol !== 'superadmin') {
		if (!kullanici.firma_id) {
			throw new YetkisizHata('Hesabınız bir firmaya bağlı değil.');
		}
		return kullanici.firma_id;
	}

	const supabase = await sunucuIstemcisi();
	const cerezler = await cookies();
	const secili = cerezler.get(CEREZ)?.value;

	if (secili) {
		/* Çerezdeki değere körü körüne güvenilmez: firma gerçekten var mı
		   ve aktif mi, denetlenir. */
		const { data } = await supabase
			.from('firmalar')
			.select('id')
			.eq('id', secili)
			.eq('aktif', true)
			.is('silindi', null)
			.maybeSingle();
		if (data) return data.id;
	}

	const { data: firmalar } = await supabase
		.from('firmalar')
		.select('id')
		.eq('aktif', true)
		.is('silindi', null)
		.limit(2);

	if (!firmalar?.length) {
		throw new YetkisizHata(
			'Sistemde tanımlı firma yok. Önce bir firma oluşturulmalı.'
		);
	}
	if (firmalar.length > 1) {
		throw new YetkisizHata(
			'Birden çok firma var. Hangi firma adına çalışacağınızı seçin.'
		);
	}
	return firmalar[0].id;
}

/** Süperadminin firma seçimini kaydeder. */
export async function firmaSec(firmaId: string): Promise<void> {
	const kullanici = await aktifKullanici();
	if (kullanici.rol !== 'superadmin') {
		throw new YetkisizHata();
	}
	const cerezler = await cookies();
	cerezler.set(CEREZ, firmaId, {
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 30,
	});
}
