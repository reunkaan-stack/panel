'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yonetimAyarli, yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { superadminDenetle, YetkisizHata } from '@/lib/yetki';
import type { Modul, Rol, Seviye } from '@/lib/tipler';
import type { Sonuc } from '../ptp/eylemler';

/* Kişi yönetimi — yalnızca süperadmin.

   Hesap açmak iki yere yazmak demek: Supabase'in auth tablosuna ve
   panel.kullanicilar'a. Birincisi normal anahtarla yapılamaz, yönetim
   istemcisi gerekiyor. İkincisi normal istemciyle yapılıyor ki RLS
   devrede kalsın.

   Sıra önemli: önce auth, sonra panel. Panel kaydı yazılamazsa auth
   hesabı GERİ ALINIYOR — yoksa giriş yapabilen ama hiçbir firmaya
   bağlı olmayan yetim bir hesap kalırdı. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };
	console.error('[kisiler]', e);
	return { tamam: false, mesaj: varsayilan };
}

const EPOSTA_DESENI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type KisiGirdisi = {
	ad: string;
	eposta: string;
	sifre: string;
	rol: Rol;
	firmaId: string | null;
	yetkiler: { modul: Modul; seviye: Seviye }[];
};

function girdiDenetle(girdi: KisiGirdisi): string | null {
	if (!girdi.ad.trim()) return 'Ad yazılmalı.';
	if (!EPOSTA_DESENI.test(girdi.eposta.trim())) return 'E-posta geçersiz.';

	/* Sekiz karakter Supabase'in alt sınırının üstünde. Mağaza
	   çalışanının aklında tutacağı bir şey olacak; daha uzun bir kural
	   koymak kâğıda yazılmasına yol açar. */
	if (girdi.sifre.length < 8) return 'Şifre en az 8 karakter olmalı.';

	/* Kısıt da zorluyor ama hata mesajı okunmaz olurdu. */
	if (girdi.rol === 'superadmin' && girdi.firmaId) {
		return 'Süperadmin bir firmaya bağlanmaz.';
	}
	if (girdi.rol !== 'superadmin' && !girdi.firmaId) {
		return 'Firma seçilmeli.';
	}
	return null;
}

/** Yeni hesap açar: auth kaydı + panel kaydı + modül yetkileri. */
export async function kisiEkle(girdi: KisiGirdisi): Promise<Sonuc> {
	try {
		const yonetici = await superadminDenetle();

		if (!yonetimAyarli()) {
			return {
				tamam: false,
				mesaj:
					'Hesap açma kapalı: SUPABASE_SERVICE_ROLE_KEY tanımlı değil. Vercel ortam değişkenlerine ekleyin.',
			};
		}

		const sorun = girdiDenetle(girdi);
		if (sorun) return { tamam: false, mesaj: sorun };

		const eposta = girdi.eposta.trim().toLowerCase();
		const admin = yonetimIstemcisi();

		/* 1. Auth hesabı. email_confirm: doğrulama postası beklenmiyor —
		   hesabı zaten yönetici açıyor, kişi şifresini ondan alıyor. */
		const { data: authSonuc, error: authHatasi } =
			await admin.auth.admin.createUser({
				email: eposta,
				password: girdi.sifre,
				email_confirm: true,
			});

		if (authHatasi || !authSonuc.user) {
			const mesaj = authHatasi?.message ?? '';
			return {
				tamam: false,
				mesaj: mesaj.toLowerCase().includes('already')
					? 'Bu e-posta ile bir hesap zaten var.'
					: 'Hesap açılamadı. E-postayı ve şifreyi kontrol edin.',
			};
		}

		const supabase = await sunucuIstemcisi();

		/* 2. Panel kaydı. Buradan sonrası hata verirse auth hesabı geri
		   alınıyor; yarım kalmış hesap giriş yapar ama hiçbir yere
		   ulaşamaz ve kimse neden olduğunu anlamaz. */
		const { data: kisi, error: kisiHatasi } = await supabase
			.from('kullanicilar')
			.insert({
				auth_id: authSonuc.user.id,
				firma_id: girdi.firmaId,
				ad: girdi.ad.trim(),
				eposta,
				rol: girdi.rol,
				aktif: true,
			})
			.select('id')
			.single();

		if (kisiHatasi || !kisi) {
			await admin.auth.admin.deleteUser(authSonuc.user.id);
			throw kisiHatasi ?? new Error('Panel kaydı yazılamadı');
		}

		/* 3. Modül yetkileri. Firma yöneticisi ve süperadmin zaten her
		   modülde yönetim sayılıyor; onlara satır yazmaya gerek yok. */
		if (girdi.rol === 'kullanici' && girdi.yetkiler.length > 0) {
			const { error: yetkiHatasi } = await supabase
				.from('modul_yetkileri')
				.insert(
					girdi.yetkiler.map((y) => ({
						kullanici_id: kisi.id,
						modul: y.modul,
						seviye: y.seviye,
					}))
				);
			if (yetkiHatasi) throw yetkiHatasi;
		}

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: yonetici.id,
			firma_id: girdi.firmaId,
			eylem: 'kisi_eklendi',
			hedef_tablo: 'kullanicilar',
			hedef_id: kisi.id,
			ayrinti: { eposta, rol: girdi.rol },
		});

		revalidatePath('/kisiler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kişi eklenemedi. Tekrar deneyin.');
	}
}

