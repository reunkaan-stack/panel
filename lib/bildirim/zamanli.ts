import 'server-only';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { paraBicimle } from '@/lib/ortak/para';
import { kisaTarih } from '@/lib/ortak/tarih';
import { kacir } from '@/lib/telegram';
import { gunlukOzet } from '@/lib/ptp/ozet';

/* Zamanlı olayların işleyicileri.

   Her işleyici mesajı üretir ya da null döner. null = gönderilecek
   bir şey yok; o zaman mesaj atılmıyor ama damga yine basılıyor, gün
   içinde tekrar tekrar hesaplanmasın diye.

   ⚠️ YENİ ZAMANLI OLAY EKLERKEN: katalogda tanımla, işleyicisini
   buraya yaz. Zamanlayıcı yeni olayı kendiliğinden toplar; başka
   hiçbir yere dokunmak gerekmiyor. */

export type Isleyici = (firmaId: string, gun: string) => Promise<string | null>;

/* ---------- PTP ---------- */

const ptpGunlukOzet: Isleyici = async (firmaId, gun) => {
	return gunlukOzet(firmaId, gun);
};

const ptpKapanisHatirlatma: Isleyici = async (firmaId, gun) => {
	const supabase = yonetimIstemcisi();

	const [gorevSonuc, kayitSonuc] = await Promise.all([
		supabase.rpc('ptp_gunun_gorevleri', { p_firma_id: firmaId, p_tarih: gun }),
		supabase
			.from('ptp_kayitlar')
			.select('gorev_id')
			.eq('firma_id', firmaId)
			.eq('tarih', gun),
	]);

	const kapali = new Set(
		((kayitSonuc.data ?? []) as { gorev_id: string }[]).map((k) => k.gorev_id)
	);
	const acik = ((gorevSonuc.data ?? []) as { id: string }[]).filter(
		(g) => !kapali.has(g.id)
	).length;

	/* Her şey bitmişse mesaj yok: gereksiz bildirim, bildirimlerin
	   tümünü değersizleştirir. */
	if (acik === 0) return null;

	return `🔔 Kapanışa az kaldı — <b>${acik} görev</b> henüz kapatılmadı.`;
};

/* ---------- ÖTP ---------- */

const otpVadeOzeti: Isleyici = async (firmaId, gun) => {
	const supabase = yonetimIstemcisi();

	const hafta = new Date(gun + 'T12:00:00');
	hafta.setDate(hafta.getDate() + 7);
	const haftaSonu = hafta.toLocaleDateString('en-CA');

	const [odemeSonuc, taksitSonuc] = await Promise.all([
		supabase
			.from('otp_odemeler')
			.select('tarih, yon, tur, firma, tutar, durum')
			.eq('firma_id', firmaId)
			.gte('tarih', gun)
			.lte('tarih', haftaSonu)
			.eq('odendi', false)
			.is('silindi', null)
			.order('tarih'),

		supabase
			.from('otp_taksitler')
			.select('vade, tutar, kalan, kredi_id')
			.eq('firma_id', firmaId)
			.gte('vade', gun)
			.lte('vade', haftaSonu)
			.gt('kalan', 0)
			.order('vade'),
	]);

	type Odeme = {
		tarih: string;
		yon: string;
		tur: string;
		firma: string;
		tutar: number;
	};
	type Taksit = { vade: string; tutar: number; kalan: number };

	const odemeler = (odemeSonuc.data ?? []) as Odeme[];
	const taksitler = (taksitSonuc.data ?? []) as Taksit[];

	if (odemeler.length === 0 && taksitler.length === 0) return null;

	const bugunOdeme = odemeler.filter((o) => o.tarih === gun);
	const bugunTaksit = taksitler.filter((t) => t.vade === gun);

	/* Verilen çek borç, alınan çek alacak. Toplamları ayırmadan
	   yazsaydık "bugün 200 bin" der ama yarısı bize gelen para olurdu. */
	const borc = (o: Odeme) => o.yon === 'VERILEN';

	let m = `💳 <b>VADE ÖZETİ</b> — ${kisaTarih(gun + 'T12:00:00')}\n`;

	if (bugunOdeme.length || bugunTaksit.length) {
		const odenecek =
			bugunOdeme.filter(borc).reduce((t, o) => t + Number(o.tutar), 0) +
			bugunTaksit.reduce((t, x) => t + Number(x.kalan), 0);
		const tahsil = bugunOdeme
			.filter((o) => !borc(o))
			.reduce((t, o) => t + Number(o.tutar), 0);

		m += `\n<b>BUGÜN</b>\n`;
		if (odenecek > 0) m += `Ödenecek: <b>${paraBicimle(odenecek)}</b>\n`;
		if (tahsil > 0) m += `Tahsil: ${paraBicimle(tahsil)}\n`;

		for (const o of bugunOdeme) {
			m += `• ${borc(o) ? '↑' : '↓'} ${kacir(o.tur)} ${paraBicimle(Number(o.tutar))}`;
			m += o.firma ? ` — ${kacir(o.firma.slice(0, 40))}\n` : '\n';
		}
		for (const t of bugunTaksit) {
			m += `• ↑ Kredi taksidi ${paraBicimle(Number(t.kalan))}\n`;
		}
	} else {
		m += `\nBugün vadesi gelen ödeme yok.\n`;
	}

	const sonraOdeme = odemeler.filter((o) => o.tarih > gun);
	const sonraTaksit = taksitler.filter((t) => t.vade > gun);

	if (sonraOdeme.length || sonraTaksit.length) {
		const toplam =
			sonraOdeme.filter(borc).reduce((t, o) => t + Number(o.tutar), 0) +
			sonraTaksit.reduce((t, x) => t + Number(x.kalan), 0);

		m += `\n<b>ÖNÜMÜZDEKİ 7 GÜN</b>\n`;
		m += `Ödenecek: <b>${paraBicimle(toplam)}</b>`;
		m += ` · ${sonraOdeme.length + sonraTaksit.length} kalem\n`;

		/* İlk beş kalem yazılıyor: mesajın okunur kalması için.
		   Tamamı panelde. */
		for (const o of sonraOdeme.slice(0, 5)) {
			m += `• ${kisaTarih(o.tarih + 'T12:00:00')} ${borc(o) ? '↑' : '↓'} `;
			m += `${paraBicimle(Number(o.tutar))}`;
			m += o.firma ? ` — ${kacir(o.firma.slice(0, 30))}\n` : '\n';
		}
	}

	return m.trimEnd();
};

/* ---------- Kayıt ---------- */

export const ZAMANLI_ISLEYICILER: Record<string, Isleyici> = {
	'ptp.kapanis_hatirlatma': ptpKapanisHatirlatma,
	'ptp.gunluk_ozet': ptpGunlukOzet,
	'otp.vade_ozeti': otpVadeOzeti,
};
