/* Supabase bağlantı ayarları tek yerden okunur.

   Anahtarlar tanımlı değilken uygulama çökmez: giriş ekranı görünür ve
   "yapılandırma eksik" uyarısı verir. Sebep, kurulum sırasında ekranın
   tasarımını görebilmek ve eksiğin ne olduğunu anlaşılır biçimde
   söyleyebilmek — beyaz bir hata sayfası hiçbir şey anlatmaz. */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/* Panel, kurumsal siteyle AYNI Supabase projesini kullanır ama kendi
   şemasında durur. Site tabloları `public` şemasında; panel tabloları
   burada.

   Ayrımın sebebi düzen değil güvenlik: sitenin anon anahtarı herkese
   açık bir sayfanın içinde ve `anon` rolüne bu şema kapatıldı. Yani o
   anahtar panel verisine ulaşamaz — RLS'e ek, ondan bağımsız bir kilit.

   ⚠️ Supabase panelinde bu şemanın API'ye açılmış olması gerekir:
   Settings → API → Exposed schemas → `panel` eklenir. */
export const SEMA = 'panel';

/** Bağlantı bilgileri girilmiş mi. */
export function supabaseAyarli(): boolean {
	return SUPABASE_URL.length > 0 && SUPABASE_ANON.length > 0;
}
