'use client';

import { useState, useTransition } from 'react';
import { KATEGORI_ADLARI, type Bolge, type GunlukGorev } from '@/lib/tipler';
import { paraBicimle, paraCoz } from '@/lib/ortak/para';
import { atlamaEkle, kayitEkle, kayitSil } from '../eylemler';
import { KrokiSecici } from './KrokiSecici';

/* Tek görev satırı.

   Görev bir TANIM; "yapıldı mı" sorusu o güne ait kayıtlardan
   okunuyor. Kayıt yoksa görev bekliyor demektir — ayrı bir durum
   alanı yok, olmayan şeyin kaydı da yok. */

export function GorevSatir({
	gorev,
	yonetici,
	benim,
	secili,
	isaretle,
	saatiBicimle,
	bolgeler,
	tarih,
}: {
	gorev: GunlukGorev;
	yonetici: boolean;
	benim: boolean;
	secili: boolean;
	isaretle: () => void;
	saatiBicimle: (an: string) => string;
	bolgeler: Bolge[];
	tarih: string;
}) {
	const [acik, setAcik] = useState(false);
	/* Kayıt dökümü kapalı başlıyor: yapılmış bir görevin sekiz satırlık
	   geçmişi her gün ekranda durursa liste okunmaz hâle geliyor.
	   "Ne zaman, kim" özeti üstteki satırda zaten var. */
	const [detay, setDetay] = useState(false);
	const [deger, setDeger] = useState('');
	const [seciliBolgeler, setSeciliBolgeler] = useState<Set<string>>(new Set());
	const [seciliMaddeler, setSeciliMaddeler] = useState<Set<string>>(new Set());
	const [sebep, setSebep] = useState('');
	/* Eksik görevinde eklenen ürünler; kaydedilene kadar burada durur */
	const [eksikListesi, setEksikListesi] = useState<string[]>([]);
	const [yeniEksik, setYeniEksik] = useState('');
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	const kayitlar = [...gorev.kayitlar].sort((a, b) =>
		b.zaman.localeCompare(a.zaman)
	);
	const yapilanlar = kayitlar.filter((k) => k.durum === 'yapildi');
	const atlananlar = kayitlar.filter((k) => k.durum === 'atlandi');
	const kapandi = kayitlar.length > 0;

	/* Tekrarlanabilir ve bölge görevleri gün boyu açık kalır; diğerleri
	   bir kez kaydedilince kapanır. */
	const yenidenYapilabilir = gorev.tekrarlanabilir || gorev.tur === 'bolge';
	const kaydedebilir =
		(yenidenYapilabilir || !kapandi) &&
		(yonetici || benim || !gorev.atanan_id);

	const maddeler = [...gorev.maddeler].sort((a, b) => a.sira - b.sira);

	function kaydet() {
		setHata(null);

		if (gorev.tur === 'metin' && !deger.trim()) {
			return setHata('Bir şey yazmanız gerekiyor');
		}
		let sayi: number | undefined;
		if (gorev.tur === 'sayi') {
			sayi = Number(deger.replace(',', '.'));
			if (!Number.isFinite(sayi)) return setHata('Geçerli bir sayı girin');
		}
		if (gorev.tur === 'bolge' && seciliBolgeler.size === 0) {
			return setHata('Krokiden en az bir bölüm seçin');
		}
		if (gorev.tur === 'kontrol' && seciliMaddeler.size === 0) {
			return setHata('En az bir madde işaretleyin');
		}
		/* Yazılıp "ekle" denmemiş son ürün de sayılsın: kullanıcı
		   yazdıktan sonra doğrudan kaydete basarsa kaybolmamalı. */
		const eksikler = [...eksikListesi];
		if (yeniEksik.trim()) eksikler.push(yeniEksik.trim());
		if (gorev.tur === 'eksik' && eksikler.length === 0) {
			return setHata('En az bir ürün ekleyin');
		}

		let tutar: number | undefined;
		/* Fiş sayısı şimdilik sorulmuyor. Kolon ve yönetici ekranındaki
		   alan duruyor; istenirse geri açılır. */
		const fisSayisi: number | null = null;
		if (gorev.tur === 'ciro') {
			const cozulen = paraCoz(deger);
			if (cozulen === null) return setHata('Ciro tutarını yazın');
			if (cozulen < 0) return setHata('Ciro eksi olamaz');
			tutar = cozulen;

		}

		basla(async () => {
			const sonuc = await kayitEkle({
				gorevId: gorev.id,
				tarih,
				bolgeIdler: [...seciliBolgeler],
				maddeIdler: [...seciliMaddeler],
				metin: gorev.tur === 'metin' ? deger : undefined,
				sayi,
				eksikler,
				tutar,
				fisSayisi,
			});
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setAcik(false);
			setDeger('');
			setSeciliBolgeler(new Set());
			setSeciliMaddeler(new Set());
			setEksikListesi([]);
			setYeniEksik('');
		});
	}

	function atla() {
		setHata(null);
		if (!sebep.trim()) return setHata('Neden yapılamadığını yazın');
		basla(async () => {
			const sonuc = await atlamaEkle(gorev.id, tarih, sebep);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setAcik(false);
			setSebep('');
		});
	}

	function sil(kayitId: string) {
		basla(async () => {
			const sonuc = await kayitSil(kayitId);
			if (!sonuc.tamam) setHata(sonuc.mesaj);
		});
	}

	const bolgeAdi = new Map(bolgeler.map((b) => [b.id, b.ad]));
	const ustuCizili = kapandi && !yenidenYapilabilir;

	return (
		<li className="border-b border-kenarlik-2 py-4">
			<div className="flex items-start gap-3">
				{yonetici && (
					<input
						type="checkbox"
						checked={secili}
						onChange={isaretle}
						className="onay mt-1 shrink-0"
						aria-label={`${gorev.baslik} — seç`}
					/>
				)}

				<div className="min-w-0 flex-1">
					<p className={ustuCizili ? 'text-metin-2 line-through' : 'font-medium'}>
						{gorev.baslik}
						{gorev.zorunlu && !kapandi && (
							<span className="ml-2 text-vurgu-metin" title="Zorunlu">
								*
							</span>
						)}
					</p>

					<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
						<span>{gorev.atanan ? gorev.atanan.ad : 'atanmadı'}</span>

						{yapilanlar.length > 0 && (
							<span className="text-basarili">
								{yenidenYapilabilir
									? `${yapilanlar.length} kez`
									: 'yapıldı'}{' '}
								· son {saatiBicimle(yapilanlar[0].zaman)}
							</span>
						)}
						{atlananlar.length > 0 && (
							<span className="text-uyari">atlandı</span>
						)}

						{kayitlar.length > 0 && (
							<button
								type="button"
								onClick={() => setDetay((d) => !d)}
								aria-expanded={detay}
								className="underline underline-offset-2 hover:text-metin"
							>
								{detay ? 'gizle' : 'ayrıntı'}
							</button>
						)}
					</div>

					{/* Kayıt defteri: ne zaman, kim, nerede */}
					{detay && kayitlar.length > 0 && (
						<ul className="mt-2 space-y-1">
							{kayitlar.slice(0, 8).map((kayit) => (
								<li
									key={kayit.id}
									className="flex items-baseline gap-2 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3"
								>
									<span
										className={
											kayit.durum === 'atlandi' ? 'text-uyari' : undefined
										}
									>
										{saatiBicimle(kayit.zaman)}
										{kayit.bolge_idler.length > 0 &&
											` · ${kayit.bolge_idler.map((b) => bolgeAdi.get(b) ?? '?').join(', ')}`}
										{kayit.madde_idler.length > 0 &&
											` · ${kayit.madde_idler.length} madde`}
										{kayit.deger_metin && ` · ${kayit.deger_metin}`}
										{kayit.deger_sayi !== null &&
											` · ${
												gorev.tur === 'ciro'
													? paraBicimle(kayit.deger_sayi)
													: kayit.deger_sayi
											}`}
										{kayit.durum === 'atlandi' && ` · ${kayit.not_metni}`}
										{kayit.yapan && ` · ${kayit.yapan.ad}`}
									</span>
									{yonetici && (
										<button
											type="button"
											onClick={() => sil(kayit.id)}
											disabled={bekliyor}
											className="text-metin-3 underline underline-offset-2 hover:text-hata"
											aria-label="Kaydı sil"
										>
											sil
										</button>
									)}
								</li>
							))}
							{kayitlar.length > 8 && (
								<li className="font-mono text-[0.6875rem] text-metin-3">
									… ve {kayitlar.length - 8} kayıt daha
								</li>
							)}
						</ul>
					)}
				</div>

				{kaydedebilir && !acik && (
					<button
						type="button"
						onClick={() => setAcik(true)}
						className="dugme dugme-bos shrink-0 !px-3 !py-1.5"
					>
						{yapilanlar.length > 0 ? 'Tekrar yap' : 'Kapat'}
					</button>
				)}
			</div>

			{acik && (
				<div className="mt-4 border border-kenarlik bg-zemin-2 p-4">
					{gorev.ipucu && (
						<p className="mb-3 text-sm text-metin-2">{gorev.ipucu}</p>
					)}

					{gorev.tur === 'bolge' && (
						<fieldset>
							<legend className="etiket">
								Nereleri yaptınız
								{seciliBolgeler.size > 0 && ` · ${seciliBolgeler.size} seçili`}
							</legend>
							<p className="mt-1 mb-3 text-sm text-metin-2">
								Krokiden yaptığınız bölümlere dokunun. Birden çok seçebilirsiniz.
							</p>
							<KrokiSecici
								bolgeler={bolgeler}
								secili={seciliBolgeler}
								kapali={bekliyor}
								degistir={(id) =>
									setSeciliBolgeler((e) => {
										const y = new Set(e);
										if (y.has(id)) y.delete(id);
										else y.add(id);
										return y;
									})
								}
							/>
						</fieldset>
					)}

					{gorev.tur === 'kontrol' && maddeler.length > 0 && (
						<fieldset>
							<legend className="etiket">
								Maddeler · {seciliMaddeler.size} / {maddeler.length}
							</legend>
							<ul className="mt-2 space-y-2">
								{maddeler.map((madde) => (
									<li key={madde.id}>
										<label className="flex cursor-pointer items-start gap-3">
											<input
												type="checkbox"
												checked={seciliMaddeler.has(madde.id)}
												onChange={() =>
													setSeciliMaddeler((e) => {
														const y = new Set(e);
														if (y.has(madde.id)) y.delete(madde.id);
														else y.add(madde.id);
														return y;
													})
												}
												className="onay mt-0.5 shrink-0"
											/>
											<span className="text-sm text-metin-2">{madde.metin}</span>
										</label>
									</li>
								))}
							</ul>
						</fieldset>
					)}

					{gorev.tur === 'eksik' && (
						<fieldset>
							<legend className="etiket">
								{gorev.eksik_kategori
									? KATEGORI_ADLARI[gorev.eksik_kategori]
									: 'Eksikler'}
								{eksikListesi.length > 0 && ` · ${eksikListesi.length} ürün`}
							</legend>
							<p className="mt-1 mb-3 text-sm text-metin-2">
								Her ürünü ayrı ayrı ekleyin. Böylece listede tek tek
								işaretlenebilirler.
							</p>

							{eksikListesi.length > 0 && (
								<ul className="mb-3 space-y-2">
									{eksikListesi.map((urun, i) => (
										<li key={i} className="flex items-center gap-2">
											<span className="flex-1 border border-kenarlik bg-zemin px-3 py-2 text-sm">
												{urun}
											</span>
											<button
												type="button"
												onClick={() =>
													setEksikListesi((e) => e.filter((_, j) => j !== i))
												}
												className="shrink-0 border border-kenarlik px-3 py-2 font-mono text-sm text-metin-3 hover:border-hata hover:text-hata"
												aria-label={`${urun} — listeden çıkar`}
											>
												×
											</button>
										</li>
									))}
								</ul>
							)}

							<div className="flex gap-2">
								<input
									type="text"
									value={yeniEksik}
									onChange={(e) => setYeniEksik(e.target.value)}
									onKeyDown={(e) => {
										/* Enter yeni ürün ekler; formu göndermez.
										   Art arda ürün yazmak yaygın, her seferinde
										   fareye gitmek yorucu olurdu. */
										if (e.key === 'Enter') {
											e.preventDefault();
											if (!yeniEksik.trim()) return;
											setEksikListesi((l) => [...l, yeniEksik.trim()]);
											setYeniEksik('');
										}
									}}
									placeholder="Ürün adı"
									className="alan"
									autoFocus
								/>
								<button
									type="button"
									onClick={() => {
										if (!yeniEksik.trim()) return;
										setEksikListesi((l) => [...l, yeniEksik.trim()]);
										setYeniEksik('');
									}}
									disabled={!yeniEksik.trim()}
									className="dugme dugme-bos shrink-0"
								>
									Ekle
								</button>
							</div>
						</fieldset>
					)}

					{gorev.tur === 'ciro' && (
						<fieldset>
							<legend className="etiket">Gün sonu cirosu</legend>

							<label className="mt-2 block">
								<input
									type="text"
									inputMode="decimal"
									value={deger}
									onChange={(e) => setDeger(e.target.value)}
									placeholder="12.500"
									className="alan text-lg"
									autoFocus
									aria-label="Ciro tutarı"
								/>
							</label>

							{/* Yazılan rakam okunur hâlde geri gösteriliyor: bir
							    hane fazla yazmak (125.000) en sık yapılan hata ve
							    kaydetmeden önce buradan yakalanıyor. */}
							<p
								className="mt-2 font-mono text-sm text-metin-2"
								aria-live="polite"
							>
								{deger.trim() === ''
									? 'Kasa raporundaki toplamı yazın.'
									: paraCoz(deger) === null
										? 'Bu bir tutar gibi görünmüyor.'
										: paraBicimle(paraCoz(deger)!, true)}
							</p>

						</fieldset>
					)}

					{(gorev.tur === 'metin' || gorev.tur === 'sayi') && (
						<label className="block">
							<span className="etiket">
								{gorev.tur === 'sayi' ? 'Sayı' : 'Açıklama'}
							</span>
							<input
								type="text"
								inputMode={gorev.tur === 'sayi' ? 'decimal' : 'text'}
								value={deger}
								onChange={(e) => setDeger(e.target.value)}
								className="alan mt-2"
								autoFocus
							/>
						</label>
					)}

					<label className="mt-4 block">
						<span className="etiket">Yapılamadıysa sebebi</span>
						<input
							type="text"
							value={sebep}
							onChange={(e) => setSebep(e.target.value)}
							placeholder="Boş bırakırsan görev yapıldı sayılır"
							className="alan mt-2"
						/>
					</label>

					{hata && (
						<p role="alert" className="mt-3 text-sm text-hata">
							{hata}
						</p>
					)}

					<div className="mt-4 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={sebep.trim() ? atla : kaydet}
							disabled={bekliyor}
							className="dugme dugme-dolu"
						>
							{bekliyor
								? 'Kaydediliyor…'
								: sebep.trim()
									? 'Atlandı olarak kaydet'
									: 'Yapıldı olarak kaydet'}
						</button>
						<button
							type="button"
							onClick={() => {
								setAcik(false);
								setHata(null);
							}}
							disabled={bekliyor}
							className="dugme dugme-bos"
						>
							Vazgeç
						</button>
					</div>
				</div>
			)}
		</li>
	);
}
