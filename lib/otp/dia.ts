/* DIA raporu okuma ve eşleştirme.

   Saf mantık: dosya okuma ve veri tabanı burada yok, hepsi girdi-çıktı.
   Böylece gerçek dosyayla çalıştırılarak sınanabiliyor.

   ⚠️ KOLONLAR YERİNE GÖRE DEĞİL BAŞLIK ADINA GÖRE okunuyor. Yerel
   program B, E, F diye sabit harflerle okuyordu; DIA'da rapor kolonları
   özelleştirilebildiği için bir kolon eklenip çıktığında her şey kayar
   ve YANLIŞ VERİ SESSİZCE girer. Başlık bulunamazsa iş durur ve
   kullanıcıya hangi kolonun ne olduğu sorulur. */

export type AlanKodu =
	| 'tur'
	| 'durum'
	| 'seriNo'
	| 'vade'
	| 'borclu'
	| 'firma'
	| 'tutar'
	| 'hedef'
	| 'banka'
	| 'not'
	| 'taksitNo'
	| 'odenen'
	| 'kalan'
	| 'anapara'
	| 'faiz'
	| 'bsmv'
	| 'krediKod'
	| 'krediAd';

export type AlanTanimi = {
	kod: AlanKodu;
	ad: string;
	zorunlu: boolean;
	/** Başlıkta aranan parçalar; küçük harfe indirilip karşılaştırılır */
	kaliplar: string[];
	/** Aynı kalıba birden çok kolon uyarsa sonuncusu seçilir */
	sonuncuyuSec?: boolean;
};

/* ---------- Çek / senet ---------- */

export const CEK_ALANLARI: AlanTanimi[] = [
	{ kod: 'tur', ad: 'Türü', zorunlu: true, kaliplar: ['türü', 'turu', 'tür'] },
	{
		kod: 'durum',
		ad: 'Durumu',
		zorunlu: true,
		kaliplar: ['durumu', 'durum'],
		/* DIA iki "Durumu" kolonu basıyor: biri kod (KCEK), biri okunur
		   metin. Metin olan sonra geliyor ve durum eşlemesi ona bakıyor. */
		sonuncuyuSec: true,
	},
	{ kod: 'vade', ad: 'Vade', zorunlu: true, kaliplar: ['vade'] },
	{ kod: 'tutar', ad: 'Tutar', zorunlu: true, kaliplar: ['tutar'] },
	{ kod: 'firma', ad: 'Cari Hesap', zorunlu: true, kaliplar: ['cari hesap', 'cari'] },
	{ kod: 'seriNo', ad: 'Seri No', zorunlu: false, kaliplar: ['seri no', 'seri'] },
	{ kod: 'borclu', ad: 'Borçlu', zorunlu: false, kaliplar: ['borçlu', 'borclu'] },
	{
		kod: 'hedef',
		ad: 'Tahsil/Teminat–Ciro',
		zorunlu: false,
		kaliplar: ['tahsil/teminat', 'ciro carisi', 'tahsil'],
	},
	{ kod: 'banka', ad: 'Banka Adı', zorunlu: false, kaliplar: ['banka adı', 'banka'] },
	{ kod: 'not', ad: 'Açıklama', zorunlu: false, kaliplar: ['açıklama', 'aciklama'] },
];

/* ---------- Kredi taksitleri ---------- */

