'use client';

import { useState, useTransition } from 'react';
import { ayAdi, buAy } from '@/lib/ortak/tarih';
import { paraBicimle, paraCoz } from '@/lib/ortak/para';
import { ayinMaasi } from '@/lib/prim';
import type { Hedef, Maas, PrimKademesi } from '@/lib/tipler';
import {
	ayarKaydet,
	hedefKaydet,
	kademeKaydet,
	kademeSil,
	maasKaydet,
} from '../eylemler';

/* Prim ayarları — katlanmış duruyor.

   Bunlar ayda bir dokunulan alanlar; her açılışta ekranı doldurmaları
   için sebep yok. Asıl bakılan şey yukarıdaki durum tablosu. */

type Kisi = { id: string; ad: string };

export function PrimAyarlari({
	ay,
	hedef,
	varsayilanHedef,
	kdvOrani,
	kademeler,
	kisiler,
	maaslar,
}: {
	ay: string;
	hedef: Hedef | null;
	varsayilanHedef: number;
	kdvOrani: number;
	kademeler: PrimKademesi[];
	kisiler: Kisi[];
	maaslar: Maas[];
}) {
	const [acik, setAcik] = useState<string | null>(null);

	const bolumler = [
		{ ad: 'hedef', baslik: `${ayAdi(ay)} hedefi` },
		{ ad: 'maas', baslik: 'Maaşlar' },
		{ ad: 'kademe', baslik: 'Prim kademeleri' },
		{ ad: 'genel', baslik: 'KDV ve varsayılan hedef' },
	];

	return (
		<div className="border border-kenarlik">
			<div className="border-b border-kenarlik px-4 py-3">
				<span className="etiket">Ayarlar</span>
			</div>

			{bolumler.map((b) => (
				<section key={b.ad} className="border-b border-kenarlik-2 last:border-b-0">
					<button
						type="button"
						onClick={() => setAcik((a) => (a === b.ad ? null : b.ad))}
						aria-expanded={acik === b.ad}
						className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zemin-2"
					>
						<span className="text-sm font-medium">{b.baslik}</span>
						<span className="font-mono text-metin-3">
							{acik === b.ad ? '−' : '+'}
						</span>
					</button>

					{acik === b.ad && (
						<div className="border-t border-kenarlik-2 bg-zemin-2 p-4">
							{b.ad === 'hedef' && (
								<HedefFormu
									ay={ay}
									hedef={hedef}
									varsayilanHedef={varsayilanHedef}
								/>
							)}
							{b.ad === 'maas' && (
								<MaasFormu ay={ay} kisiler={kisiler} maaslar={maaslar} />
							)}
							{b.ad === 'kademe' && <KademeFormu kademeler={kademeler} />}
							{b.ad === 'genel' && (
								<GenelFormu
									kdvOrani={kdvOrani}
									varsayilanHedef={varsayilanHedef}
								/>
							)}
						</div>
					)}
				</section>
			))}
		</div>
	);
}

/* ---------- Ayın hedefi ---------- */

function HedefFormu({
	ay,
	hedef,
	varsayilanHedef,
}: {
	ay: string;
	hedef: Hedef | null;
	varsayilanHedef: number;
}) {
	const [tutar, setTutar] = useState(
		hedef ? String(hedef.hedef) : String(varsayilanHedef || '')
	);
	const [not, setNot] = useState(hedef?.not_metni ?? '');
	const [durum, setDurum] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<div>
			<p className="mb-3 text-sm text-metin-2">
				Bu aya özel hedef. Girilmezse varsayılan ({paraBicimle(varsayilanHedef)})
				kullanılır. Aralık ile şubat aynı olmadığı için ay ay ayarlanabiliyor.
			</p>

			<div className="flex flex-wrap gap-3">
				<label className="min-w-44 flex-1">
					<span className="etiket">Net hedef (KDV hariç)</span>
					<input
						type="text"
						inputMode="decimal"
						value={tutar}
						onChange={(e) => setTutar(e.target.value)}
						className="alan mt-2"
					/>
				</label>
				<label className="min-w-44 flex-1">
					<span className="etiket">Not</span>
					<input
						type="text"
						value={not}
						onChange={(e) => setNot(e.target.value)}
						placeholder="Sezon, kampanya…"
						className="alan mt-2"
					/>
				</label>
			</div>

			<p className="mt-2 font-mono text-sm text-metin-2">
				{paraCoz(tutar) === null
					? 'Rakamı okuyamadım.'
					: `brüt karşılığı ${paraBicimle(paraCoz(tutar)! * 1.2)}`}
			</p>

			<Kaydet
				bekliyor={bekliyor}
				durum={durum}
				calistir={() =>
					basla(async () => {
						const s = await hedefKaydet(ay, tutar, not);
						setDurum(s.tamam ? 'Kaydedildi' : s.mesaj);
					})
				}
			/>
		</div>
	);
}

