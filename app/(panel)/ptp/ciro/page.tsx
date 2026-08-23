import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import {
	ayAdi,
	ayGecerli,
	ayKaydir,
	aydakiGun,
	ayinGunleri,
	buAy,
	bugun,
} from '@/lib/ortak/tarih';
import { degisim, degisimBicimle, paraBicimle } from '@/lib/ortak/para';
import type { Ciro } from '@/lib/tipler';
import { CiroTablosu } from './bilesenler/CiroTablosu';

export const metadata: Metadata = { title: 'Ciro — Karas Panel' };
export const dynamic = 'force-dynamic';

export default async function CiroSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ ay?: string }>;
}) {
	/* Ciro para; personel kendi girdiği günü görür ama aylık tablo
	   yöneticinindir. */
	await yetkiDenetle('ptp', 'yonetim');

	const { ay: istenenAy } = await searchParams;
	const ay = ayGecerli(istenenAy) ? istenenAy : buAy();
	const oncekiAy = ayKaydir(ay, -1);

	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const [buAySonuc, gecenAySonuc] = await Promise.all([
		supabase
			.from('ptp_cirolar')
			.select('*, giren:giren_id(ad)')
			.eq('firma_id', firmaId)
			.gte('tarih', `${ay}-01`)
			.lte('tarih', `${ay}-${String(aydakiGun(ay)).padStart(2, '0')}`)
			.is('silindi', null)
			.order('tarih'),

		supabase
			.from('ptp_cirolar')
			.select('tarih, tutar')
			.eq('firma_id', firmaId)
			.gte('tarih', `${oncekiAy}-01`)
			.lte('tarih', `${oncekiAy}-${String(aydakiGun(oncekiAy)).padStart(2, '0')}`)
			.is('silindi', null),
	]);

	const cirolar = (buAySonuc.data ?? []) as unknown as Ciro[];
	const gecenAy = (gecenAySonuc.data ?? []) as { tarih: string; tutar: number }[];

	/* Ay geçmişse tamamı, bu aysa bugüne kadarı, gelecekse hiçbiri. */
	const gecenGun =
		ay > buAy() ? 0 : ay === buAy() ? Number(bugun().slice(8, 10)) : aydakiGun(ay);

	const toplam = cirolar.reduce((t, c) => t + Number(c.tutar), 0);
	/* Net toplam veri tabanında satır satır üretiliyor; burada yalnızca
	   toplanıyor. Prim hesabı bu rakamın üzerinden yapılıyor. */
	const netToplam = cirolar.reduce((t, c) => t + Number(c.net_tutar ?? 0), 0);
	const girilenGun = cirolar.length;
	const ortalama = girilenGun > 0 ? toplam / girilenGun : 0;
	const enYuksek = cirolar.reduce<Ciro | null>(
		(e, c) => (e === null || Number(c.tutar) > Number(e.tutar) ? c : e),
		null
	);

	const fisToplam = cirolar.reduce((t, c) => t + (c.fis_sayisi ?? 0), 0);
	const sepet = fisToplam > 0 ? toplam / fisToplam : null;

	/* Karşılaştırma aynı gün sayısı üzerinden: ayın 10'undayken bu ayın
	   10 gününü geçen ayın 30 günüyle kıyaslamak yanlış bir düşüş
	   gösterirdi. */
	const gecenAyAyniDonem = gecenAy
		.filter((c) => Number(c.tarih.slice(8, 10)) <= gecenGun)
		.reduce((t, c) => t + Number(c.tutar), 0);

	const fark = gecenAyAyniDonem > 0 ? degisim(toplam, gecenAyAyniDonem) : null;

	/* Ayın her günü tabloda yer alır: girilmeyen gün de görünsün,
	   "unutulan gün" ancak boş satır olarak fark edilir. */
	const gunler = ayinGunleri(ay).filter(
		(g) => g <= bugun()
	);
	const ciroHaritasi = new Map(cirolar.map((c) => [c.tarih, c]));

	const eksikGun = gunler.filter((g) => !ciroHaritasi.has(g)).length;

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Ciro</span>

			<div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-[-0.015em]">
					{ayAdi(ay)}
				</h1>
				<div className="flex gap-2">
					<Link
						href={`/ptp/ciro?ay=${oncekiAy}`}
						className="dugme dugme-bos !px-3 !py-1.5"
					>
						← {ayAdi(oncekiAy).split(' ')[0]}
					</Link>
					{ay < buAy() && (
						<Link
							href={`/ptp/ciro?ay=${ayKaydir(ay, 1)}`}
							className="dugme dugme-bos !px-3 !py-1.5"
						>
							{ayAdi(ayKaydir(ay, 1)).split(' ')[0]} →
						</Link>
					)}
				</div>
			</div>

			{/* ---- Özet ---- */}
			<div className="mt-8 grid grid-cols-2 gap-px border border-kenarlik bg-kenarlik sm:grid-cols-4">
				<Ozet
					etiket="Ay toplamı"
					deger={paraBicimle(toplam)}
					alt={
						fark === null
							? `${girilenGun} gün girildi`
							: `geçen ayın aynı dönemine göre ${degisimBicimle(fark)}`
					}
					vurgu
				/>
				<Ozet
					etiket="Günlük ortalama"
					deger={girilenGun > 0 ? paraBicimle(ortalama) : '—'}
					alt={`${girilenGun} / ${gecenGun} gün`}
				/>
				<Ozet
					etiket="En yüksek gün"
					deger={enYuksek ? paraBicimle(Number(enYuksek.tutar)) : '—'}
					alt={enYuksek ? enYuksek.tarih.slice(8) + ' ' + ayAdi(ay).split(' ')[0] : '—'}
				/>
				<Ozet
					etiket="Sepet ortalaması"
					deger={sepet === null ? '—' : paraBicimle(sepet)}
					alt={fisToplam > 0 ? `${fisToplam} fiş` : 'fiş sayısı girilmedi'}
				/>
			</div>

			<p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-metin-2">
				<span>
					KDV hariç <strong className="tabular-nums">{paraBicimle(netToplam)}</strong>
				</span>
				<Link
					href={`/ptp/prim?ay=${ay}`}
					className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
				>
					Prim hesabı
				</Link>
			</p>

			{eksikGun > 0 && (
				<p className="mt-4 border border-uyari px-4 py-3 text-sm text-metin-2">
					<span className="font-medium text-uyari">{eksikGun} gün</span> için
					ciro girilmemiş. Aşağıdaki boş satırlardan tamamlayabilirsiniz.
				</p>
			)}

			{buAySonuc.error ? (
				<p className="mt-8 border border-hata px-4 py-3 text-sm text-hata">
					Ciro kayıtları okunamadı. Sayfayı yenileyin.
				</p>
			) : gunler.length === 0 ? (
				<p className="mt-8 border border-kenarlik px-4 py-8 text-center text-sm text-metin-2">
					Bu ay henüz başlamadı.
				</p>
			) : (
				<div className="mt-8">
					<CiroTablosu
						gunler={[...gunler].reverse()}
						cirolar={Object.fromEntries(ciroHaritasi)}
					/>
				</div>
			)}

			<p className="mt-8 max-w-xl text-sm leading-relaxed text-metin-3">
				Ciroyu akşam personel kendi giriyor; buradan yalnızca düzeltme
				yapılır. Her düzeltme, eski rakamıyla birlikte denetim kaydına
				yazılır.
			</p>
		</div>
	);
}

function Ozet({
	etiket,
	deger,
	alt,
	vurgu = false,
}: {
	etiket: string;
	deger: string;
	alt: string;
	vurgu?: boolean;
}) {
	return (
		<div className="bg-zemin p-4">
			<span className="etiket">{etiket}</span>
			<p
				className={`mt-2 font-semibold tracking-[-0.015em] ${
					vurgu ? 'text-xl' : 'text-lg'
				}`}
			>
				{deger}
			</p>
			<p className="mt-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
				{alt}
			</p>
		</div>
	);
}
