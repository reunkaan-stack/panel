import type { PrimKademesi } from './tipler';

/* Prim hesabı.

   Saf fonksiyon: veri tabanına da ekrana da bağlı değil. Hesabın tek
   bir yerde durması, "rapordaki rakam ekrandakini tutmuyor" sorununun
   baştan çıkmaması demek.

   Kademe basamaklıdır, aradeğer hesaplanmaz: %89 gerçekleşmede %80
   kademesinin primi ödenir. Basamak eşiği bilinçli — ayın son günü
   satışı zorlamak için var. */

/** Kademenin bu maaşa göre TL karşılığı. */
export function kademeTutari(kademe: PrimKademesi, maas: number): number {
	return kademe.tur === 'sabit'
		? (kademe.tutar ?? 0)
		: (kademe.kat ?? 0) * maas;
}

export type PrimHesabi = {
	/** Hedefin yüzde kaçı gerçekleşti */
	gerceklesme: number;
	/** Ulaşılan kademe; hiçbirine ulaşılmadıysa null */
	ulasilan: PrimKademesi | null;
	primTutari: number;
	/** Bir üst kademe; en üstteyse null */
	sonraki: PrimKademesi | null;
	sonrakiPrim: number;
	/** Bir üst kademeye kalan net ciro */
	kalan: number;
};

export function primHesapla(
	netCiro: number,
	hedef: number,
	kademeler: PrimKademesi[],
	maas: number
): PrimHesabi {
	const sirali = [...kademeler].sort((a, b) => a.oran - b.oran);
	const gerceklesme = hedef > 0 ? (netCiro / hedef) * 100 : 0;

	/* Ulaşılan = oranı geçilmiş kademelerin EN YÜKSEĞİ. Basit bir
	   "ilk eşleşen" araması, kademeler sırasız gelirse yanlış sonuç
	   verirdi. */
	let ulasilan: PrimKademesi | null = null;
	for (const k of sirali) {
		if (gerceklesme + 1e-9 >= k.oran) ulasilan = k;
		else break;
	}

	const sonraki = sirali.find((k) => k.oran > gerceklesme + 1e-9) ?? null;

	return {
		gerceklesme,
		ulasilan,
		primTutari: ulasilan ? kademeTutari(ulasilan, maas) : 0,
		sonraki,
		sonrakiPrim: sonraki ? kademeTutari(sonraki, maas) : 0,
		kalan: sonraki ? Math.max(0, (hedef * sonraki.oran) / 100 - netCiro) : 0,
	};
}

/**
 * Bir aya ait geçerli maaş: `gecerli_ay` değeri o aydan büyük olmayan
 * kayıtların en yenisi.
 *
 * Zam yeni satır olarak yazıldığı için geçmiş ayların primi eski
 * maaşla hesaplanmaya devam eder.
 */
export function ayinMaasi(
	maaslar: { gecerli_ay: string; tutar: number }[],
	ay: string
): number {
	const ayinIlki = `${ay}-01`;
	const gecerli = maaslar
		.filter((m) => m.gecerli_ay <= ayinIlki)
		.sort((a, b) => b.gecerli_ay.localeCompare(a.gecerli_ay))[0];
	return gecerli ? Number(gecerli.tutar) : 0;
}
