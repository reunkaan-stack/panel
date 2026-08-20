'use client';

import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON, SUPABASE_URL } from './ayar';

/* Tarayıcı tarafı Supabase istemcisi.

   Yalnızca giriş, çıkış ve şifre sıfırlama gibi kullanıcının kendi
   oturumuyla ilgili işlerde kullanılır. Veri okuma sunucu tarafında
   yapılır — bkz. standartlar/04-KOD.md. */
export function tarayiciIstemcisi() {
	return createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
}
