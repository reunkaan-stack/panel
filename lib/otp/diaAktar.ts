import 'server-only';
import readXlsxFile from 'read-excel-file/node';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import {
	baslikBul,
	cekleriCoz,
	durumKorunmali,
	gunFark,
	otomatikEsle,
	parmakIzi,
	seriAnahtar,
	taksitleriCoz,
	CEK_ALANLARI,
	KREDI_ALANLARI,
	type AlanKodu,
	type AlanTanimi,
	type DiaCek,
	type DiaTaksit,
	type Esleme,
	type RaporTuru,
} from './dia';

/* DIA raporunu okuyup panele aktarır.

   İKİ AŞAMA: önce ÖNİZLEME (hiçbir şey yazılmaz, ne olacağı
   gösterilir), sonra onayla UYGULAMA. Yerel programın davranışı
   buydu ve para verisinde doğrusu bu.

   HİÇBİR KAYIT SİLİNMEZ. DIA'da olmayan bir kayıt panelde duruyorsa
   elle girilmiş olabilir; içe aktarma onu yok saymaz. */

export type Cozumleme = {
	tur: RaporTuru;
	baslikSatiri: number;
	basliklar: string[];
	esleme: Esleme;
	eksik: AlanTanimi[];
	parmak: string;
	satirlar: unknown[][];
	/** İlk birkaç veri satırı — kullanıcı kolon seçerken örnek görsün */
	ornekler: string[][];
};

/** Dosyayı okur, türünü ve kolon eşlemesini çözer. */
export async function dosyayiCoz(
	govde: Buffer,
	firmaId: string,
	elleEsleme?: Esleme
): Promise<Cozumleme | { hata: string }> {
	let satirlar: unknown[][];

	try {
		/* Bu sürüm sayfaları sarmalayarak döndürüyor: [{sheet, data}].
		   İki şekli de karşılıyoruz ki sürüm değişince sessizce
		   bozulmasın. */
		const ham = (await readXlsxFile(govde)) as unknown[];
		const ilk = ham[0] as { data?: unknown[][] } | unknown[];
		satirlar = Array.isArray(ilk) ? (ham as unknown[][]) : (ilk.data ?? []);
	} catch {
		return {
			hata: 'Dosya okunamadı. DIA’dan alınmış bir .xlsx raporu seçtiğinizden emin olun.',
		};
	}

	const b = baslikBul(satirlar);
	if (!b.tur) {
		return {
			hata: 'Rapor tanınamadı. DIA çek-senet listesi ya da kredi taksit listesi bekleniyor; başlık satırında “Seri No” ya da “Taksit No” bulunamadı.',
		};
	}

	const alanlar = b.tur === 'cek' ? CEK_ALANLARI : KREDI_ALANLARI;
	const parmak = parmakIzi(b.basliklar);

	/* Sıra: elle verilen eşleme → öğrenilmiş eşleme → otomatik. */
	let esleme: Esleme;
	let eksik: AlanTanimi[] = [];

	if (elleEsleme && Object.keys(elleEsleme).length > 0) {
		esleme = elleEsleme;
		eksik = alanlar.filter((a) => a.zorunlu && esleme[a.kod] === undefined);
	} else {
		const ogrenilen = await ogrenilmisEsleme(firmaId, parmak);
		if (ogrenilen) {
			esleme = ogrenilen;
			eksik = alanlar.filter((a) => a.zorunlu && esleme[a.kod] === undefined);
		} else {
			const sonuc = otomatikEsle(b.basliklar, alanlar);
			esleme = sonuc.esleme;
			eksik = sonuc.eksik;
		}
	}

	/* Kullanıcı kolon seçerken başlık yetmiyor; örnek değer görmeli. */
	const ornekler: string[][] = [];
	for (let i = b.baslikSatiri + 1; i < satirlar.length && ornekler.length < 3; i++) {
		const s = satirlar[i] ?? [];
		if (s.every((h) => h === null || h === undefined || h === '')) continue;
		ornekler.push(
			b.basliklar.map((_, j) => {
				const h = s[j];
				if (h === null || h === undefined) return '';
				return h instanceof Date
					? h.toISOString().slice(0, 10)
					: String(h).slice(0, 30);
			})
		);
	}

	return {
		tur: b.tur,
		baslikSatiri: b.baslikSatiri,
		basliklar: b.basliklar,
		esleme,
		eksik,
		parmak,
		satirlar,
		ornekler,
	};
}