/* ---------- Maaşlar ---------- */

function MaasFormu({
	ay,
	kisiler,
	maaslar,
}: {
	ay: string;
	kisiler: Kisi[];
	maaslar: Maas[];
}) {
	return (
		<div>
			<p className="mb-3 text-sm text-metin-2">
				Zam geldiğinde <strong>yeni ay</strong> seçilip yazılır; eski satır
				silinmez. Böylece geçmiş ayların primi o ayın maaşıyla hesaplanmaya
				devam eder.
			</p>

			<ul className="space-y-4">
				{kisiler.map((kisi) => (
					<MaasSatir
						key={kisi.id}
						kisi={kisi}
						ay={ay}
						mevcut={ayinMaasi(
							maaslar.filter((m) => m.kullanici_id === kisi.id),
							ay
						)}
					/>
				))}
			</ul>
		</div>
	);
}

function MaasSatir({
	kisi,
	ay,
	mevcut,
}: {
	kisi: Kisi;
	ay: string;
	mevcut: number;
}) {
	const [tutar, setTutar] = useState(mevcut ? String(mevcut) : '');
	const [gecerli, setGecerli] = useState(ay);
	const [durum, setDurum] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	/* Seçilebilecek aylar: bu aydan altı ay öncesi ile altı ay sonrası.
	   Zam çoğunlukla gelecek bir aya yazılıyor. */
	const aylar = Array.from({ length: 13 }, (_, i) => {
		const t = Number(buAy().slice(0, 4)) * 12 + Number(buAy().slice(5)) - 1 + (i - 6);
		return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
	});

	return (
		<li className="border-b border-kenarlik-2 pb-4 last:border-b-0 last:pb-0">
			<div className="flex flex-wrap items-end gap-3">
				<span className="min-w-24 pb-2.5 font-medium">{kisi.ad}</span>

				<label className="min-w-32 flex-1">
					<span className="etiket">Maaş</span>
					<input
						type="text"
						inputMode="decimal"
						value={tutar}
						onChange={(e) => setTutar(e.target.value)}
						className="alan mt-2"
					/>
				</label>

				<label className="min-w-36">
					<span className="etiket">Geçerli olduğu ay</span>
					<select
						value={gecerli}
						onChange={(e) => setGecerli(e.target.value)}
						className="alan mt-2"
					>
						{aylar.map((a) => (
							<option key={a} value={a}>
								{ayAdi(a)}
							</option>
						))}
					</select>
				</label>
			</div>

			<Kaydet
				bekliyor={bekliyor}
				durum={durum}
				calistir={() =>
					basla(async () => {
						const s = await maasKaydet(kisi.id, gecerli, tutar);
						setDurum(s.tamam ? 'Kaydedildi' : s.mesaj);
					})
				}
			/>
		</li>
	);
}

/* ---------- Kademeler ---------- */

function KademeFormu({ kademeler }: { kademeler: PrimKademesi[] }) {
	const [yeniOran, setYeniOran] = useState('');
	const [yeniTur, setYeniTur] = useState<'sabit' | 'maas_kati'>('sabit');
	const [yeniDeger, setYeniDeger] = useState('');
	const [durum, setDurum] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<div>
			<p className="mb-3 text-sm text-metin-2">
				<strong>Sabit</strong> kademe herkeste aynı tutarı öder.{' '}
				<strong>Maaş katı</strong> kişinin o ayki maaşıyla çarpılır — zam
				geldiğinde prim de kendiliğinden yükselir.
			</p>

			<ul className="space-y-3">
				{[...kademeler]
					.sort((a, b) => a.oran - b.oran)
					.map((k) => (
						<KademeSatir key={k.id} kademe={k} />
					))}
			</ul>

			<div className="mt-5 border-t border-kenarlik-2 pt-4">
				<span className="etiket">Kademe ekle</span>
				<div className="mt-2 flex flex-wrap gap-3">
					<label className="w-24">
						<input
							type="text"
							inputMode="numeric"
							value={yeniOran}
							onChange={(e) => setYeniOran(e.target.value)}
							placeholder="%85"
							className="alan"
							aria-label="Oran"
						/>
					</label>
					<select
						value={yeniTur}
						onChange={(e) =>
							setYeniTur(e.target.value as 'sabit' | 'maas_kati')
						}
						className="alan w-36"
						aria-label="Tür"
					>
						<option value="sabit">Sabit tutar</option>
						<option value="maas_kati">Maaş katı</option>
					</select>
					<label className="min-w-32 flex-1">
						<input
							type="text"
							inputMode="decimal"
							value={yeniDeger}
							onChange={(e) => setYeniDeger(e.target.value)}
							placeholder={yeniTur === 'sabit' ? '25.000' : '1,25'}
							className="alan"
							aria-label="Değer"
						/>
					</label>
				</div>

				<Kaydet
					bekliyor={bekliyor}
					durum={durum}
					etiket="Ekle"
					calistir={() =>
						basla(async () => {
							const s = await kademeKaydet({
								oran: Number(yeniOran.replace(/\D/g, '')),
								tur: yeniTur,
								deger: yeniDeger,
							});
							setDurum(s.tamam ? 'Eklendi' : s.mesaj);
							if (s.tamam) {
								setYeniOran('');
								setYeniDeger('');
							}
						})
					}
				/>
			</div>
		</div>
	);
}

