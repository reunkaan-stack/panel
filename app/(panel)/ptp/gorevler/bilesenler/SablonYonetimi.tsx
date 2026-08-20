'use client';

import { useState, useTransition } from 'react';
import {
	GRUP_ADLARI,
	GUN_ADLARI,
	TEKRAR_ADLARI,
	TUR_ADLARI,
	type GorevGrubu,
	type GorevTuru,
	type Tekrar,
} from '@/lib/tipler';
import type { SablonSatiri } from '../page';
import { sablonAktiflik, sablonKaydet, sablonSil, type SablonGirdisi } from '../eylemler';

/* Görev şablonu yönetimi.

   Liste ve form aynı ekranda: yönetici genelde arka arkaya birkaç
   tanım düzenliyor, her seferinde sayfa değiştirmek yorucu olurdu. */

const BOS: SablonGirdisi = {
	baslik: '',
	tur: 'onay',
	grup: 'acilis',
	zorunlu: true,
	tekrarlanabilir: false,
	fotograf_ister: false,
	ipucu: '',
	tekrar: 'gunluk',
	tekrar_gunleri: [],
	tek_tarih: null,
	sira: 0,
	maddeler: [''],
};

export function SablonYonetimi({ sablonlar }: { sablonlar: SablonSatiri[] }) {
	const [form, setForm] = useState<SablonGirdisi | null>(null);
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	function duzenle(s: SablonSatiri) {
		setHata(null);
		setForm({
			id: s.id,
			baslik: s.baslik,
			tur: s.tur,
			grup: s.grup,
			zorunlu: s.zorunlu,
			tekrarlanabilir: s.tekrarlanabilir,
			fotograf_ister: s.fotograf_ister,
			ipucu: s.ipucu,
			tekrar: s.tekrar,
			tekrar_gunleri: s.tekrar_gunleri ?? [],
			tek_tarih: s.tek_tarih,
			sira: s.sira,
			maddeler: s.maddeler.length
				? [...s.maddeler].sort((a, b) => a.sira - b.sira).map((m) => m.metin)
				: [''],
		});
	}

	function kaydet() {
		if (!form) return;
		setHata(null);
		basla(async () => {
			const sonuc = await sablonKaydet(form);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setForm(null);
		});
	}

	function aktiflikDegistir(s: SablonSatiri) {
		basla(async () => {
			const sonuc = await sablonAktiflik(s.id, !s.aktif);
			if (!sonuc.tamam) setHata(sonuc.mesaj);
		});
	}

	function sil(s: SablonSatiri) {
		if (!confirm(`"${s.baslik}" tanımını sil — geçmiş kayıtlar kalır, yeni gün üretilmez.`)) return;
		basla(async () => {
			const sonuc = await sablonSil(s.id);
			if (!sonuc.tamam) setHata(sonuc.mesaj);
		});
	}

	const gruplar = sablonlar.reduce<Record<string, SablonSatiri[]>>((t, s) => {
		(t[s.grup] ??= []).push(s);
		return t;
	}, {});

	return (
		<>
			{!form && (
				<button
					type="button"
					onClick={() => {
						setHata(null);
						setForm({ ...BOS, maddeler: [''] });
					}}
					className="dugme dugme-dolu"
				>
					Yeni görev tanımı
				</button>
			)}

			{hata && (
				<p role="alert" className="mt-4 border border-hata px-4 py-3 text-sm text-hata">
					{hata}
				</p>
			)}

			{form && (
				<SablonFormu
					form={form}
					setForm={setForm}
					kaydet={kaydet}
					vazgec={() => {
						setForm(null);
						setHata(null);
					}}
					bekliyor={bekliyor}
				/>
			)}

			{sablonlar.length === 0 && !form ? (
				<div className="kose-nisan mt-8 border border-kenarlik p-8 text-center">
					<span className="etiket">Tanım yok</span>
					<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
						Henüz görev tanımlanmadı. Yukarıdaki düğmeyle ilk görevi ekleyin.
					</p>
				</div>
			) : (
				Object.entries(gruplar).map(([grup, liste]) => (
					<section key={grup} className="mt-8">
						<span className="etiket">{GRUP_ADLARI[grup as GorevGrubu]}</span>
						<ul className="mt-3 border-t border-kenarlik">
							{liste.map((s) => (
								<li key={s.id} className="border-b border-kenarlik-2 py-4">
									<div className="flex items-start gap-3">
										<div className="min-w-0 flex-1">
											<p className={s.aktif ? 'font-medium' : 'text-metin-3 line-through'}>
												{s.baslik}
											</p>
											<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
												<span>{TUR_ADLARI[s.tur]}</span>
												<span>·</span>
												<span>
													{s.tekrar === 'haftalik'
														? (s.tekrar_gunleri ?? [])
																.map((g) => GUN_ADLARI[g])
																.join(' ')
														: s.tekrar === 'tek_seferlik'
															? s.tek_tarih
															: 'her gün'}
												</span>
												{s.zorunlu && <><span>·</span><span>zorunlu</span></>}
												{s.tekrarlanabilir && <><span>·</span><span>tekrarlanabilir</span></>}
												{s.fotograf_ister && <><span>·</span><span>fotoğraflı</span></>}
												{s.tur === 'kontrol' && (
													<><span>·</span><span>{s.maddeler.length} madde</span></>
												)}
											</div>
										</div>

										<div className="flex shrink-0 gap-2">
											<button
												type="button"
												onClick={() => duzenle(s)}
												className="dugme dugme-bos !px-3 !py-1.5"
											>
												Düzenle
											</button>
											<button
												type="button"
												onClick={() => aktiflikDegistir(s)}
												disabled={bekliyor}
												className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
											>
												{s.aktif ? 'Durdur' : 'Başlat'}
											</button>
											<button
												type="button"
												onClick={() => sil(s)}
												disabled={bekliyor}
												className="font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-hata"
											>
												Sil
											</button>
										</div>
									</div>
								</li>
							))}
						</ul>
					</section>
				))
			)}
		</>
	);
}