async function ogrenilmisEsleme(
	firmaId: string,
	parmak: string
): Promise<Esleme | null> {
	try {
		const supabase = await sunucuIstemcisi();
		const { data } = await supabase
			.from('otp_dia_eslemeleri')
			.select('esleme')
			.eq('firma_id', firmaId)
			.eq('parmak_izi', parmak)
			.maybeSingle();
		return (data?.esleme as Esleme) ?? null;
	} catch {
		return null;
	}
}

/** Kullanıcının onayladığı eşlemeyi saklar; aynı biçim bir daha sorulmaz. */
export async function eslemeyiOgren(
	firmaId: string,
	parmak: string,
	tur: RaporTuru,
	esleme: Esleme,
	kullaniciId: string
): Promise<void> {
	try {
		const supabase = await sunucuIstemcisi();
		await supabase.from('otp_dia_eslemeleri').upsert(
			{
				firma_id: firmaId,
				parmak_izi: parmak,
				tur,
				esleme,
				olusturan_id: kullaniciId,
			},
			{ onConflict: 'firma_id,parmak_izi' }
		);
	} catch (e) {
		console.error('[dia] eşleme saklanamadı', e);
	}
}

/* ---------- Çek / senet aktarımı ---------- */

export type CekSonucu = {
	tur: 'cek';
	toplam: number;
	yeni: string[];
	guncellenen: string[];
	/** Panelde ÖDENDİ kalanlar — DIA'da düzeltilmesi gerekenler */
	korunan: string[];
	degismeyen: number;
};

type MevcutCek = {
	id: string;
	yon: string;
	tur: string;
	durum: string;
	tarih: string;
	firma: string;
	borclu: string;
	banka: string;
	hedef: string;
	tutar: number;
	seri_no: string;
	not_metni: string;
};

function etiket(c: DiaCek): string {
	const [y, a, g] = c.tarih.split('-');
	const tutar = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(
		c.tutar
	);
	return `${g}.${a}.${y} · ${c.firma.slice(0, 34)} · ${tutar} ₺`;
}

/**
 * DIA kayıtlarını mevcut verilerle eşleştirir.
 *
 * Eşleştirme sırası: önce seri no, bulunamazsa tutar + yakın vade
 * (5 gün tolerans). İkincisi seri numarası girilmemiş eski kayıtları
 * yakalamak için; yoksa aynı çek ikinci kez eklenirdi.
 */
