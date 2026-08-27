import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';

/* POST /api/otp/cikis — çıkış.

   Yerel programda kendi oturumunu kapatıyordu. Panelde tek oturum var,
   o yüzden bu panelin oturumunu kapatıyor. Arayüz ardından sayfayı
   yeniliyor; çerçeve içinde olduğu için üst sayfa da giriş ekranına
   düşüyor. */

export const dynamic = 'force-dynamic';

export async function POST() {
	try {
		const supabase = await sunucuIstemcisi();
		await supabase.auth.signOut();
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error('[otp/cikis]', e);
		return NextResponse.json({ ok: false }, { status: 500 });
	}
}
