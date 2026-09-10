import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici, YetkisizHata } from '@/lib/yetki';
import { kisaTarih, saatiBicimle } from '@/lib/ortak/tarih';

export const metadata: Metadata = { title: 'Denetim kayıtları — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Denetim kayıtları ve sistem hataları.

   İKİSİ AYNI TABLODA: "ne oldu" sorusunun cevabı tek yerde dursun
   diye ayrı tablo açılmadı. Hata kayıtları eylem = 'sistem_hatasi'
   ile ayrılıyor ve burada ayrı sekmede gösteriliyor — biri "kim ne
   yaptı", diğeri "ne bozuldu"; aynı listede karışırlarsa ikisi de
   okunmaz olur.

   Satırları RLS süzüyor: süperadmin hepsini, firma yöneticisi kendi
   firmasının işlem kayıtlarını görüyor, sistem hataları yalnızca
   süperadminde. Bu yüzden sorguya elle firma süzgeci konmuyor. */

const SAYFA_BOYU = 100;

type Kayit = {
	id: string;
	eylem: string;
	hedef_tablo: string | null;
	hedef_id: string | null;
	ayrinti: Record<string, unknown> | null;
	olusturuldu: string;
	kullanici: { ad: string } | null;
	firma: { kisa_ad: string } | null;
};

const EYLEM_ADLARI: Record<string, string> = {
	kisi_eklendi: 'Kişi eklendi',
	kisi_guncellendi: 'Kişi güncellendi',
	kisi_silindi: 'Kişi silindi',
	sifre_degistirildi: 'Şifre değiştirildi',
	yetki_degistirildi: 'Yetki değiştirildi',
	ciro_yazildi: 'Ciro yazıldı',
	ciro_duzeltildi: 'Ciro düzeltildi',
	prim_kademesi_degisti: 'Prim kademesi değişti',
	maas_tanimlandi: 'Maaş tanımlandı',
	telegram_gorev_eklendi: 'Telegram’dan görev eklendi',
	sistem_hatasi: 'Sistem hatası',
};

export default async function DenetimSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ tur?: string }>;
}) {
	const kullanici = await aktifKullanici();
	if (kullanici.rol !== 'superadmin' && kullanici.rol !== 'firma_yoneticisi') {
		throw new YetkisizHata('Bu ekran yöneticilere açıktır.');
	}

	const { tur } = await searchParams;
	const hataGorunumu = tur === 'hata';
	const supabase = await sunucuIstemcisi();

	const sorgu = supabase
		.from('denetim_kayitlari')
		.select(
			'id, eylem, hedef_tablo, hedef_id, ayrinti, olusturuldu, kullanici:kullanici_id(ad), firma:firma_id(kisa_ad)'
		)
		.order('olusturuldu', { ascending: false })
		.limit(SAYFA_BOYU);

	const { data } = hataGorunumu
		? await sorgu.eq('eylem', 'sistem_hatasi')
		: await sorgu.neq('eylem', 'sistem_hatasi');

	const kayitlar = (data ?? []) as unknown as Kayit[];

	/* Hata sayacı ayrı sorgu: sekmede rakam görünsün ki bakılması
	   gerektiği listeye girmeden anlaşılsın. */
	const { count: hataSayisi } = await supabase
		.from('denetim_kayitlari')
		.select('id', { count: 'exact', head: true })
		.eq('eylem', 'sistem_hatasi')
		.gte(
			'olusturuldu',
			new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
		);

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/ayarlar" className="etiket text-metin-3 hover:text-metin">
				← Ayarlar
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Denetim</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				{hataGorunumu ? 'Sistem hataları' : 'Kim ne yaptı'}
			</h1>
			<p className="mt-3 max-w-2xl text-sm leading-relaxed text-metin-2">
				{hataGorunumu
					? 'Sunucuda patlayan işler. Aynı hata 30 dakika içinde tekrarlarsa Telegram’a bir kez düşer ama kaydı her seferinde tutulur.'
					: 'Hesap açma, yetki değiştirme, ciro düzeltme gibi geri alınması zor işlemler.'}
			</p>

			{/* Sekmeler */}
			<div className="mt-6 flex gap-2">
				<Sekme yol="/ayarlar/denetim" secili={!hataGorunumu}>
					İşlemler
				</Sekme>
				<Sekme yol="/ayarlar/denetim?tur=hata" secili={hataGorunumu}>
					Sistem hataları
					{(hataSayisi ?? 0) > 0 && (
						<span className="ml-1.5 text-uyari">{hataSayisi}</span>
					)}
				</Sekme>
			</div>

			{kayitlar.length === 0 ? (
				<div className="kose-nisan mt-8 border border-kenarlik p-8 text-center">
					<span className="etiket">Kayıt yok</span>
					<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-metin-2">
						{hataGorunumu
							? 'Kayıtlı sistem hatası yok. İyi haber.'
							: 'Henüz denetim kaydı yok. Bu tablo uzun süre RLS yüzünden sessizce boş kaldı; 22_ numaralı migration çalıştırıldıktan sonra yeni işlemler buraya düşmeye başlar.'}
					</p>
				</div>
			) : (
				<ul className="mt-8 space-y-px border border-kenarlik bg-kenarlik">
					{kayitlar.map((k) => (
						<li key={k.id} className="bg-zemin p-4">
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<span
									className={`text-sm font-medium ${k.eylem === 'sistem_hatasi' ? 'text-uyari' : ''}`}
								>
									{EYLEM_ADLARI[k.eylem] ?? k.eylem}
								</span>
								<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
									{kisaTarih(k.olusturuldu)} · {saatiBicimle(k.olusturuldu)}
									{k.kullanici && ` · ${k.kullanici.ad}`}
									{k.firma && ` · ${k.firma.kisa_ad}`}
									{!k.kullanici && ' · sistem'}
								</span>
							</div>

							{k.hedef_tablo && (
								<p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3">
									{k.hedef_tablo}
								</p>
							)}

							{k.ayrinti && <Ayrinti veri={k.ayrinti} hata={k.eylem === 'sistem_hatasi'} />}
						</li>
					))}
				</ul>
			)}

			{kayitlar.length === SAYFA_BOYU && (
				<p className="mt-4 text-sm text-metin-3">
					Son {SAYFA_BOYU} kayıt gösteriliyor.
				</p>
			)}
		</div>
	);
}