function KademeSatir({ kademe }: { kademe: PrimKademesi }) {
	const [deger, setDeger] = useState(
		kademe.tur === 'sabit' ? String(kademe.tutar ?? '') : String(kademe.kat ?? '')
	);
	const [tur, setTur] = useState(kademe.tur);
	const [durum, setDurum] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<li className="flex flex-wrap items-center gap-2">
			<span className="w-14 font-mono text-sm tracking-[0.04em]">
				%{kademe.oran}
			</span>

			<select
				value={tur}
				onChange={(e) => setTur(e.target.value as 'sabit' | 'maas_kati')}
				className="alan w-36"
				aria-label={`%${kademe.oran} türü`}
			>
				<option value="sabit">Sabit tutar</option>
				<option value="maas_kati">Maaş katı</option>
			</select>

			<input
				type="text"
				inputMode="decimal"
				value={deger}
				onChange={(e) => setDeger(e.target.value)}
				className="alan min-w-28 flex-1"
				aria-label={`%${kademe.oran} değeri`}
			/>

			<button
				type="button"
				disabled={bekliyor}
				onClick={() =>
					basla(async () => {
						const s = await kademeKaydet({
							id: kademe.id,
							oran: kademe.oran,
							tur,
							deger,
						});
						setDurum(s.tamam ? null : s.mesaj);
					})
				}
				className="dugme dugme-bos !px-3 !py-2"
			>
				Kaydet
			</button>

			<button
				type="button"
				disabled={bekliyor}
				onClick={() =>
					basla(async () => {
						const s = await kademeSil(kademe.id);
						setDurum(s.tamam ? null : s.mesaj);
					})
				}
				className="font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-hata"
			>
				Sil
			</button>

			{durum && (
				<span role="alert" className="w-full text-sm text-hata">
					{durum}
				</span>
			)}
		</li>
	);
}

/* ---------- KDV ve varsayılan ---------- */

function GenelFormu({
	kdvOrani,
	varsayilanHedef,
}: {
	kdvOrani: number;
	varsayilanHedef: number;
}) {
	const [kdv, setKdv] = useState(String(kdvOrani));
	const [varsayilan, setVarsayilan] = useState(String(varsayilanHedef));
	const [durum, setDurum] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	return (
		<div>
			<p className="mb-3 text-sm text-metin-2">
				KDV oranı değişikliği <strong>geçmişe dokunmaz</strong>: her ciro
				kaydı kendi oranını taşıyor, yalnızca bundan sonra girilecek günler
				yeni oranla hesaplanır.
			</p>

			<div className="flex flex-wrap gap-3">
				<label className="w-32">
					<span className="etiket">KDV oranı</span>
					<input
						type="text"
						inputMode="decimal"
						value={kdv}
						onChange={(e) => setKdv(e.target.value)}
						className="alan mt-2"
					/>
				</label>
				<label className="min-w-44 flex-1">
					<span className="etiket">Varsayılan aylık hedef</span>
					<input
						type="text"
						inputMode="decimal"
						value={varsayilan}
						onChange={(e) => setVarsayilan(e.target.value)}
						className="alan mt-2"
					/>
				</label>
			</div>

			<Kaydet
				bekliyor={bekliyor}
				durum={durum}
				calistir={() =>
					basla(async () => {
						const s = await ayarKaydet(kdv, varsayilan);
						setDurum(s.tamam ? 'Kaydedildi' : s.mesaj);
					})
				}
			/>
		</div>
	);
}

/* ---------- Ortak kaydet düğmesi ---------- */

function Kaydet({
	bekliyor,
	durum,
	calistir,
	etiket = 'Kaydet',
}: {
	bekliyor: boolean;
	durum: string | null;
	calistir: () => void;
	etiket?: string;
}) {
	const basarili = durum === 'Kaydedildi' || durum === 'Eklendi';
	return (
		<div className="mt-4 flex flex-wrap items-center gap-3">
			<button
				type="button"
				onClick={calistir}
				disabled={bekliyor}
				className="dugme dugme-dolu"
			>
				{bekliyor ? 'Kaydediliyor…' : etiket}
			</button>
			{durum && (
				<span
					role="status"
					className={`text-sm ${basarili ? 'text-basarili' : 'text-hata'}`}
				>
					{durum}
				</span>
			)}
		</div>
	);
}
