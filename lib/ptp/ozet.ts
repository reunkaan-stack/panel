import 'server-only';
import { yonetimIstemcisi } from '@/lib/supabase/yonetim';
import { paraBicimle } from '@/lib/ortak/para';
import { saatiBicimle, tarihiBicimle } from '@/lib/ortak/tarih';
import { kacir } from '@/lib/telegram';
import type { GunlukGorev, Kayit } from '@/lib/tipler';

/* Telegram özet metinleri.

   Yerel programdaki buildSummary ile aynı bilgiler, aynı sıra:
   tamamlanma oranı, zorunlular, ciro, yapılmayanlar, atlananlar.
   Alışkanlık bozulmasın diye biçim de yakın tutuldu.

   Yönetim istemcisi kullanılıyor: bu metin zamanlanmış işten ya da
   Telegram webhook'undan üretiliyor, ortada oturum yok. RLS'i
   atlıyoruz ama firma kimliği çağıranın verdiği değil — webhook'ta
   chat_id'den, zamanlanmışta tablodan geliyor. */

export async function gunlukOzet(
	firmaId: string,
	tarih: string
): Promise<string> {
	const supabase = yonetimIstemcisi();

	const [gorevSonuc, kayitSonuc, ciroSonuc] = await Promise.all([
		supabase.rpc('ptp_gunun_gorevleri', {
			p_firma_id: firmaId,
			p_tarih: tarih,
		}),
		supabase
			.from('ptp_kayitlar')
			.select('*, yapan:yapan_id(ad)')
			.eq('firma_id', firmaId)
			.eq('tarih', tarih),
		supabase
			.from('ptp_cirolar')
			.select('tutar, net_tutar')
			.eq('firma_id', firmaId)
			.eq('tarih', tarih)
			.is('silindi', null)
			.maybeSingle(),
	]);

	const gorevler = (gorevSonuc.data ?? []) as GunlukGorev[];
	const kayitlar = (kayitSonuc.data ?? []) as unknown as Kayit[];

	const kayitliIdler = new Set(
		kayitlar.filter((k) => k.durum === 'yapildi').map((k) => k.gorev_id)
	);
	const atlananIdler = new Set(
		kayitlar.filter((k) => k.durum === 'atlandi').map((k) => k.gorev_id)
	);

	const yapilan = gorevler.filter((g) => kayitliIdler.has(g.id));
	const atlanan = gorevler.filter(
		(g) => !kayitliIdler.has(g.id) && atlananIdler.has(g.id)
	);
	const bekleyen = gorevler.filter(
		(g) => !kayitliIdler.has(g.id) && !atlananIdler.has(g.id)
	);

	const zorunlu = gorevler.filter((g) => g.zorunlu);
	const zorunluYapilan = zorunlu.filter((g) => kayitliIdler.has(g.id));

	const oran =
		gorevler.length > 0
			? Math.round((yapilan.length / gorevler.length) * 100)
			: 0;

	let m = `📊 <b>GÜNLÜK ÖZET</b> — ${tarihiBicimle(tarih)}\n`;
	m += `Tamamlanma: <b>%${oran}</b> (${yapilan.length}/${gorevler.length})\n`;
	m += `Zorunlu: ${zorunluYapilan.length}/${zorunlu.length}`;
	m += ` · Atlanan: ${atlanan.length} · Bekleyen: ${bekleyen.length}\n`;

	const ciro = ciroSonuc.data as { tutar: number; net_tutar: number } | null;
	if (ciro) {
		m += `\n💰 <b>CİRO:</b> ${paraBicimle(Number(ciro.tutar))}`;
		m += ` (KDV hariç ${paraBicimle(Number(ciro.net_tutar))})\n`;
	} else {
		m += `\n💰 <b>CİRO:</b> girilmedi!\n`;
	}

	if (bekleyen.length) {
		m += `\n⚠️ <b>YAPILMAYANLAR:</b>\n`;
		for (const g of bekleyen) {
			m += `• ${kacir(g.baslik)}${g.zorunlu ? ' <b>(ZORUNLU)</b>' : ''}\n`;
		}
	}

	if (atlanan.length) {
		m += `\n⏭️ <b>ATLANANLAR:</b>\n`;
		for (const g of atlanan) {
			const kayit = kayitlar.find(
				(k) => k.gorev_id === g.id && k.durum === 'atlandi'
			);
			m += `• ${kacir(g.baslik)} — ${kacir(kayit?.not_metni || 'sebep yok')}\n`;
		}
	}

	/* Metin girişi olan görevler rapor niteliğinde: yönetici bunları
	   ekrana girmeden okuyabilmeli. */
	const raporlar = kayitlar.filter((k) => k.deger_metin);
	if (raporlar.length) {
		m += `\n📝 <b>NOTLAR:</b>\n`;
		for (const k of raporlar) {
			m += `• ${kacir(k.baslik_kopya)}: ${kacir(k.deger_metin!)}\n`;
		}
	}

	return m.trimEnd();
}

/** Anlık durum — /durum komutuna cevap. Özetin kısa hâli. */
export async function anlikDurum(
	firmaId: string,
	tarih: string
): Promise<string> {
	const supabase = yonetimIstemcisi();

	const [gorevSonuc, kayitSonuc] = await Promise.all([
		supabase.rpc('ptp_gunun_gorevleri', {
			p_firma_id: firmaId,
			p_tarih: tarih,
		}),
		supabase
			.from('ptp_kayitlar')
			.select('gorev_id, durum, zaman, baslik_kopya, yapan:yapan_id(ad)')
			.eq('firma_id', firmaId)
			.eq('tarih', tarih)
			.eq('durum', 'yapildi')
			.order('zaman', { ascending: false })
			.limit(5),
	]);

	const gorevler = (gorevSonuc.data ?? []) as GunlukGorev[];
	const son = (kayitSonuc.data ?? []) as unknown as {
		zaman: string;
		baslik_kopya: string;
		yapan: { ad: string } | null;
	}[];

	let m = `⏱️ <b>DURUM</b> — ${tarihiBicimle(tarih)}\n`;
	m += `Bugün ${gorevler.length} görev tanımlı.\n`;

	if (son.length === 0) {
		m += `\nHenüz hiçbir görev kapatılmamış.`;
		return m;
	}

	m += `\n<b>Son yapılanlar:</b>\n`;
	for (const k of son) {
		m += `• ${saatiBicimle(k.zaman)} — ${kacir(k.baslik_kopya)}`;
		m += k.yapan ? ` (${kacir(k.yapan.ad)})\n` : '\n';
	}
	return m.trimEnd();
}
