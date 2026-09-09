'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { kisaTarih } from '@/lib/ortak/tarih';
import type { Modul } from '@/lib/tipler';
import { firmaEkle, firmaGuncelle, modulleriKaydet } from '../eylemler';

/* Firma yönetimi.

   Modüller kutucukla açılıp kapanıyor. Kapatılan modül silinmiyor,
   pasife alınıyor: firma sonradan yeniden alırsa geçmiş ayarları
   yerinde kalsın. */

export type FirmaSatiri = {
	id: string;
	ad: string;
	kisa_ad: string;
	aktif: boolean;
	moduller: Modul[];
	kullanici: number;
	aktifKullanici: number;
	sonGiris: string | null;
};

const MODULLER: { kod: Modul; ad: string }[] = [
	{ kod: 'ptp', ad: 'Personel Takip' },
	{ kod: 'otp', ad: 'Ödeme Takip' },
	{ kod: 'ttp', ad: 'Tahsilat Takip' },
	{ kod: 'mtp', ad: 'Mağaza Takip' },
];

export function FirmaYonetimi({ firmalar }: { firmalar: FirmaSatiri[] }) {
	const [ekleAcik, setEkleAcik] = useState(false);

	const aktifler = firmalar.filter((f) => f.aktif);
	const pasifler = firmalar.filter((f) => !f.aktif);

	return (
		<>
			{ekleAcik ? (
				<EkleFormu kapat={() => setEkleAcik(false)} />
			) : (
				<button
					type="button"
					onClick={() => setEkleAcik(true)}
					className="dugme dugme-dolu"
				>
					Firma ekle
				</button>
			)}

			<div className="mt-8">
				<span className="etiket">Aktif · {aktifler.length}</span>
				<ul className="mt-3 border-t border-kenarlik">
					{aktifler.map((f) => (
						<FirmaSatir key={f.id} firma={f} />
					))}
				</ul>
			</div>

			{pasifler.length > 0 && (
				<div className="mt-10">
					<span className="etiket text-metin-3">Pasif · {pasifler.length}</span>
					<ul className="mt-3 border-t border-kenarlik">
						{pasifler.map((f) => (
							<FirmaSatir key={f.id} firma={f} />
						))}
					</ul>
				</div>
			)}
		</>
	);
}

function EkleFormu({ kapat }: { kapat: () => void }) {
	const router = useRouter();
	const [ad, setAd] = useState('');
	const [kisaAd, setKisaAd] = useState('');
	const [secili, setSecili] = useState<Modul[]>(['otp']);
	const [hata, setHata] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<div className="border border-kenarlik p-4">
			<span className="etiket text-vurgu-metin">Yeni firma</span>

			<div className="mt-4 grid gap-4 sm:grid-cols-2">
				<label className="block">
					<span className="etiket">Firma adı</span>
					<input
						type="text"
						value={ad}
						onChange={(e) => setAd(e.target.value)}
						placeholder="Örnek: Doğan Ticaret Ltd. Şti."
						className="alan mt-2"
						autoFocus
					/>
				</label>
				<label className="block">
					<span className="etiket">Kısa ad</span>
					<input
						type="text"
						value={kisaAd}
						onChange={(e) => setKisaAd(e.target.value)}
						placeholder="dogan"
						className="alan mt-2 font-mono"
					/>
					<span className="mt-1.5 block text-sm text-metin-3">
						Kod içinde kullanılır: küçük harf, Türkçe karakter ve boşluk yok.
						Boş bırakırsanız firma adından üretilir.
					</span>
				</label>
			</div>

			<div className="mt-5">
				<span className="etiket">Hangi modülleri alacak</span>
				<div className="mt-2 flex flex-wrap gap-4">
					{MODULLER.map((m) => (
						<label key={m.kod} className="flex cursor-pointer items-center gap-2">
							<input
								type="checkbox"
								checked={secili.includes(m.kod)}
								onChange={(e) =>
									setSecili((s) =>
										e.target.checked
											? [...s, m.kod]
											: s.filter((x) => x !== m.kod)
									)
								}
								className="onay shrink-0"
							/>
							<span className="text-sm">{m.ad}</span>
						</label>
					))}
				</div>
			</div>

			{hata && (
				<p role="alert" className="mt-4 text-sm text-hata">
					{hata}
				</p>
			)}

			<div className="mt-5 flex flex-wrap gap-3">
				<button
					type="button"
					disabled={bekliyor}
					onClick={() =>
						basla(async () => {
							setHata(null);
							const s = await firmaEkle(ad, kisaAd, secili);
							if (!s.tamam) return setHata(s.mesaj);
							kapat();
							router.refresh();
						})
					}
					className="dugme dugme-dolu"
				>
					{bekliyor ? 'Ekleniyor…' : 'Firmayı ekle'}
				</button>
				<button
					type="button"
					onClick={kapat}
					disabled={bekliyor}
					className="dugme dugme-bos"
				>
					Vazgeç
				</button>
			</div>

			<p className="mt-4 text-sm leading-relaxed text-metin-3">
				Firma eklendikten sonra <strong>Kişiler</strong> ekranından kullanıcı
				açıp bu firmaya bağlarsınız. Kullanıcı girdiğinde yalnızca bu firmanın
				verisini görür.
			</p>
		</div>
	);
}

