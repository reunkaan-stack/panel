'use client';

import { useRef, useState, useTransition } from 'react';
import type { BolgeSatiri } from '../page';
import {
	bolgeAdiDegistir,
	bolgeEkle,
	bolgeSil,
	yerlesimKaydet,
} from '../eylemler';

/* Mağaza krokisi — çizim ve ısı haritası.

   SVG kullanılıyor, kütüphane yok: ihtiyaç dikdörtgen çizmek,
   sürüklemek ve boyutlandırmak. Bunun için bir çizim kütüphanesi
   eklemek "yüz satırla yazılacak iş için paket ekleme" kuralına
   girerdi.

   Koordinatlar 1000x600 birimlik sabit alanda; ekranda orantılı
   ölçekleniyor. Izgaraya oturma (20 birim) hem hizalamayı kolaylaştırıyor
   hem blueprint diline uyuyor. */

const EN = 1000;
const BOY = 600;
const IZGARA = 20;

type Yerlesim = { x: number; y: number; en: number; boy: number };
type Kutu = BolgeSatiri & Yerlesim;

type Surukleme =
	| { tur: 'yok' }
	| { tur: 'cizim'; baslangicX: number; baslangicY: number; simdiX: number; simdiY: number }
	| { tur: 'tasima'; id: string; farkX: number; farkY: number }
	| { tur: 'boyut'; id: string };

const otur = (n: number) => Math.round(n / IZGARA) * IZGARA;

/* SVG metni sarmaz ve taşar. Kutu genişliğine sığmayan ad kısaltılır;
   yoksa yan yana iki kutunun yazısı üst üste biniyor. */
function kisalt(metin: string, kutuEni: number, harfGenisligi: number): string {
	const sigan = Math.floor((kutuEni - 20) / harfGenisligi);
	if (metin.length <= sigan) return metin;
	return metin.slice(0, Math.max(1, sigan - 1)) + '…';
}

