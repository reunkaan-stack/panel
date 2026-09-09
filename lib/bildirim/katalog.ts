/* ============================================================
   BİLDİRİM OLAY KATALOĞU

   Panelin bildirim altyapısının merkezi. Her modül olaylarını
   buraya yazar; ayarlar ekranı bu listeden üretilir.

   ⚠️ YENİ MODÜL EKLERKEN:
   1. Olayları buraya ekle (kod, ad, açıklama, tür)
   2. Anlık olaysa modülün eyleminden `bildir()` çağır
   3. Zamanlıysa `lib/bildirim/zamanli.ts` içine işleyicisini yaz
   Başka hiçbir yere dokunmak gerekmiyor: şema değişmez, ayarlar
   ekranı kendini günceller, zamanlayıcı yeni olayı kendiliğinden
   toplar.

   Olay listesi neden tabloda değil: olayın adı, açıklaması ve nasıl
   üretildiği koda ait bilgi. Tabloda tutulsaydı kod ile tablo
   ayrışır ve "bu olay ne yapıyordu" sorusunun cevabı iki yere
   bölünürdü. Tabloda yalnızca kullanıcının kararı duruyor.
   ============================================================ */

export type OlayTuru = 'anlik' | 'zamanli';

export type OlayTanimi = {
	/** Modül önekli kod: 'ptp.gunluk_ozet' */
	kod: string;
	/** Ayarlar ekranındaki başlık */
	ad: string;
	/** Ne zaman gönderildiğini anlatan bir cümle */
	aciklama: string;
	tur: OlayTuru;
	/** Zamanlı olaylarda varsayılan gönderim saati */
	varsayilanSaat?: string;
	varsayilanAcik: boolean;
};

export type OlayGrubu = {
	/** Modül kodu ya da 'sistem' */
	modul: string;
	ad: string;
	olaylar: OlayTanimi[];
};

export const KATALOG: OlayGrubu[] = [
	{
		modul: 'sistem',
		ad: 'Sistem',
		olaylar: [
			{
				kod: 'sistem.oturum_acildi',
				ad: 'Kullanıcı giriş yaptı',
				aciklama: 'Bir kullanıcı panele her girdiğinde haber verir.',
				tur: 'anlik',
				/* Varsayılan kapalı: günde birkaç kez giriş yapan bir
				   ekipte bu bildirim hızla gürültüye dönüşüyor. */
				varsayilanAcik: false,
			},
		],
	},
	{
		modul: 'ptp',
		ad: 'Personel Takip',
		olaylar: [
			{
				kod: 'ptp.gorev_yapildi',
				ad: 'Görev kapatıldı',
				aciklama:
					'Her görev kapatıldığında haber verir. Günde yirmiden fazla mesaj olabilir.',
				tur: 'anlik',
				varsayilanAcik: true,
			},
			{
				kod: 'ptp.gun_kapandi',
				ad: 'Gün kapatıldı',
				aciklama:
					'Akşam “Günü kapat” ile toplu kayıt yapıldığında tek mesaj gönderir.',
				tur: 'anlik',
				varsayilanAcik: true,
			},
			{
				kod: 'ptp.eksik_bildirildi',
				ad: 'Eksik bildirildi',
				aciklama: 'Personel bir ürünün bittiğini yazdığında haber verir.',
				tur: 'anlik',
				varsayilanAcik: true,
			},
			{
				kod: 'ptp.kapanis_hatirlatma',
				ad: 'Kapanış hatırlatması',
				aciklama:
					'Kapatılmamış görev varsa hatırlatır. Hepsi bittiyse mesaj gitmez.',
				tur: 'zamanli',
				varsayilanSaat: '21:30',
				varsayilanAcik: true,
			},
			{
				kod: 'ptp.gunluk_ozet',
				ad: 'Günlük özet',
				aciklama:
					'Tamamlanma oranı, ciro, yapılmayanlar ve gün içinde yazılan notlar.',
				tur: 'zamanli',
				varsayilanSaat: '22:00',
				varsayilanAcik: true,
			},
		],
	},
	{
		modul: 'otp',
		ad: 'Ödeme Takip',
		olaylar: [
			{
				kod: 'otp.vade_ozeti',
				ad: 'Vade özeti',
				aciklama:
					'Bugün vadesi gelen çek, senet ve kredi taksitleri; ardından önümüzdeki yedi gün. Ödeme yoksa mesaj gitmez.',
				tur: 'zamanli',
				varsayilanSaat: '09:00',
				varsayilanAcik: true,
			},
		],
	},
];

/** Düz liste — arama ve doğrulama için. */
export const OLAYLAR: OlayTanimi[] = KATALOG.flatMap((g) => g.olaylar);

export function olayTanimi(kod: string): OlayTanimi | undefined {
	return OLAYLAR.find((o) => o.kod === kod);
}

/** Olayın ait olduğu modül kodu: 'ptp.gunluk_ozet' → 'ptp' */
export function olayinModulu(kod: string): string {
	return kod.split('.')[0];
}