function Ayrinti({
	veri,
	hata,
}: {
	veri: Record<string, unknown>;
	hata: boolean;
}) {
	/* Hata kaydında yığın izi uzun; ayrı ve soluk gösteriliyor ki
	   satırı boğmasın ama gerektiğinde okunabilsin. */
	const { yigin, ...digerleri } = veri as { yigin?: string };

	return (
		<div className="mt-2">
			<dl className="flex flex-wrap gap-x-4 gap-y-1">
				{Object.entries(digerleri).map(([anahtar, deger]) => (
					<div key={anahtar} className="flex gap-1.5">
						<dt className="font-mono text-[0.625rem] uppercase tracking-[0.06em] text-metin-3">
							{anahtar}
						</dt>
						<dd
							className={`text-sm ${hata ? 'text-metin-2' : 'text-metin-2'}`}
						>
							{typeof deger === 'object'
								? JSON.stringify(deger)
								: String(deger)}
						</dd>
					</div>
				))}
			</dl>

			{yigin && (
				<pre className="mt-2 max-h-40 overflow-auto border border-kenarlik-2 bg-zemin-2 p-3 font-mono text-[0.625rem] leading-relaxed text-metin-3">
					{yigin}
				</pre>
			)}
		</div>
	);
}

function Sekme({
	yol,
	secili,
	children,
}: {
	yol: string;
	secili: boolean;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={yol}
			className={`border px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] transition-colors ${
				secili
					? 'border-vurgu-metin bg-vurgu-metin text-zemin'
					: 'border-kenarlik text-metin-2 hover:border-metin'
			}`}
		>
			{children}
		</Link>
	);
}