function FirmaSatir({ firma }: { firma: FirmaSatiri }) {
	const router = useRouter();
	const [acik, setAcik] = useState(false);
	const [ad, setAd] = useState(firma.ad);
	const [aktif, setAktif] = useState(firma.aktif);
	const [moduller, setModuller] = useState<Modul[]>(firma.moduller);
	const [durum, setDurum] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<li className="border-b border-kenarlik-2 py-4">
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<span className={`font-medium ${firma.aktif ? '' : 'text-metin-3'}`}>
					{firma.ad}
				</span>
				<span className="font-mono text-[0.6875rem] tracking-[0.08em] text-metin-3">
					{firma.kisa_ad}
				</span>

				<span className="min-w-0 flex-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
					{firma.moduller.length > 0
						? firma.moduller.join(' · ')
						: 'modül yok'}
				</span>

				<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
					{firma.aktifKullanici} kişi
					{firma.sonGiris
						? ` · son giriş ${kisaTarih(firma.sonGiris)}`
						: ' · hiç giriş yok'}
				</span>

				{!acik && (
					<button
						type="button"
						onClick={() => setAcik(true)}
						className="shrink-0 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-metin"
					>
						Düzenle
					</button>
				)}
			</div>

			{acik && (
				<div className="mt-4 border border-kenarlik bg-zemin-2 p-4">
					<label className="block">
						<span className="etiket">Firma adı</span>
						<input
							type="text"
							value={ad}
							onChange={(e) => setAd(e.target.value)}
							className="alan mt-2"
						/>
					</label>

					<div className="mt-5">
						<span className="etiket">Modüller</span>
						<div className="mt-2 flex flex-wrap gap-4">
							{MODULLER.map((m) => (
								<label
									key={m.kod}
									className="flex cursor-pointer items-center gap-2"
								>
									<input
										type="checkbox"
										checked={moduller.includes(m.kod)}
										onChange={(e) =>
											setModuller((s) =>
												e.target.checked
													? [...s, m.kod]
													: s.filter((x) => x !== m.kod)
											)
										}
										className="onay shrink-0"
									/>
									<span className="text-sm">{m.ad}</span>
								</label>
							))}
						</div>
						<p className="mt-2 text-sm text-metin-3">
							Kapatılan modül silinmiyor, pasife alınıyor. Firma sonradan
							yeniden alırsa yetkiler ve ayarlar yerinde kalır.
						</p>
					</div>

					<label className="mt-5 flex cursor-pointer items-start gap-3">
						<input
							type="checkbox"
							checked={aktif}
							onChange={(e) => setAktif(e.target.checked)}
							className="onay mt-0.5 shrink-0"
						/>
						<span className="text-sm">
							<strong>Firma aktif</strong>
							<span className="block text-metin-2">
								Pasife alınırsa kullanıcıları panele giremez, verisi durur.
							</span>
						</span>
					</label>

					{durum && (
						<p
							role="status"
							className={`mt-4 text-sm ${durum === 'Kaydedildi' ? 'text-basarili' : 'text-hata'}`}
						>
							{durum}
						</p>
					)}

					<div className="mt-5 flex flex-wrap gap-3">
						<button
							type="button"
							disabled={bekliyor}
							onClick={() =>
								basla(async () => {
									setDurum(null);
									const a = await firmaGuncelle(firma.id, ad, aktif);
									if (!a.tamam) return setDurum(a.mesaj);
									const b = await modulleriKaydet(firma.id, moduller);
									if (!b.tamam) return setDurum(b.mesaj);
									setDurum('Kaydedildi');
									setAcik(false);
									router.refresh();
								})
							}
							className="dugme dugme-dolu"
						>
							{bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
						</button>
						<button
							type="button"
							onClick={() => setAcik(false)}
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