/** Ad, rol, firma ve modül yetkilerini günceller. */
export async function kisiGuncelle(
	kisiId: string,
	ad: string,
	rol: Rol,
	firmaId: string | null,
	yetkiler: { modul: Modul; seviye: Seviye }[]
): Promise<Sonuc> {
	try {
		const yonetici = await superadminDenetle();

		if (!ad.trim()) return { tamam: false, mesaj: 'Ad yazılmalı.' };
		if (kisiId === yonetici.id) {
			return {
				tamam: false,
				mesaj: 'Kendi rolünüzü buradan değiştiremezsiniz.',
			};
		}
		if (rol === 'superadmin' && firmaId) {
			return { tamam: false, mesaj: 'Süperadmin bir firmaya bağlanmaz.' };
		}
		if (rol !== 'superadmin' && !firmaId) {
			return { tamam: false, mesaj: 'Firma seçilmeli.' };
		}

		const supabase = await sunucuIstemcisi();

		const { error } = await supabase
			.from('kullanicilar')
			.update({ ad: ad.trim(), rol, firma_id: firmaId })
			.eq('id', kisiId);
		if (error) throw error;

		/* Yetkiler tümüyle yeniden yazılıyor: hangi satırın kalktığını
		   tek tek karşılaştırmak yerine sil-yaz. Satır sayısı bir elin
		   parmakları kadar. */
		const { error: silmeHatasi } = await supabase
			.from('modul_yetkileri')
			.delete()
			.eq('kullanici_id', kisiId);
		if (silmeHatasi) throw silmeHatasi;

		if (rol === 'kullanici' && yetkiler.length > 0) {
			const { error: yazmaHatasi } = await supabase
				.from('modul_yetkileri')
				.insert(
					yetkiler.map((y) => ({
						kullanici_id: kisiId,
						modul: y.modul,
						seviye: y.seviye,
					}))
				);
			if (yazmaHatasi) throw yazmaHatasi;
		}

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: yonetici.id,
			firma_id: firmaId,
			eylem: 'kisi_guncellendi',
			hedef_tablo: 'kullanicilar',
			hedef_id: kisiId,
			ayrinti: { rol, yetkiler },
		});

		revalidatePath('/kisiler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Güncellenemedi. Tekrar deneyin.');
	}
}

/**
 * Hesabı pasife alır ya da geri açar.
 *
 * Pasif hesap giriş yapsa bile panele giremez: aktifKullanici() aktif
 * olmayanı reddediyor. Kayıtları duruyor — "bu görevi kim yaptı"
 * sorusunun cevabı kaybolmamalı.
 */
export async function kisiDurumDegistir(
	kisiId: string,
	aktif: boolean
): Promise<Sonuc> {
	try {
		const yonetici = await superadminDenetle();
		if (kisiId === yonetici.id) {
			return { tamam: false, mesaj: 'Kendi hesabınızı kapatamazsınız.' };
		}

		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('kullanicilar')
			.update({ aktif })
			.eq('id', kisiId);
		if (error) throw error;

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: yonetici.id,
			eylem: aktif ? 'kisi_acildi' : 'kisi_kapatildi',
			hedef_tablo: 'kullanicilar',
			hedef_id: kisiId,
		});

		revalidatePath('/kisiler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Değiştirilemedi. Tekrar deneyin.');
	}
}

