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

export async function girisKaydet(): Promise<{ tamam: boolean; sebep?: string }> {
	try {
		const kullanici = await aktifKullanici();
		const supabase = await sunucuIstemcisi();

		/* Hata YUTULMUYOR. Güncelleme RLS yüzünden hiç satır
		   etkilemezse Supabase hata döndürmez; bu yüzden etkilenen
		   satır ayrıca sayılıyor. Sessiz sıfır, damganın aylarca
		   atılmadığını fark etmemize engel olurdu. */
		const { error, count } = await supabase
			.from('kullanicilar')
			.update({ son_giris: new Date().toISOString() }, { count: 'exact' })
			.eq('id', kullanici.id);

		if (error) throw error;
		if (!count) {
			console.error('[giris] son_giris yazilmadi: 0 satir etkilendi', kullanici.id);
			return { tamam: false, sebep: 'satır güncellenmedi' };
		}

		if (!kullanici.firma_id) return { tamam: true };

		await bildir(
			kullanici.firma_id,
			'sistem.oturum_acildi',
			`🟢 <b>${kacir(kullanici.ad)}</b> giriş yaptı — ${saatiBicimle(new Date())}`
		);

		return { tamam: true };
	} catch (e) {
		console.error('[giris] kaydedilemedi', e);
		return { tamam: false, sebep: e instanceof Error ? e.message : 'bilinmiyor' };
	}
}
