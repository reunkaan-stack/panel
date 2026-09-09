'use server';

import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici } from '@/lib/yetki';
import { saatiBicimle } from '@/lib/ortak/tarih';
import { kacir } from '@/lib/telegram';
import { bildir } from '@/lib/bildirim';

/* Girişten sonra çalışır: son giriş damgası + bildirim.

   Giriş tarayıcıda yapılıyor (Supabase istemcisi), o yüzden bu adım
   ayrı bir sunucu eylemi. Damga olmadan Kişiler ekranında herkes
   "hiç giriş yapmadı" görünüyordu — kolon vardı, yazan yoktu.

   Hata fırlatmaz: giriş başarılı olduktan sonra bu adım patlarsa
   kullanıcı içeri girememezlik yaşamamalı. */

export async function girisKaydet(): Promise<void> {
	try {
		const kullanici = await aktifKullanici();
		const supabase = await sunucuIstemcisi();

		await supabase
			.from('kullanicilar')
			.update({ son_giris: new Date().toISOString() })
			.eq('id', kullanici.id);

		if (!kullanici.firma_id) return;

		await bildir(
			kullanici.firma_id,
			'sistem.oturum_acildi',
			`🟢 <b>${kacir(kullanici.ad)}</b> giriş yaptı — ${saatiBicimle(new Date())}`
		);
	} catch (e) {
		console.error('[giris] kaydedilemedi', e);
	}
}
