import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SEMA, SUPABASE_URL } from './ayar';

/* Yönetim istemcisi — RLS'i ATLAR.

   ⚠️ Yalnızca hesap açma ve silme için var. Bunlar Supabase'in auth
   şemasına yazar; oraya normal kullanıcı anahtarıyla erişilemez.
   Başka hiçbir iş için kullanılmaz: veri okuyup yazan her yol
   sunucuIstemcisi() üzerinden gider ve RLS'e tabidir.

   `server-only`: bu dosya bir istemci bileşenine sızarsa derleme
   HATA VERİR. service_role anahtarının tarayıcıya inmesi, bütün
   güvenlik modelinin çökmesi demektir.

   Bkz. standartlar/02-GUVENLIK.md */

const SERVIS_ANAHTARI = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Yönetim anahtarı tanımlı mı. Ekran buna göre uyarı gösterir. */
export function yonetimAyarli(): boolean {
	return SUPABASE_URL.length > 0 && SERVIS_ANAHTARI.length > 0;
}

export function yonetimIstemcisi() {
	if (!yonetimAyarli()) {
		throw new Error(
			'SUPABASE_SERVICE_ROLE_KEY tanımlı değil; hesap açma kapalı.'
		);
	}

	/* Oturum saklanmıyor ve tazelenmiyor: bu istemci bir kullanıcıyı
	   temsil etmiyor, tek seferlik yönetim işi yapıyor. */
	return createClient(SUPABASE_URL, SERVIS_ANAHTARI, {
		db: { schema: SEMA },
		auth: { autoRefreshToken: false, persistSession: false },
	});
}
