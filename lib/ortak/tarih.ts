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