/**
 * Hesabı KALICI siler — auth kaydıyla birlikte.
 *
 * Yalnızca hiç iz bırakmamış hesaplar için: yanlış açılmış, hiç
 * kullanılmamış. Kaydı olan biri silinirse "bu görevi kim yaptı"
 * sorusunun cevabı kaybolur ve maaş geçmişi cascade ile gider.
 * O yüzden önce sayılıyor, varsa reddediliyor.
 */
export async function kisiSil(kisiId: string): Promise<Sonuc> {
	try {
		const yonetici = await superadminDenetle();
		if (kisiId === yonetici.id) {
			return { tamam: false, mesaj: 'Kendi hesabınızı silemezsiniz.' };
		}

		if (!yonetimAyarli()) {
			return {
				tamam: false,
				mesaj: 'Silme kapalı: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.',
			};
		}

		const supabase = await sunucuIstemcisi();

		const { data: kisi } = await supabase
			.from('kullanicilar')
			.select('id, auth_id, ad')
			.eq('id', kisiId)
			.maybeSingle();

		if (!kisi) return { tamam: false, mesaj: 'Kişi bulunamadı.' };

		const [kayit, ciro, maas] = await Promise.all([
			supabase
				.from('ptp_kayitlar')
				.select('id', { count: 'exact', head: true })
				.eq('yapan_id', kisiId),
			supabase
				.from('ptp_cirolar')
				.select('id', { count: 'exact', head: true })
				.eq('giren_id', kisiId),
			supabase
				.from('ptp_maaslar')
				.select('id', { count: 'exact', head: true })
				.eq('kullanici_id', kisiId),
		]);

		const iz =
			(kayit.count ?? 0) + (ciro.count ?? 0) + (maas.count ?? 0);

		if (iz > 0) {
			return {
				tamam: false,
				mesaj: `Bu kişinin ${iz} kaydı var; kalıcı silinemez. Bunun yerine pasife alın — geçmişi korunur, girişi kapanır.`,
			};
		}

		/* auth kaydını silmek yeterli: kullanicilar.auth_id üzerinde
		   `on delete cascade` var, panel kaydı onunla birlikte gidiyor. */
		const admin = yonetimIstemcisi();
		const { error } = await admin.auth.admin.deleteUser(kisi.auth_id);
		if (error) throw error;

		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: yonetici.id,
			eylem: 'kisi_silindi',
			hedef_tablo: 'kullanicilar',
			hedef_id: kisiId,
			ayrinti: { ad: kisi.ad },
		});

		revalidatePath('/kisiler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}

/** Şifreyi değiştirir. Kişi unuttuğunda süperadmin yenisini verir. */
export async function sifreDegistir(
	kisiId: string,
	yeniSifre: string
): Promise<Sonuc> {
	try {
		const yonetici = await superadminDenetle();

		if (yeniSifre.length < 8) {
			return { tamam: false, mesaj: 'Şifre en az 8 karakter olmalı.' };
		}
		if (!yonetimAyarli()) {
			return {
				tamam: false,
				mesaj: 'Şifre değiştirme kapalı: SUPABASE_SERVICE_ROLE_KEY tanımlı değil.',
			};
		}

		const supabase = await sunucuIstemcisi();
		const { data: kisi } = await supabase
			.from('kullanicilar')
			.select('auth_id')
			.eq('id', kisiId)
			.maybeSingle();

		if (!kisi) return { tamam: false, mesaj: 'Kişi bulunamadı.' };

		const admin = yonetimIstemcisi();
		const { error } = await admin.auth.admin.updateUserById(kisi.auth_id, {
			password: yeniSifre,
		});
		if (error) throw error;

		/* Şifrenin KENDİSİ hiçbir yere yazılmıyor; yalnızca değiştirildiği
		   bilgisi kayda geçiyor. */
		await supabase.from('denetim_kayitlari').insert({
			kullanici_id: yonetici.id,
			eylem: 'sifre_degistirildi',
			hedef_tablo: 'kullanicilar',
			hedef_id: kisiId,
		});

		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Şifre değiştirilemedi. Tekrar deneyin.');
	}
}
