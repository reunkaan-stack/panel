'use client';

import { useState, useTransition } from 'react';
import type { Bolge, GorevSatiri } from '@/lib/tipler';
import {
	gorevAtla,
	gorevTamamla,
	maddeIsaretle,
	type GorevDegeri,
} from '../eylemler';

/* Tek görev satırı.

   Dört davranış bir arada:
   - Tekrarlanabilir görev kapatılınca listeden düşmez; her yapılış
     ayrı kayıt olur ("sabah ön masa, akşam arka masa").
   - Bölge seçmeli görevde nereyi yaptığı listeden seçilir.
   - Kontrol listesinde maddeler tek tek işaretlenir.
   - Diğerlerinde tek işaret, metin ya da sayı. */

export function GorevSatir({
	gorev,
	yonetici,
	benim,
	secili,
	isaretle,
	saatiBicimle,
	bolgeler,
}: {
	gorev: GorevSatiri;
	yonetici: boolean;
	benim: boolean;
	secili: boolean;
	isaretle: () => void;
	saatiBicimle: (an: string) => string;
	bolgeler: Bolge[];
}) {
	const [acik, setAcik] = useState(false);
	const [deger, setDeger] = useState('');
	const [bolgeId, setBolgeId] = useState('');
	const [sebep, setSebep] = useState('');
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	const yapildi = gorev.durum !== 'bekliyor';
	const tekrar = gorev.tekrarlanabilir;

	/* Tekrarlanabilir görev kapansa da yeniden yapılabilir. */
	const kapatabilir =
		(tekrar || !yapildi) && (yonetici || benim || !gorev.atanan_id);

	const maddeler = [...(gorev.maddeler ?? [])].sort((a, b) => a.sira - b.sira);
	const kayitlar = [...(gorev.kayitlar ?? [])].sort((a, b) =>
		b.zaman.localeCompare(a.zaman)
	);
	const isaretliSayisi = maddeler.filter((m) => m.isaretli).length;

	function tamamla() {
		setHata(null);
		const d: GorevDegeri = {};

		if (gorev.tur === 'metin') {
			if (!deger.trim()) return setHata('Bir şey yazmanız gerekiyor');
			d.metin = deger;
		} else if (gorev.tur === 'sayi') {
			const s = Number(deger.replace(',', '.'));
			if (!Number.isFinite(s)) return setHata('Geçerli bir sayı girin');
			d.sayi = s;
		} else if (gorev.tur === 'bolge') {
			if (!bolgeId) return setHata('Hangi bölümde yaptığınızı seçin');
			d.bolgeId = bolgeId;
		} else if (gorev.tur === 'kontrol') {
			if (isaretliSayisi === 0) return setHata('En az bir madde işaretleyin');
			d.onay = true;
		} else {
			d.onay = true;
		}

		basla(async () => {
			const sonuc = await gorevTamamla(gorev.id, gorev.tur, d);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setAcik(false);
			setDeger('');
			setBolgeId('');
		});
	}

	function atla() {
		setHata(null);
		if (!sebep.trim()) return setHata('Neden yapılamadığını yazın');
		basla(async () => {
			const sonuc = await gorevAtla(gorev.id, sebep);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setAcik(false);
		});
	}

	function maddeDegistir(maddeId: string, yeni: boolean) {
		basla(async () => {
			const sonuc = await maddeIsaretle(maddeId, yeni);
			if (!sonuc.tamam) setHata(sonuc.mesaj);
		});
	}

	const durumRengi =
		gorev.durum === 'tamamlandi'
			? 'text-basarili'
			: gorev.durum === 'atlandi'
				? 'text-uyari'
				: 'text-metin-3';

	/* Tekrarlanabilir görevde üstü çizilmez: iş bitmiş sayılmaz,
	   yalnızca "şu ana kadar şu kadar kez yapıldı" bilgisi var. */
	const ustuCizili = yapildi && !tekrar;

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
						{gorev.zorunlu && !yapildi && (
							<span className="ml-2 text-vurgu-metin" title="Zorunlu">
								*
							</span>
						)}
					</p>

					<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
						<span>{gorev.atanan ? gorev.atanan.ad : 'atanmadı'}</span>

						{tekrar && (
							<span className={kayitlar.length > 0 ? 'text-basarili' : ''}>
								{kayitlar.length} kez yapıldı
								{kayitlar[0] && ` · son ${saatiBicimle(kayitlar[0].zaman)}`}
							</span>
						)}

						{!tekrar && gorev.tamamlanma_zamani && (
							<span className={durumRengi}>
								{gorev.durum === 'atlandi' ? 'atlandı' : 'yapıldı'}{' '}
								{saatiBicimle(gorev.tamamlanma_zamani)}
								{gorev.tamamlayan && ` · ${gorev.tamamlayan.ad}`}
							</span>
						)}

						{gorev.tur === 'kontrol' && maddeler.length > 0 && (
							<span>
								{isaretliSayisi} / {maddeler.length} madde
							</span>
						)}
					</div>

					{/* Kontrol listesi her zaman görünür: asıl iş burada */}
					{gorev.tur === 'kontrol' && maddeler.length > 0 && (
						<ul className="mt-3 space-y-2 border-l border-kenarlik pl-4">
							{maddeler.map((madde) => (
								<li key={madde.id}>
									<label className="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											checked={madde.isaretli}
											onChange={(e) => maddeDegistir(madde.id, e.target.checked)}
											disabled={bekliyor || !kapatabilir}
											className="onay mt-0.5 shrink-0"
										/>
										<span
											className={`text-sm ${madde.isaretli ? 'text-metin-3 line-through' : 'text-metin-2'}`}
										>
											{madde.metin}
										</span>
									</label>
								</li>
							))}
						</ul>
					)}

					{/* Tekrarlanabilir görevin geçmişi: nerede, ne zaman, kim */}
					{tekrar && kayitlar.length > 0 && (
						<ul className="mt-2 space-y-1">
							{kayitlar.slice(0, 6).map((kayit) => (
								<li
									key={kayit.id}
									className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3"
								>
									{saatiBicimle(kayit.zaman)}
									{kayit.bolge && ` · ${kayit.bolge.ad}`}
									{kayit.deger_metin && ` · ${kayit.deger_metin}`}
									{kayit.deger_sayi !== null && ` · ${kayit.deger_sayi}`}
									{kayit.yapan && ` · ${kayit.yapan.ad}`}
								</li>
							))}
							{kayitlar.length > 6 && (
								<li className="font-mono text-[0.6875rem] text-metin-3">
									… ve {kayitlar.length - 6} kayıt daha
								</li>
							)}
						</ul>
					)}

					{gorev.durum === 'atlandi' && gorev.atlama_sebebi && (
						<p className="mt-1.5 text-sm text-uyari">
							Sebep: {gorev.atlama_sebebi}
						</p>
					)}
					{!tekrar && gorev.durum === 'tamamlandi' && gorev.bolge && (
						<p className="mt-1.5 text-sm text-metin-2">{gorev.bolge.ad}</p>
					)}
					{!tekrar && gorev.durum === 'tamamlandi' && gorev.deger_metin && (
						<p className="mt-1.5 text-sm text-metin-2">{gorev.deger_metin}</p>
					)}
					{!tekrar && gorev.durum === 'tamamlandi' && gorev.deger_sayi !== null && (
						<p className="mt-1.5 font-mono text-sm text-metin-2">
							{gorev.deger_sayi}
						</p>
					)}
				</div>

				{kapatabilir && !acik && (
					<button
						type="button"
						onClick={() => setAcik(true)}
						className="dugme dugme-bos shrink-0 !px-3 !py-1.5"
					>
						{tekrar && kayitlar.length > 0 ? 'Tekrar yap' : 'Kapat'}
					</button>
				)}
			</div>

			{acik && (
				<div className="mt-4 border border-kenarlik bg-zemin-2 p-4">
					{gorev.ipucu && (
						<p className="mb-3 text-sm text-metin-2">{gorev.ipucu}</p>
					)}

					{gorev.tur === 'bolge' && (
						<label className="block">
							<span className="etiket">Hangi bölüm</span>
							<select
								value={bolgeId}
								onChange={(e) => setBolgeId(e.target.value)}
								className="alan mt-2"
								autoFocus
							>
								<option value="">Seçin…</option>
								{bolgeler.map((b) => (
									<option key={b.id} value={b.id}>
										{b.ad}
									</option>
								))}
							</select>
						</label>
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

					{gorev.tur === 'kontrol' && (
						<p className="text-sm text-metin-2">
							Yukarıdaki maddeleri işaretleyin, sonra kaydedin.
							{isaretliSayisi < maddeler.length &&
								` (${maddeler.length - isaretliSayisi} madde işaretsiz)`}
						</p>
					)}

					{!yapildi && (
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
					)}

					{hata && (
						<p role="alert" className="mt-3 text-sm text-hata">
							{hata}
						</p>
					)}

					<div className="mt-4 flex flex-wrap gap-3">
						<button
							type="button"
							onClick={sebep.trim() ? atla : tamamla}
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