export async function cekleriAktar(
	firmaId: string,
	cekler: DiaCek[],
	uygula: boolean,
	yeniKimlik: () => string
): Promise<CekSonucu> {
	const supabase = await sunucuIstemcisi();

	const { data } = await supabase
		.from('otp_odemeler')
		.select('id, yon, tur, durum, tarih, firma, borclu, banka, hedef, tutar, seri_no, not_metni')
		.eq('firma_id', firmaId)
		.is('silindi', null);

	const mevcutlar = ((data ?? []) as MevcutCek[]).map((m) => ({
		...m,
		tutar: Number(m.tutar),
	}));

	const seriyle = new Map<string, MevcutCek>();
	for (const m of mevcutlar) {
		const k = seriAnahtar(m.seri_no);
		if (k) seriyle.set(k, m);
	}

	const eslesen = new Set<string>();
	const sonuc: CekSonucu = {
		tur: 'cek',
		toplam: cekler.length,
		yeni: [],
		guncellenen: [],
		korunan: [],
		degismeyen: 0,
	};

	const eklenecek: Record<string, unknown>[] = [];
	const guncellenecek: { id: string; alanlar: Record<string, unknown> }[] = [];

	for (const c of cekler) {
		const anahtar = seriAnahtar(c.seriNo);
		let m = anahtar ? seriyle.get(anahtar) : undefined;

		if (!m) {
			/* Seri numarasız eski kayıtlar: tutar aynı ve vade beş gün
			   içindeyse aynı çek sayılıyor. */
			const adaylar = mevcutlar.filter(
				(q) =>
					!eslesen.has(q.id) &&
					!seriAnahtar(q.seri_no) &&
					q.yon === c.yon &&
					q.tur === c.tur &&
					Math.abs(q.tutar - c.tutar) < 0.01 &&
					gunFark(q.tarih, c.tarih) <= 5
			);
			if (adaylar.length > 0) {
				m = adaylar.reduce((en, q) =>
					gunFark(q.tarih, c.tarih) < gunFark(en.tarih, c.tarih) ? q : en
				);
			}
		}

		if (!m) {
			const satir = {
				id: yeniKimlik(),
				firma_id: firmaId,
				yon: c.yon,
				tur: c.tur,
				durum: c.durum,
				tarih: c.tarih,
				firma: c.firma,
				borclu: c.borclu,
				banka: c.banka,
				hedef: c.hedef,
				tutar: c.tutar,
				seri_no: c.seriNo,
				not_metni: c.not,
				odendi: c.durum === (c.yon === 'ALINAN' ? 'TAHSIL' : 'ODENDI'),
				odenen:
					c.durum === (c.yon === 'ALINAN' ? 'TAHSIL' : 'ODENDI') ? c.tutar : 0,
			};
			eklenecek.push(satir);
			sonuc.yeni.push(`${etiket(c)} (${c.durum})`);
			continue;
		}

		eslesen.add(m.id);

		const degisen: Record<string, unknown> = {};
		let korundu = false;

		const eslesmeler: [keyof MevcutCek, string][] = [
			['durum', c.durum],
			['tarih', c.tarih],
			['banka', c.banka],
			['hedef', c.hedef],
			['borclu', c.borclu],
			['seri_no', c.seriNo],
		];

		for (const [kolon, yeniDeger] of eslesmeler) {
			if (!yeniDeger || m[kolon] === yeniDeger) continue;

			if (kolon === 'durum' && durumKorunmali(m.yon, m.durum, yeniDeger)) {
				korundu = true;
				continue;
			}
			degisen[kolon] = yeniDeger;
		}

		if (c.not && !m.not_metni) degisen.not_metni = c.not;

		if (Object.keys(degisen).length > 0) {
			const yeniDurum = (degisen.durum as string) ?? m.durum;
			const bitti = yeniDurum === (m.yon === 'ALINAN' ? 'TAHSIL' : 'ODENDI');
			degisen.odendi = bitti;
			degisen.odenen = bitti ? m.tutar : 0;

			guncellenecek.push({ id: m.id, alanlar: degisen });
			sonuc.guncellenen.push(`${etiket(c)} → ${yeniDurum}`);
		} else if (!korundu) {
			sonuc.degismeyen++;
		}

		if (korundu && sonuc.korunan.length < 200) {
			sonuc.korunan.push(
				`${etiket(c)} — panelde ${m.durum} kalıyor, DIA: ${c.durum}`
			);
		}
	}

	if (uygula) {
		if (eklenecek.length > 0) {
			const { error } = await supabase.from('otp_odemeler').insert(eklenecek);
			if (error) throw error;
		}
		for (const g of guncellenecek) {
			const { error } = await supabase
				.from('otp_odemeler')
				.update(g.alanlar)
				.eq('id', g.id)
				.eq('firma_id', firmaId);
			if (error) throw error;
		}
	}

	return sonuc;
}

/* ---------- Kredi aktarımı ---------- */

export type KrediSonucu = {
	tur: 'kredi';
	toplam: number;
	krediYeni: number;
	taksitYeni: number;
	guncellenen: number;
	korunan: string[];
	degismeyen: number;
};

/**
 * Kredi taksitlerini kod + taksit no ile eşleştirir.
 *
 * "Durum geriye düşmez" burada da geçerli: ödenmiş (kalan ≈ 0) bir
 * taksit, DIA'nın geç işlenmiş kaydıyla ödenmemişe çevrilmiyor.
 * Vade, tutar, anapara, faiz gibi alanlar yine güncelleniyor.
 */