export const KREDI_ALANLARI: AlanTanimi[] = [
	{ kod: 'taksitNo', ad: 'Taksit No', zorunlu: true, kaliplar: ['taksit no', 'taksit'] },
	{ kod: 'vade', ad: 'Vade', zorunlu: true, kaliplar: ['vade'] },
	{ kod: 'tutar', ad: 'Taksit Tutarı', zorunlu: true, kaliplar: ['tutar'] },
	{ kod: 'krediKod', ad: 'Kredi Kodu', zorunlu: true, kaliplar: ['kredi kodu', 'kod'] },
	{ kod: 'krediAd', ad: 'Kredi Adı', zorunlu: false, kaliplar: ['kredi adı', 'kredi ad', 'açıklama'] },
	{ kod: 'odenen', ad: 'Ödenen', zorunlu: false, kaliplar: ['ödenen', 'odenen'] },
	{ kod: 'kalan', ad: 'Kalan', zorunlu: false, kaliplar: ['kalan'] },
	{ kod: 'anapara', ad: 'Anapara', zorunlu: false, kaliplar: ['anapara'] },
	{ kod: 'faiz', ad: 'Faiz', zorunlu: false, kaliplar: ['faiz'] },
	{ kod: 'bsmv', ad: 'BSMV', zorunlu: false, kaliplar: ['bsmv', 'kkdf'] },
];

export type RaporTuru = 'cek' | 'kredi';
/** Alan kodu → kolon sırası (0'dan) */
export type Esleme = Partial<Record<AlanKodu, number>>;

/* ---------- Yardımcılar ---------- */

const kucuk = (s: unknown): string =>
	String(s ?? '')
		.replace(/İ/g, 'i')
		.replace(/I/g, 'ı')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();

export const buyuk = (s: unknown): string =>
	String(s ?? '')
		.replace(/i/g, 'İ')
		.replace(/ı/g, 'I')
		.toUpperCase()
		.replace(/\s+/g, ' ')
		.trim();

const metin = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Seri no karşılaştırma anahtarı: yalnızca harf ve rakam. */
export function seriAnahtar(s: unknown): string {
	return String(s ?? '')
		.toUpperCase()
		.replace(/[^A-Z0-9İĞÜŞÖÇ]/g, '');
}

/** Tarih hücresi → 'YYYY-MM-DD'. Tarih değilse null. */
export function gunuCoz(h: unknown): string | null {
	if (h instanceof Date && !Number.isNaN(h.getTime())) {
		/* Hücre gün bilgisi taşıyor, saat değil; UTC okumak kaydırmayı
		   önlüyor. Yerel saate çevirseydik gece yarısı bir gün geriye
		   düşebilirdi. */
		return h.toISOString().slice(0, 10);
	}
	if (typeof h === 'string' && /^\d{4}-\d{2}-\d{2}/.test(h)) return h.slice(0, 10);
	return null;
}

