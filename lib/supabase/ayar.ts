/* Supabase bağlantı ayarları tek yerden okunur.

   Anahtarlar tanımlı değilken uygulama çökmez: giriş ekranı görünür ve
   "yapılandırma eksik" uyarısı verir. Sebep, kurulum sırasında ekranın
   tasarımını görebilmek ve eksiğin ne olduğunu anlaşılır biçimde
   söyleyebilmek — beyaz bir hata sayfası hiçbir şey anlatmaz. */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Bağlantı bilgileri girilmiş mi. */
export function supabaseAyarli(): boolean {
	return SUPABASE_URL.length > 0 && SUPABASE_ANON.length > 0;
}
