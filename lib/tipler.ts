/* Veri tabanı satır türleri.

   ⚠️ GEÇİCİ. Kural, türlerin şemadan üretilmesi:
       npx supabase gen types typescript --project-id <ref> > lib/tipler.ts
   Bunun için Supabase erişim anahtarı (SUPABASE_ACCESS_TOKEN) gerekiyor;
   henüz kurulmadı. Bkz. standartlar/04-KOD.md */

export type Rol = 'superadmin' | 'firma_yoneticisi' | 'kullanici';
export type Seviye = 'okuma' | 'yazma' | 'yonetim';
export type Modul = 'ptp' | 'otp' | 'ttp' | 'mtp';

export type GorevTuru = 'onay' | 'kontrol' | 'bolge' | 'metin' | 'sayi';
export type Tekrar = 'gunluk' | 'haftalik' | 'tek_seferlik';
export type KayitDurumu = 'yapildi' | 'atlandi';
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
	kontrol: 'Kontrol listesi',
	bolge: 'Bölüm seçimi',
	metin: 'Metin girişi',
	sayi: 'Sayı girişi',
};

export const TEKRAR_ADLARI: Record<Tekrar, string> = {
	gunluk: 'Her gün',
	haftalik: 'Haftanın belirli günleri',
	tek_seferlik: 'Yalnızca bir gün',
};

/* 1 = Pazartesi … 7 = Pazar (Postgres isodow düzeni) */
export const GUN_ADLARI: Record<number, string> = {
	1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 7: 'Paz',
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

export type Bolge = {
	id: string;
	ad: string;
	kroki_x: number | null;
	kroki_y: number | null;
	kroki_en: number | null;
	kroki_boy: number | null;
};

export type GorevMaddesi = {
	id: string;
	gorev_id: string;
	metin: string;
	sira: number;
};

/** Görev TANIMI. Üretilmez; her gün bundan hangilerinin geçerli
    olduğu hesaplanır. */
export type Gorev = {
	id: string;
	firma_id: string;
	baslik: string;
	tur: GorevTuru;
	grup: GorevGrubu;
	sira: number;
	zorunlu: boolean;
	tekrarlanabilir: boolean;
	fotograf_ister: boolean;
	ipucu: string;
	aktif: boolean;
	tekrar: Tekrar;
	tekrar_gunleri: number[];
	tek_tarih: string | null;
	atanan_id: string | null;
};

/** Kayıt defteri satırı: ne yapıldı, kim yaptı, ne zaman. */
export type Kayit = {
	id: string;
	gorev_id: string;
	tarih: string;
	zaman: string;
	yapan_id: string | null;
	durum: KayitDurumu;
	baslik_kopya: string;
	bolge_idler: string[];
	madde_idler: string[];
	deger_metin: string | null;
	deger_sayi: number | null;
	not_metni: string;
	yapan: { ad: string } | null;
};

/** Ekranda gösterilen birleşik hâl: tanım + o güne ait kayıtlar. */
export type GunlukGorev = Gorev & {
	atanan: { ad: string } | null;
	maddeler: GorevMaddesi[];
	kayitlar: Kayit[];
};