function sayi(h: unknown): number {
	if (typeof h === 'number') return h;
	const t = String(h ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
	const n = Number(t);
	return Number.isFinite(n) ? n : 0;
}

export function gunFark(a: string, b: string): number {
	const x = new Date(a + 'T12:00:00Z').getTime();
	const y = new Date(b + 'T12:00:00Z').getTime();
	return Math.abs(Math.round((x - y) / 86400000));
}

/* ---------- Başlık satırını bulma ---------- */

export type BaslikSonucu = {
	baslikSatiri: number;
	basliklar: string[];
	tur: RaporTuru | null;
};

/**
 * Başlık satırını içerikten bulur.
 *
 * DIA çıktısında ilk satırlar boş ve rapor adı olabiliyor; başlıklar
 * dördüncü satırda. Sabit satır numarası varsaymak yerine "Seri No"
 * ya da "Taksit No" geçen satır aranıyor — rapor biçimi değişse de
 * tutar.
 */
export function baslikBul(satirlar: unknown[][]): BaslikSonucu {
	for (let i = 0; i < Math.min(15, satirlar.length); i++) {
		const s = (satirlar[i] ?? []).map(kucuk);
		const birlesik = s.join('|');

		if (birlesik.includes('taksit no')) {
			return { baslikSatiri: i, basliklar: (satirlar[i] ?? []).map(metin), tur: 'kredi' };
		}
		if (birlesik.includes('seri no')) {
			return { baslikSatiri: i, basliklar: (satirlar[i] ?? []).map(metin), tur: 'cek' };
		}
	}
	return { baslikSatiri: -1, basliklar: [], tur: null };
}

/* ---------- Otomatik eşleme ---------- */

export type EslemeSonucu = {
	esleme: Esleme;
	/** Bulunamayan zorunlu alanlar */
	eksik: AlanTanimi[];
};

export function otomatikEsle(
	basliklar: string[],
	alanlar: AlanTanimi[]
): EslemeSonucu {
	const kucukBasliklar = basliklar.map(kucuk);
	const esleme: Esleme = {};
	const kullanilan = new Set<number>();
	const eksik: AlanTanimi[] = [];

	for (const alan of alanlar) {
		let bulunan: number | undefined;

		for (const kalip of alan.kaliplar) {
			const uyanlar = kucukBasliklar
				.map((b, i) => ({ b, i }))
				.filter(({ b, i }) => b.includes(kalip) && !kullanilan.has(i));

			if (uyanlar.length === 0) continue;

			/* Aynı kalıba birden çok kolon uyarsa: durum alanında
			   sonuncusu (okunur metin), diğerlerinde ilki. */
			bulunan = alan.sonuncuyuSec
				? uyanlar[uyanlar.length - 1].i
				: uyanlar[0].i;
			break;
		}

		if (bulunan === undefined) {
			if (alan.zorunlu) eksik.push(alan);
			continue;
		}

		esleme[alan.kod] = bulunan;
		kullanilan.add(bulunan);
	}

	return { esleme, eksik };
}

/**
 * Başlık satırının parmak izi. Aynı biçimde bir dosya tekrar
 * geldiğinde öğrenilen eşleme kullanılsın diye.
 */
export function parmakIzi(basliklar: string[]): string {
	return basliklar
		.map(kucuk)
		.filter(Boolean)
		.join('|')
		.slice(0, 500);
}

/* ---------- Durum eşlemesi ---------- */

export const SON_DURUM: Record<string, string> = {
	VERILEN: 'ODENDI',
	ALINAN: 'TAHSIL',
};

/* KARŞILIKSIZ ve İPTAL yeni ve kritik bilgi sayılır: panelde ödenmiş
   görünse bile her zaman uygulanır. */
const KRITIK = new Set(['KARSILIKSIZ', 'IPTAL']);

/**
 * DIA'nın durum metnini panelin durumuna çevirir.
 * Yerel programdaki eşlemenin birebir aynısı.
 */
export function durumCoz(durumMetni: string, yon: string): string {
	const d = kucuk(durumMetni);

	if (d.includes('tahsil edildi') || d.includes('ödendi') || d.includes('odendi')) {
		return yon === 'ALINAN' ? 'TAHSIL' : 'ODENDI';
	}
	if (d.includes('tahsile')) return yon === 'ALINAN' ? 'TAHSILDE' : 'BEKLIYOR';
	if (d.includes('teminat')) return yon === 'ALINAN' ? 'TEMINATTA' : 'BEKLIYOR';
	if (d.includes('ciro')) return 'CIROLANDI';
	if (d.includes('iptal')) return 'IPTAL';
	if (d.includes('karşılıksız') || d.includes('karsiliksiz') ||
		d.includes('ödenmedi') || d.includes('protesto')) {
		return 'KARSILIKSIZ';
	}
	return yon === 'ALINAN' ? 'PORTFOYDE' : 'BEKLIYOR';
}

/**
 * "Durum geriye düşmez" kuralı.
 *
 * Panelde ÖDENDİ/TAHSİL EDİLDİ olmuş bir kayıt, DIA'nın geç işlenmiş
 * muhasebe kaydıyla otomatik geri döndürülmez. Kullanıcı ödediğini
 * biliyor; DIA'daki eksiklik onun bilgisini silmemeli.
 */
export function durumKorunmali(
	mevcutYon: string,
	mevcutDurum: string,
	yeniDurum: string
): boolean {
	const son = SON_DURUM[mevcutYon];
	return !!son && mevcutDurum === son && yeniDurum !== son && !KRITIK.has(yeniDurum);
}

/* ---------- Satır çözme ---------- */

export type DiaCek = {
	yon: string;
	tur: string;
	durum: string;
	tarih: string;
	firma: string;
	borclu: string;
	banka: string;
	hedef: string;
	tutar: number;
	seriNo: string;
	not: string;
};

export function cekleriCoz(
	satirlar: unknown[][],
	baslikSatiri: number,
	esleme: Esleme
): DiaCek[] {
	const al = (s: unknown[], k: AlanKodu): unknown =>
		esleme[k] === undefined ? undefined : s[esleme[k]!];

	const cikti: DiaCek[] = [];

	for (let i = baslikSatiri + 1; i < satirlar.length; i++) {
		const s = satirlar[i] ?? [];

		const tarih = gunuCoz(al(s, 'vade'));
		const turMetni = metin(al(s, 'tur'));
		const tutarHam = al(s, 'tutar');

		/* Üç zorunlu değer yoksa satır veri değil (boş satır, ara
		   toplam, dipnot). Yerel program da böyle eliyordu. */
		if (!tarih || !turMetni || typeof tutarHam !== 'number') continue;

		const tl = kucuk(turMetni);
		const yon = tl.includes('müşteri') || tl.includes('musteri') ? 'ALINAN' : 'VERILEN';
		const tur = tl.includes('senet') || tl.includes('sened') ? 'SENET' : 'ÇEK';
		const durum = durumCoz(metin(al(s, 'durum')), yon);

		/* Hedef yalnızca alınan çekler tahsile/teminata/ciroya
		   gittiğinde anlamlı. Kolon "320.01.0000018/BALSA…" biçiminde;
		   eğik çizgiden sonrası cari adı. */
		let hedef = '';
		if (yon === 'ALINAN' && ['TAHSILDE', 'TEMINATTA', 'CIROLANDI'].includes(durum)) {
			const ham = metin(al(s, 'hedef'));
			hedef = ham.includes('/') ? metin(ham.slice(ham.indexOf('/') + 1)) : ham;
		}

		cikti.push({
			yon,
			tur,
			durum,
			tarih,
			firma: buyuk(al(s, yon === 'ALINAN' ? 'borclu' : 'firma')),
			borclu: buyuk(al(s, 'borclu')),
			banka: buyuk(al(s, 'banka')),
			hedef: buyuk(hedef),
			tutar: Math.round(sayi(tutarHam) * 100) / 100,
			seriNo: metin(al(s, 'seriNo')),
			not: metin(al(s, 'not')),
		});
	}

	return cikti;
}

export type DiaTaksit = {
	kod: string;
	ad: string;
	no: number;
	vade: string;
	tutar: number;
	odenen: number;
	kalan: number;
	anapara: number;
	faiz: number;
	bsmv: number;
};

export function taksitleriCoz(
	satirlar: unknown[][],
	baslikSatiri: number,
	esleme: Esleme
): DiaTaksit[] {
	const al = (s: unknown[], k: AlanKodu): unknown =>
		esleme[k] === undefined ? undefined : s[esleme[k]!];

	const cikti: DiaTaksit[] = [];

	for (let i = baslikSatiri + 1; i < satirlar.length; i++) {
		const s = satirlar[i] ?? [];

		const vade = gunuCoz(al(s, 'vade'));
		const tutar = sayi(al(s, 'tutar'));
		if (!vade || tutar <= 0) continue;

		const kod = metin(al(s, 'krediKod'));
		const ad = metin(al(s, 'krediAd'));
		if (!kod && !ad) continue;

		cikti.push({
			kod: kod || ad,
			ad,
			no: Math.round(sayi(al(s, 'taksitNo'))),
			vade,
			tutar: Math.round(tutar * 100) / 100,
			odenen: Math.round(sayi(al(s, 'odenen')) * 100) / 100,
			kalan: Math.round(sayi(al(s, 'kalan')) * 100) / 100,
			anapara: Math.round(sayi(al(s, 'anapara')) * 100) / 100,
			faiz: Math.round(sayi(al(s, 'faiz')) * 100) / 100,
			bsmv: Math.round(sayi(al(s, 'bsmv')) * 100) / 100,
		});
	}

	return cikti;
}
