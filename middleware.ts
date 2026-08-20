import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON, SUPABASE_URL, supabaseAyarli } from '@/lib/supabase/ayar';

/* Orta katman iki iş yapar:
   1. Oturum çerezini tazeler (yoksa kullanıcı sessizce düşer)
   2. Oturumsuz isteği giriş ekranına yönlendirir

   ⚠️ Yetki denetimi BURADA yapılmaz. Orta katman kaba bir kapıdır;
   gerçek denetim sunucu eylemlerinde ve RLS'te olur. Buraya yaslanmak,
   tek bir yönlendirme hatasının bütün korumayı kaldırması demektir.
   Bkz. standartlar/02-GUVENLIK.md */

const ACIK_YOLLAR = ['/giris', '/sifre-sifirlama'];

export async function middleware(istek: NextRequest) {
	const yol = istek.nextUrl.pathname;

	/* Supabase bağlanmadan yönlendirme yapılmaz; yoksa yapılandırma
	   eksikken kullanıcı sonsuz döngüye girer. */
	if (!supabaseAyarli()) return NextResponse.next();

	let yanit = NextResponse.next({ request: istek });

	const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
		cookies: {
			getAll() {
				return istek.cookies.getAll();
			},
			setAll(cerezler) {
				for (const { name, value } of cerezler) {
					istek.cookies.set(name, value);
				}
				yanit = NextResponse.next({ request: istek });
				for (const { name, value, options } of cerezler) {
					yanit.cookies.set(name, value, options);
				}
			},
		},
	});

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const acikYol = ACIK_YOLLAR.some((a) => yol.startsWith(a));

	if (!user && !acikYol) {
		const adres = istek.nextUrl.clone();
		adres.pathname = '/giris';
		/* Giriş sonrası kullanıcı baktığı yere dönsün; oturum düştüğünde
		   yerini kaybetmesin. */
		if (yol !== '/') adres.searchParams.set('devam', yol);
		return NextResponse.redirect(adres);
	}

	if (user && acikYol) {
		const adres = istek.nextUrl.clone();
		adres.pathname = '/';
		adres.search = '';
		return NextResponse.redirect(adres);
	}

	return yanit;
}

export const config = {
	matcher: [
		/* Statik dosyalar ve görseller dışındaki her yol */
		'/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
	],
};
