import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_ANON, SUPABASE_URL } from './ayar';

/* Sunucu tarafı Supabase istemcisi.

   Sunucu bileşenlerinde ve sunucu eylemlerinde kullanılır. Oturum
   çerezden okunur; istemciden gelen hiçbir kimlik bilgisine güvenilmez.

   ⚠️ Bu istemci anon anahtarla çalışır, yani RLS kuralları geçerlidir.
   RLS'i atlaması gereken işler için ayrı bir yönetim istemcisi gerekir
   ve o istemci yalnızca gerçekten gerektiğinde yazılır. */
export async function sunucuIstemcisi() {
	const cerezDeposu = await cookies();

	return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
		cookies: {
			getAll() {
				return cerezDeposu.getAll();
			},
			setAll(cerezler) {
				try {
					for (const { name, value, options } of cerezler) {
						cerezDeposu.set(name, value, options);
					}
				} catch {
					/* Sunucu bileşeninden çerez yazılamaz. Oturum tazeleme
					   orta katmanda yapıldığı için burada yutmak güvenli. */
				}
			},
		},
	});
}

/** Oturumdaki kullanıcı; yoksa null. */
export async function oturumdakiKullanici() {
	const supabase = await sunucuIstemcisi();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
}
