/* Alan türleri ve arayüz etiketleri.

   ⚠️ BU DOSYA ÜRETİLMEZ, ELLE YAZILIR.

   Burada iki şey var ve ikisi de şemadan çıkmaz:
     · Alan türleri (GorevTuru, EksikKategori, Rol…) — veritabanında
       metin kolonu + check kısıtı olarak duruyorlar; üretilen türde
       yalnızca "string" görünürler.
     · Arayüz etiketleri (GRUP_ADLARI, KATEGORI_ADLARI…) — Türkçe
       karşılıklar, veritabanında hiç yoklar.

   Satır türleri (Kullanici, Gorev, Kayit…) şemadan ÜRETİLEBİLİR ama
   çıktı BU DOSYAYA YAZILMAZ; ayrı bir dosyaya gider:

       npm run tipler        →  lib/veritabani.ts

   Eskiden buraya "gen types ... > lib/tipler.ts" yazılıydı. O komut
   dosyanın tamamını ezer ve yukarıdaki etiketlerin hepsi silinirdi;
   panel onlarca yerden derlenmez hale gelirdi. Yazılı tarif olduğu
   için er geç birinin çalıştırması an meselesiydi. */

export type Rol = 'superadmin' | 'firma_yoneticisi' | 'kullanici';
export type Seviye = 'okuma' | 'yazma' | 'yonetim';
export type Modul = 'ptp' | 'otp' | 'ttp' | 'mtp' | 'edp';

/** MODÜL LİSTESİ — TEK KAYNAK.

    Aynı liste dört ayrı dosyaya kopyalanmıştı: panel ana sayfası,
    genel bakış raporu, Kişiler ekranı ve Firmalar ekranı. Beşinci
    modül eklenince ikisi güncellendi, ikisi unutuldu ve modül
    arayüzden AÇILAMAZ hale geldi — yetki verilecek yerde
    görünmüyordu. Artık hepsi buradan okuyor. */
export const MODULLER: {
	kod: Modul;
	ad: string;
	aciklama: string;
	yol: string;
}[] = [
	{ kod: 'ptp', ad: 'Personel Takip', aciklama: 'Günlük iş emri ve checklist', yol: '/ptp' },
	{ kod: 'otp', ad: 'Ödeme Takip', aciklama: 'Çek, kredi, ödeme planı', yol: '/otp' },
	{
		kod: 'edp',
		ad: 'Excel Dosya Yükleme',
		aciklama: 'Tedarikçi PDF/Excel → Dia yükleme dosyası',
		yol: '/edp',
	},
	{ kod: 'ttp', ad: 'Tahsilat Takip', aciklama: 'Müşteri alacak takibi', yol: '/ttp' },
	{ kod: 'mtp', ad: 'Mağaza Takip', aciklama: 'Ciro, stok, hedef, prim', yol: '/mtp' },
];

export const MODUL_ADLARI: Record<Modul, string> = Object.fromEntries(
	MODULLER.map((m) => [m.kod, m.ad])
) as Record<Modul, string>;

export type GorevTuru =
	| 'onay'
	| 'kontrol'
	| 'bolge'
	| 'metin'
	| 'sayi'
	| 'eksik'
	| 'ciro';

/** Eksikler tedarik yoluna göre ayrılır. */
export type EksikKategori = 'urun' | 'temel' | 'musteri';
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
	eksik: 'Eksik listesine ekle',
	ciro: 'Gün sonu cirosu',
};

export const KATEGORI_ADLARI: Record<EksikKategori, string> = {
	urun: 'Ürün eksiği',
	temel: 'Temel ihtiyaç',
	musteri: 'Müşteri talebi',
};

export const KATEGORI_NOTU: Record<EksikKategori, string> = {
	urun: 'Fuarlarda toplanır',
	temel: 'Marketten alınır',
	/* Müşterinin isteyip bulamadığı ürün. Ayrı duruyor çünkü bu bir
	   eksik değil TALEP: alınıp alınmayacağı kararı yöneticinin ve
	   aynı ürün birkaç kez istendiyse bu bilgi tek başına değerli. */
	musteri: 'Müşteri istedi',
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
	/** Yalnızca tur = 'eksik' iken dolu: hangi listeye yazacak */
	eksik_kategori: EksikKategori | null;
};

/** Prim kademesi. Üst kademeler sabit tutar değil maaş katı:
    zam geldiğinde prim de kendiliğinden yükselsin diye. */
export type PrimKademesi = {
	id: string;
	oran: number;
	tur: 'sabit' | 'maas_kati';
	tutar: number | null;
	kat: number | null;
};

/** Aylık ciro hedefi. Girilmemişse ayarlardaki varsayılan kullanılır. */
export type Hedef = {
	id: string;
	ay: string;
	hedef: number;
	not_metni: string;
};

/** Tarihli maaş kaydı. Zam yeni satır olarak yazılır. */
export type Maas = {
	id: string;
	kullanici_id: string;
	gecerli_ay: string;
	tutar: number;
};

/** Modül ayarları. */
export type PtpAyarlari = {
	firma_id: string;
	kdv_orani: number;
	varsayilan_hedef: number;
};

/** Mağazanın bir günlük cirosu. Günde tek satır.
    Prim hesabı bunun üzerine kurulacak. */
export type Ciro = {
	id: string;
	tarih: string;
	tutar: number;
	/** KDV hariç karşılığı — veri tabanında üretiliyor */
	net_tutar: number;
	kdv_orani: number;
	fis_sayisi: number | null;
	not_metni: string;
	giren_id: string | null;
	olusturuldu: string;
	guncellendi: string;
	giren: { ad: string } | null;
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
