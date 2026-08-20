/* Tarih yardımcıları.

   ⚠️ Sunucu Vercel'de UTC ile çalışıyor, mağaza Türkiye'de. Basitçe
   `new Date().toISOString().slice(0,10)` yazılırsa gece 00:00–03:00
   arasında BİR ÖNCEKİ günün görevleri açılır — kapanış görevlerini
   gece yarısından sonra kapatan bir personelde bu her gün olur.
   Bu yüzden gün her zaman İstanbul saatine göre hesaplanır. */

const BOLGE = 'Europe/Istanbul';

/** Bugünün tarihi, İstanbul saatine göre: 'YYYY-MM-DD' */
export function bugun(): string {
	return gunuBicimle(new Date());
}

/** Bir anı İstanbul saatine göre 'YYYY-MM-DD' biçimine çevirir. */
export function gunuBicimle(an: Date): string {
	/* en-CA yerel biçimi zaten YYYY-MM-DD veriyor; elle parça birleştirmeye
	   göre daha az hata payı var. */
	return an.toLocaleDateString('en-CA', { timeZone: BOLGE });
}

/** Saati okunur biçimde: '14:32' */
export function saatiBicimle(an: string | Date): string {
	const d = typeof an === 'string' ? new Date(an) : an;
	return d.toLocaleTimeString('tr-TR', {
		timeZone: BOLGE,
		hour: '2-digit',
		minute: '2-digit',
	});
}

/** Tarihi okunur biçimde: '20 Ağustos 2026, Perşembe' */
export function tarihiBicimle(gun: string): string {
	return new Date(gun + 'T12:00:00').toLocaleDateString('tr-TR', {
		timeZone: BOLGE,
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		weekday: 'long',
	});
}


/* ============================================================
   RAPOR ARALIKLARI

   Tek yerde tanımlı: rapor ve kroki aynı seçenekleri göstersin,
   biri değişince diğeri geride kalmasın.

   90 gün bilinçli olarak YOK. Günde ~23 görev üretiliyor; üç aylık
   veri hem sorguyu ağırlaştırıyor hem de mağaza işletmecisinin
   bakacağı bir pencere değil. Eğilim 30 günde zaten görünüyor.
   ============================================================ */

export const ARALIKLAR = [
	{ deger: '1', ad: 'Bugün', gun: 1 },
	{ deger: '7', ad: '7 gün', gun: 7 },
	{ deger: '15', ad: '15 gün', gun: 15 },
	{ deger: '30', ad: '30 gün', gun: 30 },
] as const;

export const VARSAYILAN_ARALIK = 7;

/** Adres çubuğundan gelen değeri güvenli bir gün sayısına çevirir. */
export function araligiCoz(deger: string | undefined): number {
	return ARALIKLAR.find((a) => a.deger === deger)?.gun ?? VARSAYILAN_ARALIK;
}

/** Aralığın başlangıç günü. 1 gün = yalnızca bugün. */
export function araliginBasi(gun: number): string {
	const d = new Date(bugun() + 'T12:00:00');
	d.setDate(d.getDate() - (gun - 1));
	return d.toLocaleDateString('en-CA');
}
