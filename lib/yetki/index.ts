import 'server-only';
import { cache } from 'react';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import type { Kullanici, Modul, Seviye } from '@/lib/tipler';

/* Yetki denetimi — tek kaynak.

   Her sunucu eyleminin ILK SATIRI buradan bir çağrıdır. İstisna yok.
   RLS zaten koruyor olsa da uygulama katmanı da denetler: iki kilit,
   tek anahtardan iyidir. Ayrıca RLS reddettiğinde boş liste döner,
   kullanıcı "veri yok" ile "yetkin yok" arasındaki farkı göremez.

   `server-only` içe aktarımı bilinçli: bu dosya yanlışlıkla bir istemci
   bileşenine sızarsa derleme HATA VERİR. Yetki mantığının tarayıcıya
   inmesi, mantığın kendisinden daha tehlikelidir.

   Bkz. standartlar/02-GUVENLIK.md */

export class YetkisizHata extends Error {
	constructor(mesaj = 'Bu işlem için yetkiniz yok') {
		super(mesaj);
		this.name = 'YetkisizHata';
	}
}

export class OturumYokHata extends Error {
	constructor() {
		super('Oturum bulunamadı');
		this.name = 'OturumYokHata';
	}
}

/* React cache(): aynı istek içinde kaç kez çağrılırsa çağrılsın
   sorgu BİR KEZ çalışır. Öncesinde yetkiDenetle, islemFirmasi ve
   sayfa gövdesi ayrı ayrı çağırıyordu; her biri auth.getUser() (ağ
   çağrısı) + kullanıcı sorgusu demekti. Veri tabanı Frankfurt'ta
   olduğu için her tekrar bir Atlantik gidiş-dönüşüydü. */

/** Oturumdaki kullanıcının panel kaydı. Yoksa hata fırlatır. */
export const aktifKullanici = cache(async function aktifKullanici(): Promise<Kullanici> {
	const supabase = await sunucuIstemcisi();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new OturumYokHata();

	const { data, error } = await supabase
		.from('kullanicilar')
		.select('id, auth_id, firma_id, ad, eposta, rol, aktif')
		.eq('auth_id', user.id)
		.is('silindi', null)
		.single();

	/* Auth'ta var ama panel kaydı yoksa: hesap açılmış, kuruluma
	   bağlanmamış. Sessizce boş ekran göstermek yerine söyleriz. */
	if (error || !data) {
		throw new YetkisizHata(
			'Hesabınız henüz bir firmaya bağlanmamış. Yöneticinize başvurun.'
		);
	}
	if (!data.aktif) throw new YetkisizHata('Hesabınız pasife alınmış.');

	return data as Kullanici;
});

const SIRA: Record<Seviye, number> = { okuma: 1, yazma: 2, yonetim: 3 };

export type YetkiSonucu = {
	kullanici: Kullanici;
	seviye: Seviye;
	/** Modül içinde yönetici mi (müdür / firma yöneticisi / süperadmin) */
	yonetici: boolean;
};

/**
 * Kullanıcının bir modüldeki etkin seviyesini döndürür.
 * Firma o modülü almadıysa yetki yok sayılır — iki katman birden.
 * Karar veri tabanındaki `panel.modul_seviyesi()` fonksiyonundan gelir;
 * mantık tek yerde dursun diye burada tekrarlanmaz.
 */
export const modulSeviyesi = cache(async function modulSeviyesi(
	modul: Modul
): Promise<Seviye | null> {
	const supabase = await sunucuIstemcisi();
	const { data, error } = await supabase.rpc('modul_seviyesi', {
		p_modul: modul,
	});
	if (error) return null;
	return (data as Seviye | null) ?? null;
});

/**
 * Yetki denetler; yetersizse hata fırlatır.
 * @param modul Hangi modül
 * @param gereken En az hangi seviye gerekli
 */
export async function yetkiDenetle(
	modul: Modul,
	gereken: Seviye = 'okuma'
): Promise<YetkiSonucu> {
	const kullanici = await aktifKullanici();
	const seviye = await modulSeviyesi(modul);

	if (!seviye || SIRA[seviye] < SIRA[gereken]) {
		throw new YetkisizHata();
	}

	return { kullanici, seviye, yonetici: seviye === 'yonetim' };
}

/** Hata fırlatmadan sorar — menü ve sekme göstermek için. */
export async function yetkiVarMi(
	modul: Modul,
	gereken: Seviye = 'okuma'
): Promise<boolean> {
	try {
		const seviye = await modulSeviyesi(modul);
		return !!seviye && SIRA[seviye] >= SIRA[gereken];
	} catch {
		return false;
	}
}
