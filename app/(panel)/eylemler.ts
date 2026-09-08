'use server';

import { revalidatePath } from 'next/cache';
import { firmaSec } from '@/lib/yetki/firma';
import { YetkisizHata } from '@/lib/yetki';
import type { Sonuc } from './ptp/eylemler';

/* Panel geneli eylemler. */

/**
 * Süperadminin hangi firma adına çalıştığını değiştirir.
 *
 * Süperadminin kendi firması yoktur — firmaların üstündedir. Ama her
 * kayıtta somut bir firma gerekiyor, o yüzden seçim yapılıyor ve
 * çerezde saklanıyor.
 */
export async function firmaDegistir(firmaId: string): Promise<Sonuc> {
	try {
		await firmaSec(firmaId);
		/* Bütün sayfalar bu seçime bağlı; tek sayfa değil kabuk
		   yenileniyor. */
		revalidatePath('/', 'layout');
		return { tamam: true, veri: undefined };
	} catch (e) {
		if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };
		console.error('[firmaDegistir]', e);
		return { tamam: false, mesaj: 'Firma değiştirilemedi.' };
	}
}
