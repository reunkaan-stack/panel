/* Veri tabanı satır türleri.

   ⚠️ GEÇİCİ. Kural, türlerin şemadan üretilmesi:
       npx supabase gen types typescript --project-id <ref> > lib/tipler.ts
   Bunun için Supabase erişim anahtarı (SUPABASE_ACCESS_TOKEN) gerekiyor;
   henüz kurulmadı. Anahtar eklendiğinde bu dosya üretilenle değiştirilir
   ve elle bakım biter. Bkz. standartlar/04-KOD.md */

export type Rol = 'superadmin' | 'firma_yoneticisi' | 'kullanici';
export type Seviye = 'okuma' | 'yazma' | 'yonetim';
export type Modul = 'ptp' | 'otp' | 'ttp' | 'mtp';

export type GorevTuru = 'onay' | 'bolge' | 'metin' | 'sayi';
export type GorevDurumu = 'bekliyor' | 'tamamlandi' | 'atlandi';
export type GorevGrubu =
	| 'acilis'
	| 'teshir'
	| 'gunici'
	| 'depo'
	| 'musteri'
	| 'kapanis';

export const GRUP_ADLARI: Record<GorevGrubu, string> = {
	acilis: 'Açılış',
	teshir: 'Teşhir',
	gunici: 'Gün içi',
	depo: 'Depo',
	musteri: 'Müşteri',
	kapanis: 'Kapanış',
};

export const TUR_ADLARI: Record<GorevTuru, string> = {
	onay: 'Yapıldı işareti',
	bolge: 'Bölüm seçimi',
	metin: 'Metin girişi',
	sayi: 'Sayı girişi',
};

export type Kullanici = {
	id: string;
	auth_id: string;
	firma_id: string | null;
	ad: string;
	eposta: string;
	rol: Rol;
	aktif: boolean;
};

export type Gorev = {
	id: string;
	firma_id: string;
	sablon_id: string | null;
	tarih: string;
	grup: GorevGrubu;
	baslik: string;
	tur: GorevTuru;
	zorunlu: boolean;
	fotograf_ister: boolean;
	ipucu: string;
	slot: string | null;
	durum: GorevDurumu;
	deger_onay: boolean | null;
	deger_bolge_id: string | null;
	deger_metin: string | null;
	deger_sayi: number | null;
	fotograf_yolu: string | null;
	atanan_id: string | null;
	tamamlayan_id: string | null;
	tamamlanma_zamani: string | null;
	atlama_sebebi: string | null;
	kaynak: 'sablon' | 'elle' | 'telegram';
};

/** Görev listesinde kişi adlarıyla birlikte gelen hâli. */
export type GorevSatiri = Gorev & {
	atanan: { ad: string } | null;
	tamamlayan: { ad: string } | null;
};
