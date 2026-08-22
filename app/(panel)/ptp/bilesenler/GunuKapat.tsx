'use client';

import { useState, useTransition } from 'react';
import { paraBicimle, paraCoz } from '@/lib/ortak/para';
import type { GunlukGorev } from '@/lib/tipler';
import { gunuKapat, type GunKapatmaSonucu } from '../eylemler';

/* Günü kapat.

   Akşam kapanışı tek ekranda: üstte ciro, altında kapanış görevleri,
   tek kaydet. Personel mağazayı kapatırken alt alta beş kutu açıp beş
   kez kaydetmiyor.

   Gün KİLİTLENMİYOR. Kapattıktan sonra da listeden işaretleme
   yapılabilir, ciro düzeltilebilir — unutulan bir iş akşam 11'de
   hatırlanır ve o an kapıyı kapatmak fayda değil engel olurdu. */

type Asama = 'kapali' | 'form' | 'onay' | 'bitti';

export function GunuKapat({
	gorevler,
	tarih,
}: {
	gorevler: GunlukGorev[];
	tarih: string;
}) {
	const [asama, setAsama] = useState<Asama>('kapali');
	const [secili, setSecili] = useState<Set<string>>(new Set());
	const [degerler, setDegerler] = useState<Record<string, string>>({});
	const [maddeler, setMaddeler] = useState<Record<string, Set<string>>>({});
	const [ciro, setCiro] = useState('');
	const [fis, setFis] = useState('');
	const [hata, setHata] = useState<string | null>(null);
	const [sonuc, setSonuc] = useState<GunKapatmaSonucu | null>(null);
	const [bekliyor, basla] = useTransition();

	const ciroGorev = gorevler.find((g) => g.tur === 'ciro') ?? null;
	const digerler = gorevler.filter((g) => g.tur !== 'ciro');

	const yapildi = (g: GunlukGorev) =>
		g.kayitlar.some((k) => k.durum === 'yapildi') && !g.tekrarlanabilir;

	/* Kroki ve eksik görevleri burada yapılamaz: biri harita, diğeri
	   ürün ürün giriş istiyor. Kapanış kutusunu bunlarla doldurmak,
	   akşam işini kolaylaştırmak yerine listenin küçültülmüş bir
	   kopyasını yapardı. Listede duruyorlar, burada hatırlatılıyorlar. */
	const listeden = digerler.filter(
		(g) => (g.tur === 'bolge' || g.tur === 'eksik') && !yapildi(g)
	);
	const kapatilabilir = digerler.filter(
		(g) => g.tur !== 'bolge' && g.tur !== 'eksik'
	);
	const bekleyen = kapatilabilir.filter((g) => !yapildi(g));

	const ciroYapildi = ciroGorev ? yapildi(ciroGorev) : true;
	const yapacakIsVar = bekleyen.length > 0 || !ciroYapildi;

	function isaretle(id: string) {
		setSecili((e) => {
			const y = new Set(e);
			if (y.has(id)) y.delete(id);
			else y.add(id);
			return y;
		});
	}

	function maddeIsaretle(gorevId: string, maddeId: string) {
		setMaddeler((e) => {
			const y = { ...e };
			const kume = new Set(y[gorevId] ?? []);
			if (kume.has(maddeId)) kume.delete(maddeId);
			else kume.add(maddeId);
			y[gorevId] = kume;
			return y;
		});
		setSecili((e) => new Set(e).add(gorevId));
	}

	/* Kapatmadan önce sayılan eksikler. Engellemiyor, soruyor: kasa
	   raporu alınamadığı gün personeli kilitlemek yanlış olurdu, ama
	   eksiğin sessizce geçmesi de yanlış. */
	function eksikler(): string[] {
		const liste: string[] = [];

		if (ciroGorev && !ciroYapildi && paraCoz(ciro) === null) {
			liste.push('Ciro girilmedi');
		}

		const atlanan = bekleyen.filter((g) => g.zorunlu && !secili.has(g.id));
		if (atlanan.length > 0) {
			liste.push(
				`${atlanan.length} zorunlu görev işaretlenmedi: ${atlanan
					.map((g) => g.baslik)
					.join(', ')}`
			);
		}

		if (listeden.length > 0) {
			liste.push(
				`${listeden.length} görev listeden yapılmalı: ${listeden
					.map((g) => g.baslik)
					.join(', ')}`
			);
		}

		return liste;
	}

	function kaydet() {
		setHata(null);

		const tutar = paraCoz(ciro);
		if (ciro.trim() && tutar === null) {
			setAsama('form');
			return setHata('Ciro tutarını okuyamadım.');
		}

		basla(async () => {
			const cevap = await gunuKapat({
				tarih,
				ciro:
					ciroGorev && !ciroYapildi && tutar !== null
						? {
								gorevId: ciroGorev.id,
								tutar,
								fisSayisi: fis.trim() ? Number(fis.replace(/\D/g, '')) : null,
							}
						: null,
				gorevler: [...secili].map((id) => {
					const g = kapatilabilir.find((x) => x.id === id);
					return {
						gorevId: id,
						maddeIdler: [...(maddeler[id] ?? [])],
						metin: g?.tur === 'metin' ? degerler[id] : undefined,
						sayi:
							g?.tur === 'sayi' && degerler[id]
								? Number(degerler[id].replace(',', '.'))
								: undefined,
					};
				}),
			});

			if (!cevap.tamam) {
				setAsama('form');
				return setHata(cevap.mesaj);
			}
			setSonuc(cevap.veri);
			setAsama('bitti');
		});
	}

	/* ---------- Kapalı hâl ---------- */

	if (asama === 'kapali') {
		if (!yapacakIsVar) {
			return (
				<div className="mt-6 border border-kenarlik px-4 py-3">
					<span className="etiket text-basarili">Gün kapatıldı</span>
					<p className="mt-1.5 text-sm text-metin-2">
						Kapanış görevlerinin hepsi işaretlendi
						{ciroGorev && ', ciro girildi'}.
					</p>
				</div>
			);
		}

		return (
			<button
				type="button"
				onClick={() => setAsama('form')}
				className="dugme dugme-dolu mt-6 w-full sm:w-auto"
			>
				Günü kapat
				<span className="ml-2 font-normal opacity-80">
					· {bekleyen.length + (ciroYapildi ? 0 : 1)} adım
				</span>
			</button>
		);
	}

	/* ---------- Bitti ---------- */

	if (asama === 'bitti' && sonuc) {
		return (
			<div className="mt-6 border border-kenarlik p-4">
				<span className="etiket text-basarili">Gün kapatıldı</span>
				<p className="mt-2 text-sm text-metin-2">
					{sonuc.kaydedilen} görev kaydedildi
					{sonuc.ciroYazildi && `, ciro ${paraBicimle(paraCoz(ciro) ?? 0)}`}.
				</p>

				{sonuc.atlananlar.length > 0 && (
					<ul className="mt-3 space-y-1">
						{sonuc.atlananlar.map((a) => (
							<li
								key={a}
								className="font-mono text-[0.6875rem] tracking-[0.04em] text-uyari"
							>
								{a}
							</li>
						))}
					</ul>
				)}

				<p className="mt-3 text-sm text-metin-3">
					Unuttuğunuz bir şey varsa aşağıdaki listeden işaretleyebilirsiniz —
					gün kilitlenmedi.
				</p>

				<button
					type="button"
					onClick={() => {
						setAsama('kapali');
						setSonuc(null);
						setSecili(new Set());
						setCiro('');
						setFis('');
					}}
					className="dugme dugme-bos mt-4"
				>
					Tamam
				</button>
			</div>
		);
	}

	/* ---------- Onay ---------- */

	if (asama === 'onay') {
		return (
			<div className="mt-6 border border-uyari p-4">
				<span className="etiket text-uyari">Eksik var</span>

				<ul className="mt-3 space-y-1.5">
					{eksikler().map((e) => (
						<li key={e} className="text-sm text-metin-2">
							· {e}
						</li>
					))}
				</ul>

				<p className="mt-3 text-sm text-metin-2">Yine de kapatılsın mı?</p>

				<div className="mt-4 flex flex-wrap gap-3">
					<button
						type="button"
						onClick={kaydet}
						disabled={bekliyor}
						className="dugme dugme-dolu"
					>
						{bekliyor ? 'Kaydediliyor…' : 'Evet, kapat'}
					</button>
					<button
						type="button"
						onClick={() => setAsama('form')}
						disabled={bekliyor}
						className="dugme dugme-bos"
					>
						Geri dön
					</button>
				</div>
			</div>
		);
	}

	/* ---------- Form ---------- */

	return (
		<div className="mt-6 border border-kenarlik p-4">
			<span className="etiket text-vurgu-metin">Günü kapat</span>

			{ciroGorev && !ciroYapildi && (
				<fieldset className="mt-4 border-b border-kenarlik-2 pb-5">
					<legend className="etiket">{ciroGorev.baslik}</legend>

					<div className="mt-2 flex flex-wrap gap-4">
						<div className="min-w-40 flex-1">
							<input
								type="text"
								inputMode="decimal"
								value={ciro}
								onChange={(e) => setCiro(e.target.value)}
								placeholder="12.500"
								className="alan text-lg"
								autoFocus
								aria-label="Ciro tutarı"
							/>
						</div>
						<div className="w-28">
							<input
								type="text"
								inputMode="numeric"
								value={fis}
								onChange={(e) => setFis(e.target.value)}
								placeholder="Fiş"
								className="alan"
								aria-label="Fiş sayısı"
							/>
						</div>
					</div>

					{/* Bir hane fazla yazmak en sık yapılan hata; kaydetmeden
					    önce burada görünüyor. */}
					<p className="mt-2 font-mono text-sm text-metin-2" aria-live="polite">
						{ciro.trim() === ''
							? ciroGorev.ipucu || 'Kasa raporundaki toplamı yazın.'
							: paraCoz(ciro) === null
								? 'Bu bir tutar gibi görünmüyor.'
								: paraBicimle(paraCoz(ciro)!, true)}
					</p>
				</fieldset>
			)}

			{ciroGorev && ciroYapildi && (
				<p className="mt-3 font-mono text-[0.6875rem] tracking-[0.04em] text-basarili">
					ciro girildi
				</p>
			)}

			{bekleyen.length > 0 ? (
				<fieldset className="mt-5">
					<legend className="etiket">
						Kapanış görevleri · {secili.size} / {bekleyen.length}
					</legend>

					<ul className="mt-3 space-y-3">
						{bekleyen.map((gorev) => (
							<li key={gorev.id}>
								<label className="flex cursor-pointer items-start gap-3">
									<input
										type="checkbox"
										checked={secili.has(gorev.id)}
										onChange={() => isaretle(gorev.id)}
										className="onay mt-0.5 shrink-0"
									/>
									<span className="text-sm">
										{gorev.baslik}
										{gorev.zorunlu && (
											<span className="ml-1.5 text-vurgu-metin" title="Zorunlu">
												*
											</span>
										)}
									</span>
								</label>

								{(gorev.tur === 'metin' || gorev.tur === 'sayi') &&
									secili.has(gorev.id) && (
										<input
											type="text"
											inputMode={gorev.tur === 'sayi' ? 'decimal' : 'text'}
											value={degerler[gorev.id] ?? ''}
											onChange={(e) =>
												setDegerler((d) => ({
													...d,
													[gorev.id]: e.target.value,
												}))
											}
											placeholder={gorev.tur === 'sayi' ? 'Sayı' : 'Açıklama'}
											className="alan mt-2 ml-8 w-[calc(100%-2rem)]"
										/>
									)}

								{gorev.tur === 'kontrol' && gorev.maddeler.length > 0 && (
									<ul className="mt-2 ml-8 space-y-1.5">
										{[...gorev.maddeler]
											.sort((a, b) => a.sira - b.sira)
											.map((madde) => (
												<li key={madde.id}>
													<label className="flex cursor-pointer items-start gap-2.5">
														<input
															type="checkbox"
															checked={
																maddeler[gorev.id]?.has(madde.id) ?? false
															}
															onChange={() =>
																maddeIsaretle(gorev.id, madde.id)
															}
															className="onay mt-0.5 shrink-0"
														/>
														<span className="text-sm text-metin-2">
															{madde.metin}
														</span>
													</label>
												</li>
											))}
									</ul>
								)}
							</li>
						))}
					</ul>
				</fieldset>
			) : (
				<p className="mt-5 text-sm text-metin-2">
					Kapanış görevlerinin hepsi işaretlenmiş.
				</p>
			)}

			{listeden.length > 0 && (
				<div className="mt-5 border border-kenarlik-2 px-3 py-2.5">
					<span className="etiket">Listeden yapılacak</span>
					<ul className="mt-1.5 space-y-1">
						{listeden.map((g) => (
							<li key={g.id} className="text-sm text-metin-2">
								· {g.baslik}
							</li>
						))}
					</ul>
					<p className="mt-1.5 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
						Bunlar kroki ya da ürün girişi istiyor; aşağıdaki listeden yapılır.
					</p>
				</div>
			)}

			{hata && (
				<p role="alert" className="mt-4 text-sm text-hata">
					{hata}
				</p>
			)}

			<div className="mt-5 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={() => (eksikler().length > 0 ? setAsama('onay') : kaydet())}
					disabled={bekliyor}
					className="dugme dugme-dolu"
				>
					{bekliyor ? 'Kaydediliyor…' : 'Günü kapat'}
				</button>
				<button
					type="button"
					onClick={() => {
						setAsama('kapali');
						setHata(null);
					}}
					disabled={bekliyor}
					className="dugme dugme-bos"
				>
					Vazgeç
				</button>
			</div>
		</div>
	);
}
