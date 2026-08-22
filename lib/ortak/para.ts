/* Para yardımcıları.

   Mağazada ciro yazan kişi telefondan giriyor ve rakamı kasadaki
   raporda gördüğü gibi yazıyor: "12.500,50", "12500,50", bazen
   "12.500". Tek bir yazım dayatmak yerine hepsini kabul ediyoruz —
   dayatılan biçim, akşam yorgun bir insanda yanlış rakama dönüşür. */

/**
 * Kullanıcının yazdığı metni sayıya çevirir. Çözemezse null döner.
 *
 * '12.500,50' → 12500.5   (nokta binlik, virgül ondalık)
 * '12500,50'  → 12500.5
 * '12500.50'  → 12500.5   (son parça 3 haneli değil → ondalık)
 * '12.500'    → 12500     (son parça 3 haneli → binlik ayracı)
 */
export function paraCoz(girdi: string): number | null {
	const temiz = girdi
		.replace(/[₺\s ]/g, '')
		.replace(/tl/gi, '')
		.trim();

	if (!temiz) return null;
	if (!/^-?[\d.,]+$/.test(temiz)) return null;

	const noktaVar = temiz.includes('.');
	const virgulVar = temiz.includes(',');

	let normal: string;

	if (noktaVar && virgulVar) {
		/* İkisi birden varsa Türkçe yazım: nokta binlik, virgül ondalık */
		normal = temiz.replace(/\./g, '').replace(',', '.');
	} else if (virgulVar) {
		normal = temiz.replace(',', '.');
	} else if (noktaVar) {
		/* Belirsiz durum: '12.500' binlik mi, ondalık mı?
		   Son parça tam 3 haneliyse binlik ayracıdır — kimse kuruşu
		   üç haneli yazmaz. */
		const parcalar = temiz.split('.');
		const son = parcalar[parcalar.length - 1];
		normal =
			parcalar.length > 1 && son.length === 3
				? parcalar.join('')
				: temiz;
	} else {
		normal = temiz;
	}

	const sayi = Number(normal);
	if (!Number.isFinite(sayi)) return null;
	return Math.round(sayi * 100) / 100;
}

/* Simge sonda yazılıyor: Türkçe kullanım "12.500 ₺" biçiminde.
   Intl'in tr-TR para biçimi simgeyi başa alıyor (₺12.500), o yüzden
   sayı ayrı biçimlendirilip simge elle ekleniyor. */
const SAYI_TAM = new Intl.NumberFormat('tr-TR', {
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

const SAYI_KURUSLU = new Intl.NumberFormat('tr-TR', {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Parayı ekrana yazar: 12500 → '12.500 ₺', 12500.5 → '12.500,50 ₺'
 *
 * Kuruş yalnızca VARSA gösteriliyor. Hep gösterilseydi alt alta
 * dizilen ciro satırları ',00' gürültüsüyle dolardı; hiç
 * gösterilmeseydi satırlar yuvarlanır ve aylık toplam satırların
 * toplamını tutmazdı — para ekranında bu hata gibi görünür.
 */
export function paraBicimle(tutar: number, kurus?: boolean): string {
	const kuruslu = kurus ?? tutar % 1 !== 0;
	return `${(kuruslu ? SAYI_KURUSLU : SAYI_TAM).format(tutar)} ₺`;
}

/** Yüzde değişim: 100 → 120 için '+%20'. Taban sıfırsa null. */
export function degisim(yeni: number, eski: number): number | null {
	if (eski === 0) return null;
	return ((yeni - eski) / eski) * 100;
}

/** '+%20' / '−%8' — işaret açık yazılır, yön bir bakışta okunsun. */
export function degisimBicimle(yuzde: number): string {
	const yuvarlak = Math.round(yuzde);
	if (yuvarlak === 0) return '%0';
	return `${yuvarlak > 0 ? '+' : '−'}%${Math.abs(yuvarlak)}`;
}