export function Kroki({
	bolgeler,
	yogunluk,
	gunSayisi,
}: {
	bolgeler: BolgeSatiri[];
	yogunluk: Record<string, number>;
	gunSayisi: number;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [kutular, setKutular] = useState<Kutu[]>(() =>
		bolgeler
			.filter((b) => b.kroki_x !== null)
			.map((b) => ({
				...b,
				x: b.kroki_x!,
				y: b.kroki_y!,
				en: b.kroki_en!,
				boy: b.kroki_boy!,
			}))
	);
	const [secili, setSecili] = useState<string | null>(null);
	const [surukleme, setSurukleme] = useState<Surukleme>({ tur: 'yok' });
	const [degisti, setDegisti] = useState(false);
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	const enYogun = Math.max(1, ...Object.values(yogunluk));

	/** Ekran koordinatını çizim alanı koordinatına çevirir. */
	function noktaya(olay: React.PointerEvent): { x: number; y: number } {
		const kutu = svgRef.current!.getBoundingClientRect();
		return {
			x: ((olay.clientX - kutu.left) / kutu.width) * EN,
			y: ((olay.clientY - kutu.top) / kutu.height) * BOY,
		};
	}

	function zeminBasildi(olay: React.PointerEvent) {
		if (olay.target !== olay.currentTarget) return;
		const p = noktaya(olay);
		setSecili(null);
		setSurukleme({
			tur: 'cizim',
			baslangicX: otur(p.x),
			baslangicY: otur(p.y),
			simdiX: otur(p.x),
			simdiY: otur(p.y),
		});
		svgRef.current?.setPointerCapture(olay.pointerId);
	}

	function hareket(olay: React.PointerEvent) {
		if (surukleme.tur === 'yok') return;
		const p = noktaya(olay);

		if (surukleme.tur === 'cizim') {
			setSurukleme({ ...surukleme, simdiX: otur(p.x), simdiY: otur(p.y) });
			return;
		}

		setKutular((eski) =>
			eski.map((k) => {
				if (k.id !== surukleme.id) return k;
				if (surukleme.tur === 'tasima') {
					return {
						...k,
						x: Math.max(0, Math.min(EN - k.en, otur(p.x - surukleme.farkX))),
						y: Math.max(0, Math.min(BOY - k.boy, otur(p.y - surukleme.farkY))),
					};
				}
				return {
					...k,
					en: Math.max(60, Math.min(EN - k.x, otur(p.x - k.x))),
					boy: Math.max(40, Math.min(BOY - k.y, otur(p.y - k.y))),
				};
			})
		);
		setDegisti(true);
	}

	function birakildi() {
		if (surukleme.tur === 'cizim') {
			const x = Math.min(surukleme.baslangicX, surukleme.simdiX);
			const y = Math.min(surukleme.baslangicY, surukleme.simdiY);
			const en = Math.abs(surukleme.simdiX - surukleme.baslangicX);
			const boy = Math.abs(surukleme.simdiY - surukleme.baslangicY);

			/* Kazara tıklama yeni bölge açmasın */
			if (en >= 60 && boy >= 40) {
				const ad = prompt('Bölüm adı:')?.trim();
				if (ad) {
					setHata(null);
					basla(async () => {
						const sonuc = await bolgeEkle(ad, {
							kroki_x: x,
							kroki_y: y,
							kroki_en: en,
							kroki_boy: boy,
						});
						if (!sonuc.tamam) return setHata(sonuc.mesaj);
						setKutular((e) => [
							...e,
							{
								id: sonuc.veri,
								ad,
								kroki_x: x, kroki_y: y, kroki_en: en, kroki_boy: boy,
								x, y, en, boy,
							},
						]);
					});
				}
			}
		}
		setSurukleme({ tur: 'yok' });
	}

	/** Çakışmayan ilk boş yeri bulur. */
	function bosYer(): { x: number; y: number } {
		const en = 180;
		const boy = 130;
		for (let y = 0; y + boy <= BOY; y += IZGARA * 2) {
			for (let x = 0; x + en <= EN; x += IZGARA * 2) {
				const cakisma = kutular.some(
					(k) =>
						x < k.x + k.en && x + en > k.x && y < k.y + k.boy && y + boy > k.y
				);
				if (!cakisma) return { x, y };
			}
		}
		return { x: 0, y: 0 };
	}

	function bolumEkleDugmesi() {
		const ad = prompt('Bölüm adı:')?.trim();
		if (!ad) return;
		const yer = bosYer();
		setHata(null);
		basla(async () => {
			const sonuc = await bolgeEkle(ad, {
				kroki_x: yer.x,
				kroki_y: yer.y,
				kroki_en: 180,
				kroki_boy: 130,
			});
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setKutular((e) => [
				...e,
				{
					id: sonuc.veri,
					ad,
					kroki_x: yer.x, kroki_y: yer.y, kroki_en: 180, kroki_boy: 130,
					x: yer.x, y: yer.y, en: 180, boy: 130,
				},
			]);
			setSecili(sonuc.veri);
		});
	}

	function kaydet() {
		setHata(null);
		basla(async () => {
			const sonuc = await yerlesimKaydet(
				kutular.map((k) => ({
					id: k.id,
					kroki_x: k.x,
					kroki_y: k.y,
					kroki_en: k.en,
					kroki_boy: k.boy,
				}))
			);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setDegisti(false);
		});
	}

	function adDegistir(kutu: Kutu) {
		const ad = prompt('Bölüm adı:', kutu.ad)?.trim();
		if (!ad || ad === kutu.ad) return;
		setHata(null);
		basla(async () => {
			const sonuc = await bolgeAdiDegistir(kutu.id, ad);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setKutular((e) => e.map((k) => (k.id === kutu.id ? { ...k, ad } : k)));
		});
	}

	function sil(kutu: Kutu) {
		if (!confirm(`"${kutu.ad}" bölümünü sil — geçmiş kayıtlarda adı kalır.`)) return;
		setHata(null);
		basla(async () => {
			const sonuc = await bolgeSil(kutu.id);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setKutular((e) => e.filter((k) => k.id !== kutu.id));
			setSecili(null);
		});
	}

	const seciliKutu = kutular.find((k) => k.id === secili) ?? null;

	return (
		<>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<p className="max-w-md font-mono text-[0.6875rem] leading-relaxed tracking-[0.04em] text-metin-3">
					Boş alana sürükleyerek yeni bölüm çizin · kutuyu sürükleyerek
					taşıyın · sağ alt köşeden boyutlandırın
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						onClick={bolumEkleDugmesi}
						disabled={bekliyor}
						className="dugme dugme-bos"
					>
						Bölüm ekle
					</button>
					<button
						type="button"
						onClick={kaydet}
						disabled={!degisti || bekliyor}
						className="dugme dugme-dolu"
					>
						{bekliyor ? 'Kaydediliyor…' : degisti ? 'Yerleşimi kaydet' : 'Kaydedildi'}
					</button>
				</div>
			</div>

			{hata && (
				<p role="alert" className="mt-4 border border-hata px-4 py-3 text-sm text-hata">
					{hata}
				</p>
			)}

			<svg
				ref={svgRef}
				viewBox={`0 0 ${EN} ${BOY}`}
				className="mt-4 w-full touch-none border border-metin bg-zemin"
				onPointerDown={zeminBasildi}
				onPointerMove={hareket}
				onPointerUp={birakildi}
				onPointerLeave={birakildi}
				role="application"
				aria-label="Mağaza krokisi"
			>
				<defs>
					<pattern id="izgara" width={IZGARA} height={IZGARA} patternUnits="userSpaceOnUse">
						<path
							d={`M ${IZGARA} 0 L 0 0 0 ${IZGARA}`}
							fill="none"
							stroke="var(--color-kenarlik-2)"
							strokeWidth="1"
						/>
					</pattern>
				</defs>
				{/* pointerEvents=none ŞART: yoksa bu dikdörtgen tıklamayı
				    yakalar, olay svg'ye ulaşmaz ve "boş alana çizim"
				    hiç çalışmaz. */}
				<rect
					width={EN}
					height={BOY}
					fill="url(#izgara)"
					pointerEvents="none"
				/>

				{kutular.map((kutu) => {
					const sayi = yogunluk[kutu.id] ?? 0;
					const oran = sayi / enYogun;
					const isSecili = kutu.id === secili;

					return (
						<g key={kutu.id}>
							<rect
								x={kutu.x}
								y={kutu.y}
								width={kutu.en}
								height={kutu.boy}
								fill="var(--color-vurgu)"
								fillOpacity={sayi === 0 ? 0.04 : 0.12 + oran * 0.55}
								stroke={isSecili ? 'var(--color-vurgu)' : 'var(--color-metin)'}
								strokeWidth={isSecili ? 3 : 1.5}
								className="cursor-move"
								onPointerDown={(olay) => {
									olay.stopPropagation();
									const p = noktaya(olay);
									setSecili(kutu.id);
									setSurukleme({
										tur: 'tasima',
										id: kutu.id,
										farkX: p.x - kutu.x,
										farkY: p.y - kutu.y,
									});
									svgRef.current?.setPointerCapture(olay.pointerId);
								}}
							/>

							<text
								x={kutu.x + 10}
								y={kutu.y + 26}
								className="pointer-events-none select-none"
								fill="var(--color-metin)"
								fontSize="20"
								fontWeight="600"
							>
								{kisalt(kutu.ad, kutu.en, 10.5)}
								<title>{kutu.ad}</title>
							</text>

							{/* Renk tek başına anlam taşımaz: sayı da yazılır */}
							<text
								x={kutu.x + 10}
								y={kutu.y + 50}
								className="pointer-events-none select-none"
								fill="var(--color-metin-2)"
								fontSize="16"
								fontFamily="var(--font-mono)"
							>
								{sayi} kez
							</text>

							{/* Boyutlandırma tutamağı */}
							<rect
								x={kutu.x + kutu.en - 14}
								y={kutu.y + kutu.boy - 14}
								width={14}
								height={14}
								fill="var(--color-metin)"
								className="cursor-nwse-resize"
								onPointerDown={(olay) => {
									olay.stopPropagation();
									setSecili(kutu.id);
									setSurukleme({ tur: 'boyut', id: kutu.id });
									svgRef.current?.setPointerCapture(olay.pointerId);
								}}
							/>
						</g>
					);
				})}

				{surukleme.tur === 'cizim' && (
					<rect
						x={Math.min(surukleme.baslangicX, surukleme.simdiX)}
						y={Math.min(surukleme.baslangicY, surukleme.simdiY)}
						width={Math.abs(surukleme.simdiX - surukleme.baslangicX)}
						height={Math.abs(surukleme.simdiY - surukleme.baslangicY)}
						fill="var(--color-vurgu)"
						fillOpacity={0.15}
						stroke="var(--color-vurgu)"
						strokeWidth={2}
						strokeDasharray="8 4"
					/>
				)}
			</svg>

			{seciliKutu && (
				<div className="mt-4 flex flex-wrap items-center gap-3 border border-kenarlik p-4">
					<span className="etiket flex-1">{seciliKutu.ad}</span>
					<button
						type="button"
						onClick={() => adDegistir(seciliKutu)}
						disabled={bekliyor}
						className="dugme dugme-bos !px-3 !py-1.5"
					>
						Adını değiştir
					</button>
					<button
						type="button"
						onClick={() => sil(seciliKutu)}
						disabled={bekliyor}
						className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-hata"
					>
						Sil
					</button>
				</div>
			)}

			<p className="mt-4 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
				Son {gunSayisi} günde en çok seçilen bölüm en koyu görünür.
				{kutular.length === 0 && ' Henüz bölüm çizilmedi.'}
			</p>
		</>
	);
}
