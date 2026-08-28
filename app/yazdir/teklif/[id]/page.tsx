import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle } from '@/lib/yetki';
import { paraBicimle } from '@/lib/ortak/para';
import { tarihiBicimle } from '@/lib/ortak/tarih';
import { toplamlar, type Teklif, type TeklifKalemi } from '@/lib/teklif';
import { YazdirDugmesi } from './YazdirDugmesi';

export const metadata: Metadata = { title: 'Teklif' };
export const dynamic = 'force-dynamic';

/* Yazdırma sayfası — panel kabuğunun DIŞINDA.

   Başlık, menü ve alt bilgi burada yok; sayfa doğrudan kâğıda ya da
   PDF'e gidiyor. Panelin token'ları da kullanılmıyor: çıktı her zaman
   beyaz zemin siyah metin olmalı, karanlık modda siyah bir PDF
   üretmemeli.

   Toplamlar lib/teklif.ts içindeki aynı fonksiyondan geliyor;
   düzenleme ekranıyla birebir aynı rakam çıkıyor. */

export default async function TeklifYazdir({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await superadminDenetle();
	const { id } = await params;
	const supabase = await sunucuIstemcisi();

	const [teklifSonuc, kalemSonuc] = await Promise.all([
		supabase
			.from('teklifler')
			.select('*')
			.eq('id', id)
			.is('silindi', null)
			.maybeSingle(),
		supabase
			.from('teklif_kalemleri')
			.select('*')
			.eq('teklif_id', id)
			.order('sira'),
	]);

	if (!teklifSonuc.data) notFound();

	const t = teklifSonuc.data as Teklif;
	const kalemler = (kalemSonuc.data ?? []) as TeklifKalemi[];
	const hesap = toplamlar(kalemler, Number(t.indirim), Number(t.kdv_orani));

	return (
		<>
			<style>{STIL}</style>

			<YazdirDugmesi />

			<main className="kagit">
				<header className="ust">
					<div>
						<p className="marka">KARAS TEKNOLOJİ</p>
						<p className="marka-alt">
							Karas Teknoloji ve Mağazacılık İth. İhr. Ltd. Şti.
						</p>
						<p className="marka-alt">
							karasteknoloji.com · info@karasteknoloji.com
						</p>
					</div>
					<div className="no-kutu">
						<p className="etiket">Teklif No</p>
						<p className="no">{t.no}</p>
						<p className="etiket" style={{ marginTop: '10px' }}>
							Tarih
						</p>
						<p className="tarih">{tarihiBicimle(t.tarih)}</p>
					</div>
				</header>

				<section className="alici">
					<p className="etiket">Sayın</p>
					<p className="alici-ad">
						{t.musteri_firma || t.musteri_ad || '—'}
					</p>
					{t.musteri_firma && t.musteri_ad && (
						<p className="alici-alt">{t.musteri_ad}</p>
					)}
					{(t.musteri_eposta || t.musteri_telefon) && (
						<p className="alici-alt">
							{[t.musteri_eposta, t.musteri_telefon].filter(Boolean).join(' · ')}
						</p>
					)}
				</section>

				<h1 className="baslik">{t.baslik}</h1>

				{t.giris && <p className="giris">{t.giris}</p>}

				<table className="kalemler">
					<thead>
						<tr>
							<th className="sira">#</th>
							<th>Kalem</th>
							<th className="sag">Miktar</th>
							<th className="sag">Birim fiyat</th>
							<th className="sag">Tutar</th>
						</tr>
					</thead>
					<tbody>
						{kalemler.map((k, i) => (
							<tr key={k.id}>
								<td className="sira">{String(i + 1).padStart(2, '0')}</td>
								<td>
									<span className="kalem-ad">{k.baslik}</span>
									{k.aciklama && <span className="kalem-not">{k.aciklama}</span>}
								</td>
								<td className="sag tekdüze">
									{Number(k.miktar)} {k.birim}
								</td>
								<td className="sag tekdüze">
									{paraBicimle(Number(k.birim_fiyat))}
								</td>
								<td className="sag tekdüze güçlü">
									{paraBicimle(Number(k.toplam))}
								</td>
							</tr>
						))}
						{kalemler.length === 0 && (
							<tr>
								<td colSpan={5} className="bos">
									Kalem eklenmedi.
								</td>
							</tr>
						)}
					</tbody>
				</table>

				<section className="toplam">
					<dl>
						<div>
							<dt>Ara toplam</dt>
							<dd>{paraBicimle(hesap.araToplam)}</dd>
						</div>
						{hesap.indirim > 0 && (
							<div>
								<dt>İndirim</dt>
								<dd>− {paraBicimle(hesap.indirim)}</dd>
							</div>
						)}
						<div>
							<dt>KDV (%{Number(t.kdv_orani)})</dt>
							<dd>{paraBicimle(hesap.kdv)}</dd>
						</div>
						<div className="genel">
							<dt>Genel toplam</dt>
							<dd>{paraBicimle(hesap.genelToplam)}</dd>
						</div>
					</dl>
				</section>

				{t.gecerlilik && (
					<p className="gecerlilik">
						Bu teklif <strong>{tarihiBicimle(t.gecerlilik)}</strong> tarihine
						kadar geçerlidir.
					</p>
				)}

				{t.kosullar && (
					<section className="kosullar">
						<p className="etiket">Şartlar ve kapsam</p>
						<p className="kosul-metin">{t.kosullar}</p>
					</section>
				)}

				<footer className="alt">
					<p>
						Sorularınız için: <strong>info@karasteknoloji.com</strong>
					</p>
					<p className="imza">Karas Teknoloji ❤️</p>
				</footer>
			</main>
		</>
	);
}

/* Çıktıya özel stil. Panelin token'ları kasten kullanılmıyor:
   karanlık modda siyah zeminli bir PDF üretmemeli. */
const STIL = `
  :root { color-scheme: light; }
  body { background: #f3f3f1; margin: 0; }

  .kagit {
    background: #fff;
    color: #16160f;
    max-width: 21cm;
    margin: 24px auto;
    padding: 26mm 20mm;
    font-family: var(--font-plex-sans), system-ui, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
  }

  .kagit .etiket {
    font-family: var(--font-plex-mono), ui-monospace, monospace;
    font-size: 7.5pt; letter-spacing: .14em; text-transform: uppercase;
    color: #6d6d5f; margin: 0 0 3px;
  }

  .ust { display: flex; justify-content: space-between; gap: 20px;
         border-bottom: 2px solid #16160f; padding-bottom: 14px; }
  .marka { font-family: var(--font-plex-mono), monospace; font-size: 13pt;
           font-weight: 600; letter-spacing: .18em; margin: 0 0 6px; }
  .marka-alt { font-size: 8.5pt; color: #5b5b4f; margin: 0; }
  .no-kutu { text-align: right; flex-shrink: 0; }
  .no { font-family: var(--font-plex-mono), monospace; font-size: 12pt;
        font-weight: 600; margin: 0; }
  .tarih { font-size: 9pt; margin: 0; }

  .alici { margin-top: 22px; }
  .alici-ad { font-size: 12pt; font-weight: 600; margin: 0; }
  .alici-alt { font-size: 9.5pt; color: #4a4a40; margin: 2px 0 0; }

  .baslik { font-size: 15pt; font-weight: 600; letter-spacing: -.01em;
            margin: 26px 0 0; }
  .giris { color: #3c3c33; margin: 10px 0 0; }

  .kalemler { width: 100%; border-collapse: collapse; margin-top: 24px; }
  .kalemler th {
    font-family: var(--font-plex-mono), monospace; font-size: 7.5pt;
    letter-spacing: .12em; text-transform: uppercase; color: #6d6d5f;
    text-align: left; font-weight: 500;
    border-bottom: 1px solid #16160f; padding: 0 8px 6px;
  }
  .kalemler td { border-bottom: 1px solid #e2e2d8; padding: 11px 8px;
                 vertical-align: top; }
  .kalemler .sira { width: 30px; font-family: var(--font-plex-mono), monospace;
                    font-size: 8.5pt; color: #8a8a7c; }
  .sag { text-align: right; }
  .tekdüze { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .güçlü { font-weight: 600; }
  .kalem-ad { display: block; font-weight: 600; }
  .kalem-not { display: block; font-size: 9pt; color: #55554a; margin-top: 3px; }
  .bos { text-align: center; color: #8a8a7c; padding: 20px; }

  .toplam { display: flex; justify-content: flex-end; margin-top: 18px; }
  .toplam dl { margin: 0; min-width: 260px; }
  .toplam dl > div { display: flex; justify-content: space-between;
                     padding: 5px 0; font-size: 10pt; }
  .toplam dt { color: #55554a; margin: 0; }
  .toplam dd { margin: 0; font-variant-numeric: tabular-nums; }
  .toplam .genel { border-top: 2px solid #16160f; margin-top: 6px;
                   padding-top: 10px; font-size: 13pt; font-weight: 600; }
  .toplam .genel dt { color: #16160f; }

  .gecerlilik { margin-top: 20px; font-size: 9.5pt; color: #3c3c33; }

  .kosullar { margin-top: 26px; border-top: 1px solid #e2e2d8; padding-top: 16px; }
  .kosul-metin { white-space: pre-wrap; font-size: 9.5pt; color: #3c3c33;
                 margin: 0; }

  .alt { margin-top: 30px; border-top: 1px solid #e2e2d8; padding-top: 14px;
         display: flex; justify-content: space-between; align-items: baseline;
         font-size: 9pt; color: #55554a; }
  .alt p { margin: 0; }
  .imza { font-family: var(--font-plex-mono), monospace; font-size: 8pt;
          letter-spacing: .1em; }

  @media print {
    body { background: #fff; }
    .kagit { margin: 0; max-width: none; padding: 0; }
    .yazdirma-yok { display: none !important; }
    /* Kalem satırı sayfa sonunda ikiye bölünmesin */
    .kalemler tr { break-inside: avoid; }
    .toplam, .kosullar { break-inside: avoid; }
  }

  @page { size: A4; margin: 16mm; }
`;