export async function kredileriAktar(
	firmaId: string,
	taksitler: DiaTaksit[],
	uygula: boolean
): Promise<KrediSonucu> {
	const supabase = await sunucuIstemcisi();

	const [krediSonuc, taksitSonuc] = await Promise.all([
		supabase
			.from('otp_krediler')
			.select('id, kod, ad, banka')
			.eq('firma_id', firmaId)
			.is('silindi', null),
		supabase
			.from('otp_taksitler')
			.select('id, kredi_id, no, vade, tutar, odenen, kalan, anapara, faiz, bsmv')
			.eq('firma_id', firmaId),
	]);

	type Kredi = { id: string; kod: string; ad: string; banka: string };
	type Taksit = {
		id: string;
		kredi_id: string;
		no: number;
		vade: string;
		tutar: number;
		odenen: number;
		kalan: number;
		anapara: number;
		faiz: number;
		bsmv: number;
	};

	const krediler = (krediSonuc.data ?? []) as Kredi[];
	const mevcutTaksitler = (taksitSonuc.data ?? []) as Taksit[];

	const krediKoduyla = new Map(krediler.map((k) => [k.kod, k]));
	const taksitAnahtari = (krediId: string, no: number) => `${krediId}#${no}`;
	const taksitle = new Map(
		mevcutTaksitler.map((t) => [taksitAnahtari(t.kredi_id, Number(t.no)), t])
	);

	const sonuc: KrediSonucu = {
		tur: 'kredi',
		toplam: taksitler.length,
		krediYeni: 0,
		taksitYeni: 0,
		guncellenen: 0,
		korunan: [],
		degismeyen: 0,
	};

	/* Önce eksik krediler açılıyor: taksitin bağlanacağı bir kredi
	   olmadan satır yazılamaz. */
	const yeniKrediler = new Map<string, { kod: string; ad: string }>();
	for (const t of taksitler) {
		if (!krediKoduyla.has(t.kod) && !yeniKrediler.has(t.kod)) {
			yeniKrediler.set(t.kod, { kod: t.kod, ad: t.ad });
		}
	}
	sonuc.krediYeni = yeniKrediler.size;

	if (uygula && yeniKrediler.size > 0) {
		const { data, error } = await supabase
			.from('otp_krediler')
			.insert(
				[...yeniKrediler.values()].map((k) => ({
					firma_id: firmaId,
					kod: k.kod,
					ad: k.ad,
					banka: '',
				}))
			)
			.select('id, kod, ad, banka');
		if (error) throw error;
		for (const k of (data ?? []) as Kredi[]) krediKoduyla.set(k.kod, k);
	}

	const eklenecek: Record<string, unknown>[] = [];
	const guncellenecek: { id: string; alanlar: Record<string, unknown> }[] = [];

	for (const t of taksitler) {
		const kredi = krediKoduyla.get(t.kod);
		if (!kredi) {
			/* Önizlemede kredi henüz açılmadı; taksit yeni sayılıyor. */
			sonuc.taksitYeni++;
			continue;
		}

		const mevcut = taksitle.get(taksitAnahtari(kredi.id, t.no));

		if (!mevcut) {
			eklenecek.push({
				firma_id: firmaId,
				kredi_id: kredi.id,
				no: t.no,
				vade: t.vade,
				tutar: t.tutar,
				odenen: t.odenen,
				kalan: t.kalan,
				anapara: t.anapara,
				faiz: t.faiz,
				bsmv: t.bsmv,
			});
			sonuc.taksitYeni++;
			continue;
		}

		const degisen: Record<string, unknown> = {};
		for (const alan of ['vade', 'tutar', 'anapara', 'faiz', 'bsmv'] as const) {
			const yeni = t[alan];
			const eski = alan === 'vade' ? mevcut.vade : Number(mevcut[alan]);
			if (alan === 'vade' ? eski !== yeni : Math.abs((eski as number) - (yeni as number)) > 0.005) {
				degisen[alan] = yeni;
			}
		}

		/* Ödenmiş taksit geri alınmıyor. */
		const odenmis = Number(mevcut.kalan) <= 0.01;
		const diaOdenmemis = t.kalan > 0.01;

		if (odenmis && diaOdenmemis) {
			if (sonuc.korunan.length < 200) {
				sonuc.korunan.push(
					`${kredi.kod} · Taksit ${t.no} · ${t.vade} — panelde ödenmiş kalıyor`
				);
			}
		} else if (
			Math.abs(Number(mevcut.odenen) - t.odenen) > 0.005 ||
			Math.abs(Number(mevcut.kalan) - t.kalan) > 0.005
		) {
			degisen.odenen = t.odenen;
			degisen.kalan = t.kalan;
		}

		if (Object.keys(degisen).length > 0) {
			guncellenecek.push({ id: mevcut.id, alanlar: degisen });
			sonuc.guncellenen++;
		} else {
			sonuc.degismeyen++;
		}
	}

	if (uygula) {
		if (eklenecek.length > 0) {
			const { error } = await supabase.from('otp_taksitler').insert(eklenecek);
			if (error) throw error;
		}
		for (const g of guncellenecek) {
			const { error } = await supabase
				.from('otp_taksitler')
				.update(g.alanlar)
				.eq('id', g.id)
				.eq('firma_id', firmaId);
			if (error) throw error;
		}
	}

	return sonuc;
}

export type { AlanKodu, AlanTanimi, Esleme, RaporTuru };
