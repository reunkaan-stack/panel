/* Teklif türleri ve toplam hesabı.

   Hesap saf fonksiyonda: düzenleme ekranı ve yazdırma sayfası aynı
   rakamı göstermek zorunda. İki yerde ayrı ayrı çarpılsaydı biri
   eninde sonunda diğerinden sapardı — teklifte bu, müşteriye yanlış
   rakam göndermek demek. */

export type TeklifDurumu = 'taslak' | 'gonderildi' | 'kabul' | 'red';

export const DURUM_ADLARI: Record<TeklifDurumu, string> = {
	taslak: 'Taslak',
	gonderildi: 'Gönderildi',
	kabul: 'Kabul edildi',
	red: 'Reddedildi',
};

export type Teklif = {
	id: string;
	no: string;
	musteri_ad: string;
	musteri_firma: string;
	musteri_eposta: string;
	musteri_telefon: string;
	baslik: string;
	giris: string;
	kosullar: string;
	tarih: string;
	gecerlilik: string | null;
	indirim: number;
	kdv_orani: number;
	durum: TeklifDurumu;
	olusturuldu: string;
};

export type TeklifKalemi = {
	id: string;
	sira: number;
	baslik: string;
	aciklama: string;
	miktar: number;
	birim: string;
	birim_fiyat: number;
	toplam: number;
};

export type Toplamlar = {
	araToplam: number;
	indirim: number;
	indirimliToplam: number;
	kdv: number;
	genelToplam: number;
};

export function toplamlar(
	kalemler: { miktar: number; birim_fiyat: number }[],
	indirim: number,
	kdvOrani: number
): Toplamlar {
	const araToplam = kalemler.reduce(
		(t, k) => t + Number(k.miktar) * Number(k.birim_fiyat),
		0
	);

	/* İndirim ara toplamı aşamaz: aşarsa eksi bir teklif çıkar ve
	   kimse bunu fark etmeden gönderebilir. */
	const uygulanan = Math.min(Math.max(0, indirim), araToplam);
	const indirimliToplam = araToplam - uygulanan;
	const kdv = (indirimliToplam * kdvOrani) / 100;

	return {
		araToplam,
		indirim: uygulanan,
		indirimliToplam,
		kdv,
		genelToplam: indirimliToplam + kdv,
	};
}