function SablonFormu({
	form,
	setForm,
	kaydet,
	vazgec,
	bekliyor,
}: {
	form: SablonGirdisi;
	setForm: (f: SablonGirdisi) => void;
	kaydet: () => void;
	vazgec: () => void;
	bekliyor: boolean;
}) {
	const guncelle = (parca: Partial<SablonGirdisi>) =>
		setForm({ ...form, ...parca });

	function gunDegistir(gun: number) {
		const v = form.tekrar_gunleri.includes(gun)
			? form.tekrar_gunleri.filter((g) => g !== gun)
			: [...form.tekrar_gunleri, gun].sort();
		guncelle({ tekrar_gunleri: v });
	}

	return (
		<div className="kose-nisan mt-6 border border-kenarlik bg-zemin-2 p-5">
			<span className="etiket text-vurgu-metin">
				{form.id ? 'Düzenle' : 'Yeni tanım'}
			</span>

			<label className="mt-4 block">
				<span className="etiket">Görev başlığı</span>
				<input
					type="text"
					value={form.baslik}
					onChange={(e) => guncelle({ baslik: e.target.value })}
					className="alan mt-2"
					autoFocus
				/>
			</label>

			<div className="mt-4 grid gap-4 sm:grid-cols-2">
				<label className="block">
					<span className="etiket">Ne yapılacak</span>
					<select
						value={form.tur}
						onChange={(e) => guncelle({ tur: e.target.value as GorevTuru })}
						className="alan mt-2"
					>
						{Object.entries(TUR_ADLARI).map(([k, v]) => (
							<option key={k} value={k}>{v}</option>
						))}
					</select>
				</label>

				<label className="block">
					<span className="etiket">Bölüm</span>
					<select
						value={form.grup}
						onChange={(e) => guncelle({ grup: e.target.value as GorevGrubu })}
						className="alan mt-2"
					>
						{Object.entries(GRUP_ADLARI).map(([k, v]) => (
							<option key={k} value={k}>{v}</option>
						))}
					</select>
				</label>
			</div>

			{form.tur === 'kontrol' && (
				<div className="mt-4">
					<span className="etiket">Kontrol listesi maddeleri</span>
					<ul className="mt-2 space-y-2">
						{form.maddeler.map((madde, i) => (
							<li key={i} className="flex gap-2">
								<input
									type="text"
									value={madde}
									onChange={(e) => {
										const y = [...form.maddeler];
										y[i] = e.target.value;
										guncelle({ maddeler: y });
									}}
									placeholder={`${i + 1}. madde`}
									className="alan"
								/>
								{form.maddeler.length > 1 && (
									<button
										type="button"
										onClick={() =>
											guncelle({ maddeler: form.maddeler.filter((_, j) => j !== i) })
										}
										className="shrink-0 border border-kenarlik px-3 font-mono text-sm text-metin-3 hover:border-hata hover:text-hata"
										aria-label={`${i + 1}. maddeyi sil`}
									>
										×
									</button>
								)}
							</li>
						))}
					</ul>
					<button
						type="button"
						onClick={() => guncelle({ maddeler: [...form.maddeler, ''] })}
						className="mt-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-vurgu-metin underline underline-offset-4"
					>
						+ Madde ekle
					</button>
				</div>
			)}

			<label className="mt-4 block">
				<span className="etiket">Ne sıklıkla</span>
				<select
					value={form.tekrar}
					onChange={(e) =>
						guncelle({
							tekrar: e.target.value as Tekrar,
							tekrar_gunleri: [],
							tek_tarih: null,
						})
					}
					className="alan mt-2"
				>
					{Object.entries(TEKRAR_ADLARI).map(([k, v]) => (
						<option key={k} value={k}>{v}</option>
					))}
				</select>
			</label>

			{form.tekrar === 'haftalik' && (
				<div className="mt-4">
					<span className="etiket">Hangi günler</span>
					<div className="mt-2 flex flex-wrap gap-2">
						{Object.entries(GUN_ADLARI).map(([k, v]) => {
							const gun = Number(k);
							const secili = form.tekrar_gunleri.includes(gun);
							return (
								<button
									key={k}
									type="button"
									onClick={() => gunDegistir(gun)}
									aria-pressed={secili}
									className={`border px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
										secili
											? 'border-vurgu-metin bg-vurgu-metin text-zemin'
											: 'border-kenarlik text-metin-3 hover:border-metin hover:text-metin'
									}`}
								>
									{v}
								</button>
							);
						})}
					</div>
				</div>
			)}

			{form.tekrar === 'tek_seferlik' && (
				<label className="mt-4 block">
					<span className="etiket">Hangi gün</span>
					<input
						type="date"
						value={form.tek_tarih ?? ''}
						onChange={(e) => guncelle({ tek_tarih: e.target.value || null })}
						className="alan mt-2"
					/>
				</label>
			)}

			<label className="mt-4 block">
				<span className="etiket">Açıklama (isteğe bağlı)</span>
				<input
					type="text"
					value={form.ipucu}
					onChange={(e) => guncelle({ ipucu: e.target.value })}
					placeholder="Personele görünecek kısa not"
					className="alan mt-2"
				/>
			</label>

			<div className="mt-4 flex flex-wrap gap-5">
				<label className="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						checked={form.zorunlu}
						onChange={(e) => guncelle({ zorunlu: e.target.checked })}
						className="onay shrink-0"
					/>
					<span className="text-sm text-metin-2">Zorunlu</span>
				</label>

				<label className="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						checked={form.tekrarlanabilir}
						onChange={(e) => guncelle({ tekrarlanabilir: e.target.checked })}
						className="onay shrink-0"
					/>
					<span className="text-sm text-metin-2">Gün içinde tekrarlanabilir</span>
				</label>

				<label className="flex cursor-pointer items-center gap-3">
					<input
						type="checkbox"
						checked={form.fotograf_ister}
						onChange={(e) => guncelle({ fotograf_ister: e.target.checked })}
						className="onay shrink-0"
					/>
					<span className="text-sm text-metin-2">Fotoğraf istensin</span>
				</label>
			</div>

			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={kaydet}
					disabled={bekliyor || !form.baslik.trim()}
					className="dugme dugme-dolu"
				>
					{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
				</button>
				<button
					type="button"
					onClick={vazgec}
					disabled={bekliyor}
					className="dugme dugme-bos"
				>
					Vazgeç
				</button>
			</div>
		</div>
	);
}
