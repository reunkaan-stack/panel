'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { paraBicimle, paraCoz } from '@/lib/ortak/para';
import {
	DURUM_ADLARI,
	toplamlar,
	type Teklif,
	type TeklifDurumu,
	type TeklifKalemi,
} from '@/lib/teklif';
import {
	kalemleriKaydet,
	teklifKaydet,
	teklifSil,
	type KalemGirdisi,
} from '../eylemler';

/* Teklif düzenleme.

   Toplamlar yazarken anında güncelleniyor: rakamı görmeden fiyat
   ayarlamak, kaydet-bak-geri dön döngüsü demek. Hesap lib/teklif.ts
   içindeki tek fonksiyondan geliyor — yazdırma sayfası da aynı
   fonksiyonu kullanıyor, iki ekran aynı rakamı gösteriyor. */

export function TeklifDuzenle({
	teklif,
	kalemler: gelen,
}: {
	teklif: Teklif;
	kalemler: TeklifKalemi[];
}) {
	const router = useRouter();

	const [alan, setAlan] = useState({
		musteri_ad: teklif.musteri_ad,
		musteri_firma: teklif.musteri_firma,
		musteri_eposta: teklif.musteri_eposta,
		musteri_telefon: teklif.musteri_telefon,
		baslik: teklif.baslik,
		giris: teklif.giris,
		kosullar: teklif.kosullar,
		tarih: teklif.tarih,
		gecerlilik: teklif.gecerlilik ?? '',
		indirim: String(teklif.indirim ?? 0),
		kdv_orani: String(teklif.kdv_orani ?? 20),
		durum: teklif.durum as TeklifDurumu,
	});

	const [kalemler, setKalemler] = useState<KalemGirdisi[]>(
		gelen.map((k) => ({
			id: k.id,
			sira: k.sira,
			baslik: k.baslik,
			aciklama: k.aciklama,
			miktar: String(k.miktar),
			birim: k.birim,
			birim_fiyat: String(k.birim_fiyat),
		}))
	);

	const [durum, setDurum] = useState<string | null>(null);
	const [sonEklenen, setSonEklenen] = useState<number | null>(null);
	const [bekliyor, basla] = useTransition();

	const hesap = useMemo(
		() =>
			toplamlar(
				kalemler.map((k) => ({
					miktar: paraCoz(k.miktar) ?? 0,
					birim_fiyat: paraCoz(k.birim_fiyat) ?? 0,
				})),
				paraCoz(alan.indirim) ?? 0,
				paraCoz(alan.kdv_orani) ?? 20
			),
		[kalemler, alan.indirim, alan.kdv_orani]
	);

	function yaz(ad: keyof typeof alan, deger: string) {
		setAlan((a) => ({ ...a, [ad]: deger }));
	}

	/* Yeni kalem listenin sonuna eklenip odaklanıyor: eklendiğini
	   görmek için sayfada aranmasın. */
	function kalemEkle() {
		setKalemler((k) => [
			...k,
			{
				sira: k.length + 1,
				baslik: '',
				aciklama: '',
				miktar: '1',
				birim: 'adet',
				birim_fiyat: '0',
			},
		]);
		setSonEklenen(kalemler.length);
	}

	function kalemYaz(i: number, ad: keyof KalemGirdisi, deger: string) {
		setKalemler((k) =>
			k.map((x, j) => (i === j ? { ...x, [ad]: deger } : x))
		);
	}

	function kaydet() {
		setDurum(null);
		basla(async () => {
			const a = await teklifKaydet(teklif.id, alan);
			if (!a.tamam) return setDurum(a.mesaj);
			const b = await kalemleriKaydet(teklif.id, kalemler);
			if (!b.tamam) return setDurum(b.mesaj);
			setDurum('Kaydedildi');
			router.refresh();
		});
	}

	return (
		<>
			<div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
				<div>
					<span className="etiket text-vurgu-metin">Teklif {teklif.no}</span>
					<h1 className="mt-2 text-2xl font-semibold tracking-[-0.015em]">
						{alan.musteri_firma || alan.musteri_ad || 'Yeni teklif'}
					</h1>
				</div>

				<div className="flex flex-wrap gap-3">
					<Link
						href={`/yazdir/teklif/${teklif.id}`}
						target="_blank"
						className="dugme dugme-bos"
					>
						Yazdır / PDF
					</Link>
					<button
						type="button"
						onClick={kaydet}
						disabled={bekliyor}
						className="dugme dugme-dolu"
					>
						{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
					</button>
				</div>
			</div>

			{durum && (
				<p
					role="status"
					className={`mt-4 text-sm ${durum === 'Kaydedildi' ? 'text-basarili' : 'text-hata'}`}
				>
					{durum}
				</p>
			)}

			<p className="mt-3 text-sm text-metin-3">
				Yazdırma ekranı yeni sekmede açılır; tarayıcının yazdırma penceresinde
				hedefi <strong>“PDF olarak kaydet”</strong> seçin.
			</p>

			{/* ---- Alıcı ---- */}
			<section className="mt-8 border border-kenarlik p-4">
				<span className="etiket">Alıcı</span>
				<div className="mt-3 grid gap-4 sm:grid-cols-2">
					<Girdi
						etiket="Ad soyad"
						deger={alan.musteri_ad}
						degistir={(v) => yaz('musteri_ad', v)}
					/>
					<Girdi
						etiket="Firma / unvan"
						deger={alan.musteri_firma}
						degistir={(v) => yaz('musteri_firma', v)}
						ipucu="Örnek: Dyt. Ayşe Yılmaz Beslenme Danışmanlığı"
					/>
					<Girdi
						etiket="E-posta"
						deger={alan.musteri_eposta}
						degistir={(v) => yaz('musteri_eposta', v)}
					/>
					<Girdi
						etiket="Telefon"
						deger={alan.musteri_telefon}
						degistir={(v) => yaz('musteri_telefon', v)}
					/>
				</div>
			</section>

			{/* ---- Teklif metni ---- */}
			<section className="mt-6 border border-kenarlik p-4">
				<span className="etiket">Teklif</span>
				<div className="mt-3 space-y-4">
					<Girdi
						etiket="Başlık"
						deger={alan.baslik}
						degistir={(v) => yaz('baslik', v)}
					/>
					<label className="block">
						<span className="etiket">Giriş yazısı</span>
						<textarea
							value={alan.giris}
							onChange={(e) => yaz('giris', e.target.value)}
							rows={3}
							className="alan mt-2 resize-y"
						/>
					</label>

					<div className="grid gap-4 sm:grid-cols-3">
						<Girdi
							etiket="Teklif tarihi"
							tip="date"
							deger={alan.tarih}
							degistir={(v) => yaz('tarih', v)}
						/>
						<Girdi
							etiket="Geçerlilik"
							tip="date"
							deger={alan.gecerlilik}
							degistir={(v) => yaz('gecerlilik', v)}
						/>
						<label className="block">
							<span className="etiket">Durum</span>
							<select
								value={alan.durum}
								onChange={(e) => yaz('durum', e.target.value)}
								className="alan mt-2"
							>
								{(Object.keys(DURUM_ADLARI) as TeklifDurumu[]).map((d) => (
									<option key={d} value={d}>
										{DURUM_ADLARI[d]}
									</option>
								))}
							</select>
						</label>
					</div>
				</div>
			</section>

			{/* ---- Kalemler ---- */}
			<section className="mt-6 border border-kenarlik p-4">
				<div className="flex flex-wrap items-baseline justify-between gap-2">
					<span className="etiket">Kalemler · {kalemler.length}</span>
					<button
						type="button"
						onClick={kalemEkle}
						className="dugme dugme-bos !px-3 !py-1.5"
					>
						+ Kalem ekle
					</button>
				</div>

				<ul className="mt-4 space-y-4">
					{kalemler.map((k, i) => {
						const satirToplam =
							(paraCoz(k.miktar) ?? 0) * (paraCoz(k.birim_fiyat) ?? 0);

						return (
							<li key={i} className="border border-kenarlik-2 p-3">
								<div className="flex flex-wrap items-start gap-2">
									<span className="w-6 shrink-0 pt-2.5 font-mono text-[0.6875rem] text-metin-3">
										{String(i + 1).padStart(2, '0')}
									</span>
									<input
										type="text"
										value={k.baslik}
										onChange={(e) => kalemYaz(i, 'baslik', e.target.value)}
										placeholder="Kalem adı"
										className="alan min-w-40 flex-1"
										aria-label={`${i + 1}. kalem adı`}
										autoFocus={sonEklenen === i}
									/>
									<button
										type="button"
										onClick={() =>
											setKalemler((x) => x.filter((_, j) => j !== i))
										}
										className="shrink-0 border border-kenarlik px-3 py-2 font-mono text-sm text-metin-3 hover:border-hata hover:text-hata"
										aria-label={`${i + 1}. kalemi sil`}
									>
										×
									</button>
								</div>

								<textarea
									value={k.aciklama}
									onChange={(e) => kalemYaz(i, 'aciklama', e.target.value)}
									placeholder="Ne kapsıyor — müşteri bunu okuyacak"
									rows={2}
									className="alan mt-2 ml-8 w-[calc(100%-2rem)] resize-y text-sm"
								/>

								<div className="mt-2 ml-8 flex flex-wrap items-center gap-2">
									<input
										type="text"
										inputMode="decimal"
										value={k.miktar}
										onChange={(e) => kalemYaz(i, 'miktar', e.target.value)}
										className="alan w-20"
										aria-label="Miktar"
									/>
									<input
										type="text"
										value={k.birim}
										onChange={(e) => kalemYaz(i, 'birim', e.target.value)}
										className="alan w-24"
										aria-label="Birim"
									/>
									<span className="text-metin-3">×</span>
									<input
										type="text"
										inputMode="decimal"
										value={k.birim_fiyat}
										onChange={(e) => kalemYaz(i, 'birim_fiyat', e.target.value)}
										className="alan w-32"
										aria-label="Birim fiyat"
									/>
									<span className="ml-auto tabular-nums font-medium">
										{paraBicimle(satirToplam)}
									</span>
								</div>
							</li>
						);
					})}
				</ul>

				{/* Liste uzayınca üstteki düğmeye dönmek için yukarı
				    kaydırmak gerekiyordu; ikincisi burada duruyor. */}
				<button
					type="button"
					onClick={kalemEkle}
					className="dugme dugme-bos mt-4 w-full"
				>
					+ Kalem ekle
				</button>
			</section>

			{/* ---- Toplam ---- */}
			<section className="mt-6 border border-kenarlik p-4">
				<span className="etiket">Toplam</span>

				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<Girdi
						etiket="İndirim (tutar)"
						deger={alan.indirim}
						degistir={(v) => yaz('indirim', v)}
					/>
					<Girdi
						etiket="KDV oranı"
						deger={alan.kdv_orani}
						degistir={(v) => yaz('kdv_orani', v)}
					/>
				</div>

				<dl className="mt-5 space-y-2 border-t border-kenarlik-2 pt-4 text-sm">
					<Satir ad="Ara toplam" deger={paraBicimle(hesap.araToplam)} />
					{hesap.indirim > 0 && (
						<Satir ad="İndirim" deger={`− ${paraBicimle(hesap.indirim)}`} />
					)}
					<Satir
						ad={`KDV (%${paraCoz(alan.kdv_orani) ?? 20})`}
						deger={paraBicimle(hesap.kdv)}
					/>
					<div className="flex items-baseline justify-between border-t border-kenarlik pt-3">
						<dt className="font-medium">Genel toplam</dt>
						<dd className="text-xl font-semibold tabular-nums">
							{paraBicimle(hesap.genelToplam)}
						</dd>
					</div>
				</dl>
			</section>

			{/* ---- Koşullar ---- */}
			<section className="mt-6 border border-kenarlik p-4">
				<label className="block">
					<span className="etiket">Şartlar ve kapsam</span>
					<textarea
						value={alan.kosullar}
						onChange={(e) => yaz('kosullar', e.target.value)}
						rows={6}
						className="alan mt-2 resize-y text-sm"
					/>
				</label>
				<p className="mt-2 text-sm text-metin-3">
					Neyin dahil olmadığını yazmak, sonradan çıkan tartışmaların çoğunu
					baştan bitiriyor.
				</p>
			</section>

			<div className="mt-8 flex flex-wrap items-center gap-3">
				<button
					type="button"
					onClick={kaydet}
					disabled={bekliyor}
					className="dugme dugme-dolu"
				>
					{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
				</button>
				<Link
					href={`/yazdir/teklif/${teklif.id}`}
					target="_blank"
					className="dugme dugme-bos"
				>
					Yazdır / PDF
				</Link>
				<button
					type="button"
					disabled={bekliyor}
					onClick={() =>
						basla(async () => {
							const s = await teklifSil(teklif.id);
							if (!s.tamam) return setDurum(s.mesaj);
							router.push('/teklifler');
						})
					}
					className="ml-auto font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-hata"
				>
					Teklifi sil
				</button>
			</div>
		</>
	);
}

function Girdi({
	etiket,
	deger,
	degistir,
	tip = 'text',
	ipucu,
}: {
	etiket: string;
	deger: string;
	degistir: (v: string) => void;
	tip?: string;
	ipucu?: string;
}) {
	return (
		<label className="block">
			<span className="etiket">{etiket}</span>
			<input
				type={tip}
				value={deger}
				onChange={(e) => degistir(e.target.value)}
				placeholder={ipucu}
				className="alan mt-2"
			/>
		</label>
	);
}

function Satir({ ad, deger }: { ad: string; deger: string }) {
	return (
		<div className="flex items-baseline justify-between">
			<dt className="text-metin-2">{ad}</dt>
			<dd className="tabular-nums">{deger}</dd>
		</div>
	);
}
