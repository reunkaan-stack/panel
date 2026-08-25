'use client';

import { useState, useTransition } from 'react';
import { kisaTarih } from '@/lib/ortak/tarih';
import type { Modul, Rol, Seviye } from '@/lib/tipler';
import type { Firma, KisiSatiri, YetkiSatiri } from '../page';
import {
	kisiDurumDegistir,
	kisiEkle,
	kisiGuncelle,
	kisiSil,
	sifreDegistir,
} from '../eylemler';

/* Kişi yönetimi.

   Şifre burada bir kez görünür ve hiçbir yere yazılmaz — ne veri
   tabanına ne denetim kaydına. Süperadmin şifreyi kişiye kendisi
   iletir; kişi sonra değiştirir. */

const ROL_ADLARI: Record<Rol, string> = {
	superadmin: 'Süperadmin',
	firma_yoneticisi: 'Firma yöneticisi',
	kullanici: 'Personel',
};

const ROL_NOTU: Record<Rol, string> = {
	superadmin: 'Bütün firmalar, bütün modüller',
	firma_yoneticisi: 'Kendi firmasında her şey',
	kullanici: 'Yalnızca verilen modül yetkileri',
};

const MODULLER: { kod: Modul; ad: string }[] = [
	{ kod: 'ptp', ad: 'Personel Takip' },
	{ kod: 'otp', ad: 'Ödeme Takip' },
	{ kod: 'ttp', ad: 'Tahsilat Takip' },
	{ kod: 'mtp', ad: 'Mağaza Takip' },
];

const SEVIYELER: { kod: Seviye; ad: string }[] = [
	{ kod: 'okuma', ad: 'Görür' },
	{ kod: 'yazma', ad: 'Görür + işaretler' },
	{ kod: 'yonetim', ad: 'Yönetir' },
];

/** Okunması kolay, karışması zor şifre. Benzer harfler dışarıda. */
function sifreUret(): string {
	const harfler = 'abcdefghijkmnpqrstuvwxyz';
	const buyuk = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
	const rakam = '23456789';
	const havuz = harfler + buyuk + rakam;
	const rastgele = crypto.getRandomValues(new Uint32Array(12));
	return [...rastgele].map((n) => havuz[n % havuz.length]).join('');
}

export function KisiYonetimi({
	kisiler,
	firmalar,
	yetkiler,
	benimId,
	acikMi,
}: {
	kisiler: KisiSatiri[];
	firmalar: Firma[];
	yetkiler: YetkiSatiri[];
	benimId: string;
	acikMi: boolean;
}) {
	const [ekleAcik, setEkleAcik] = useState(false);

	const firmaAdi = new Map(firmalar.map((f) => [f.id, f.ad]));
	const aktifler = kisiler.filter((k) => k.aktif);
	const pasifler = kisiler.filter((k) => !k.aktif);

	return (
		<>
			{!ekleAcik ? (
				<button
					type="button"
					onClick={() => setEkleAcik(true)}
					disabled={!acikMi}
					className="dugme dugme-dolu"
				>
					Kişi ekle
				</button>
			) : (
				<EkleFormu
					firmalar={firmalar}
					kapat={() => setEkleAcik(false)}
				/>
			)}

			<div className="mt-8">
				<span className="etiket">Aktif · {aktifler.length}</span>
				<ul className="mt-3 border-t border-kenarlik">
					{aktifler.map((kisi) => (
						<KisiSatir
							key={kisi.id}
							kisi={kisi}
							firmalar={firmalar}
							firmaAdi={firmaAdi}
							yetkiler={yetkiler.filter((y) => y.kullanici_id === kisi.id)}
							benim={kisi.id === benimId}
							acikMi={acikMi}
						/>
					))}
				</ul>
			</div>

			{pasifler.length > 0 && (
				<div className="mt-10">
					<span className="etiket text-metin-3">
						Pasif · {pasifler.length}
					</span>
					<ul className="mt-3 border-t border-kenarlik">
						{pasifler.map((kisi) => (
							<KisiSatir
								key={kisi.id}
								kisi={kisi}
								firmalar={firmalar}
								firmaAdi={firmaAdi}
								yetkiler={yetkiler.filter((y) => y.kullanici_id === kisi.id)}
								benim={kisi.id === benimId}
								acikMi={acikMi}
							/>
						))}
					</ul>
				</div>
			)}
		</>
	);
}

/* ---------- Yeni kişi ---------- */

function EkleFormu({
	firmalar,
	kapat,
}: {
	firmalar: Firma[];
	kapat: () => void;
}) {
	const [ad, setAd] = useState('');
	const [eposta, setEposta] = useState('');
	const [sifre, setSifre] = useState('');
	const [rol, setRol] = useState<Rol>('kullanici');
	const [firmaId, setFirmaId] = useState(firmalar[0]?.id ?? '');
	const [yetkiler, setYetkiler] = useState<Record<string, Seviye | ''>>({
		ptp: 'yazma',
	});
	const [hata, setHata] = useState<string | null>(null);
	const [bitti, setBitti] = useState<{ eposta: string; sifre: string } | null>(
		null
	);
	const [bekliyor, basla] = useTransition();

	function kaydet() {
		setHata(null);
		basla(async () => {
			const sonuc = await kisiEkle({
				ad,
				eposta,
				sifre,
				rol,
				firmaId: rol === 'superadmin' ? null : firmaId,
				yetkiler: MODULLER.filter((m) => yetkiler[m.kod]).map((m) => ({
					modul: m.kod,
					seviye: yetkiler[m.kod] as Seviye,
				})),
			});
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setBitti({ eposta: eposta.trim().toLowerCase(), sifre });
		});
	}

	/* Hesap açıldıktan sonra şifre bir kez gösteriliyor. Sayfa
	   kapandığında bir daha görünmez — hiçbir yerde saklanmıyor. */
	if (bitti) {
		return (
			<div className="border border-kenarlik p-4">
				<span className="etiket text-basarili">Hesap açıldı</span>
				<p className="mt-2 text-sm text-metin-2">
					Bu bilgileri kişiye iletin. Şifre burada bir kez görünüyor,
					hiçbir yerde saklanmıyor.
				</p>

				<dl className="mt-4 space-y-2 border border-kenarlik bg-zemin-2 p-4 font-mono text-sm">
					<div className="flex flex-wrap gap-2">
						<dt className="w-20 text-metin-3">E-posta</dt>
						<dd className="select-all">{bitti.eposta}</dd>
					</div>
					<div className="flex flex-wrap gap-2">
						<dt className="w-20 text-metin-3">Şifre</dt>
						<dd className="select-all">{bitti.sifre}</dd>
					</div>
				</dl>

				<button type="button" onClick={kapat} className="dugme dugme-dolu mt-4">
					Tamam
				</button>
			</div>
		);
	}

	return (
		<div className="border border-kenarlik p-4">
			<span className="etiket text-vurgu-metin">Yeni kişi</span>

			<div className="mt-4 flex flex-wrap gap-4">
				<label className="min-w-40 flex-1">
					<span className="etiket">Ad soyad</span>
					<input
						type="text"
						value={ad}
						onChange={(e) => setAd(e.target.value)}
						className="alan mt-2"
						autoFocus
					/>
				</label>
				<label className="min-w-52 flex-1">
					<span className="etiket">E-posta</span>
					<input
						type="email"
						inputMode="email"
						autoComplete="off"
						value={eposta}
						onChange={(e) => setEposta(e.target.value)}
						className="alan mt-2"
					/>
				</label>
			</div>

			<div className="mt-4">
				<span className="etiket">Başlangıç şifresi</span>
				<div className="mt-2 flex flex-wrap gap-2">
					<input
						type="text"
						autoComplete="off"
						value={sifre}
						onChange={(e) => setSifre(e.target.value)}
						placeholder="En az 8 karakter"
						className="alan min-w-44 flex-1 font-mono"
					/>
					<button
						type="button"
						onClick={() => setSifre(sifreUret())}
						className="dugme dugme-bos shrink-0"
					>
						Üret
					</button>
				</div>
				<p className="mt-1.5 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
					Kaydettikten sonra bir kez gösterilir, saklanmaz.
				</p>
			</div>

			<RolSecici rol={rol} setRol={setRol} />

			{rol !== 'superadmin' && (
				<label className="mt-4 block">
					<span className="etiket">Firma</span>
					<select
						value={firmaId}
						onChange={(e) => setFirmaId(e.target.value)}
						className="alan mt-2"
					>
						{firmalar.map((f) => (
							<option key={f.id} value={f.id}>
								{f.ad}
							</option>
						))}
					</select>
				</label>
			)}

			{rol === 'kullanici' && (
				<YetkiSecici yetkiler={yetkiler} setYetkiler={setYetkiler} />
			)}

			{hata && (
				<p role="alert" className="mt-4 text-sm text-hata">
					{hata}
				</p>
			)}

			<div className="mt-5 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={kaydet}
					disabled={bekliyor}
					className="dugme dugme-dolu"
				>
					{bekliyor ? 'Açılıyor…' : 'Hesabı aç'}
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
		</div>
	);
}

/* ---------- Tek satır ---------- */

function KisiSatir({
	kisi,
	firmalar,
	firmaAdi,
	yetkiler,
	benim,
	acikMi,
}: {
	kisi: KisiSatiri;
	firmalar: Firma[];
	firmaAdi: Map<string, string>;
	yetkiler: YetkiSatiri[];
	benim: boolean;
	acikMi: boolean;
}) {
	const [acik, setAcik] = useState(false);
	const [ad, setAd] = useState(kisi.ad);
	const [rol, setRol] = useState<Rol>(kisi.rol);
	const [firmaId, setFirmaId] = useState(kisi.firma_id ?? firmalar[0]?.id ?? '');
	const [secim, setSecim] = useState<Record<string, Seviye | ''>>(
		Object.fromEntries(yetkiler.map((y) => [y.modul, y.seviye]))
	);
	const [yeniSifre, setYeniSifre] = useState('');
	const [hata, setHata] = useState<string | null>(null);
	const [bilgi, setBilgi] = useState<string | null>(null);
	const [bekliyor, basla] = useTransition();

	function calistir(is: () => Promise<{ tamam: boolean; mesaj?: string }>) {
		setHata(null);
		setBilgi(null);
		basla(async () => {
			const sonuc = await is();
			if (!sonuc.tamam) return setHata(sonuc.mesaj ?? 'Olmadı');
			setAcik(false);
		});
	}

	const ozet = yetkiler.length
		? yetkiler.map((y) => `${y.modul}:${y.seviye}`).join(' · ')
		: kisi.rol === 'kullanici'
			? 'yetki yok'
			: 'tam yetki';

	return (
		<li className="border-b border-kenarlik-2 py-3">
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
				<span className={`font-medium ${kisi.aktif ? '' : 'text-metin-3'}`}>
					{kisi.ad}
					{benim && (
						<span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-vurgu-metin">
							siz
						</span>
					)}
				</span>

				<span className="min-w-0 flex-1 truncate font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
					{kisi.eposta}
				</span>

				<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
					{ROL_ADLARI[kisi.rol]}
					{kisi.firma_id && ` · ${firmaAdi.get(kisi.firma_id) ?? '—'}`}
					{' · '}
					{ozet}
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

			<p className="mt-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
				{kisi.son_giris
					? `son giriş ${kisaTarih(kisi.son_giris)}`
					: 'hiç giriş yapmadı'}
				{' · '}
				{kisaTarih(kisi.olusturuldu)} açıldı
			</p>

			{acik && (
				<div className="mt-3 border border-kenarlik bg-zemin-2 p-4">
					<label className="block">
						<span className="etiket">Ad soyad</span>
						<input
							type="text"
							value={ad}
							onChange={(e) => setAd(e.target.value)}
							className="alan mt-2"
						/>
					</label>

					{benim ? (
						<p className="mt-4 text-sm text-metin-2">
							Kendi rolünüzü ve yetkinizi buradan değiştiremezsiniz — yanlışlıkla
							kendinizi kilitlemenin önü kapalı.
						</p>
					) : (
						<>
							<RolSecici rol={rol} setRol={setRol} />

							{rol !== 'superadmin' && (
								<label className="mt-4 block">
									<span className="etiket">Firma</span>
									<select
										value={firmaId}
										onChange={(e) => setFirmaId(e.target.value)}
										className="alan mt-2"
									>
										{firmalar.map((f) => (
											<option key={f.id} value={f.id}>
												{f.ad}
											</option>
										))}
									</select>
								</label>
							)}

							{rol === 'kullanici' && (
								<YetkiSecici yetkiler={secim} setYetkiler={setSecim} />
							)}
						</>
					)}

					{hata && (
						<p role="alert" className="mt-4 text-sm text-hata">
							{hata}
						</p>
					)}
					{bilgi && (
						<p role="status" className="mt-4 text-sm text-basarili">
							{bilgi}
						</p>
					)}

					<div className="mt-5 flex flex-wrap gap-3">
						<button
							type="button"
							disabled={bekliyor}
							onClick={() =>
								calistir(() =>
									kisiGuncelle(
										kisi.id,
										ad,
										rol,
										rol === 'superadmin' ? null : firmaId,
										MODULLER.filter((m) => secim[m.kod]).map((m) => ({
											modul: m.kod,
											seviye: secim[m.kod] as Seviye,
										}))
									)
								)
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

					{!benim && (
						<div className="mt-5 border-t border-kenarlik pt-4">
							<span className="etiket">Hesap</span>

							{/* Şifre sıfırlama: kişi unuttuğunda yenisi verilir. */}
							<div className="mt-3 flex flex-wrap gap-2">
								<input
									type="text"
									autoComplete="off"
									value={yeniSifre}
									onChange={(e) => setYeniSifre(e.target.value)}
									placeholder="Yeni şifre"
									className="alan min-w-40 flex-1 font-mono"
								/>
								<button
									type="button"
									onClick={() => setYeniSifre(sifreUret())}
									className="dugme dugme-bos shrink-0"
								>
									Üret
								</button>
								<button
									type="button"
									disabled={bekliyor || yeniSifre.length < 8 || !acikMi}
									onClick={() => {
										setHata(null);
										basla(async () => {
											const s = await sifreDegistir(kisi.id, yeniSifre);
											if (!s.tamam) return setHata(s.mesaj);
											setBilgi(`Yeni şifre: ${yeniSifre} — kişiye iletin.`);
											setYeniSifre('');
										});
									}}
									className="dugme dugme-bos shrink-0"
								>
									Şifreyi değiştir
								</button>
							</div>

							<div className="mt-4 flex flex-wrap items-center gap-4">
								<button
									type="button"
									disabled={bekliyor}
									onClick={() =>
										calistir(() => kisiDurumDegistir(kisi.id, !kisi.aktif))
									}
									className="dugme dugme-bos"
								>
									{kisi.aktif ? 'Pasife al' : 'Yeniden aç'}
								</button>

								<button
									type="button"
									disabled={bekliyor || !acikMi}
									onClick={() => calistir(() => kisiSil(kisi.id))}
									className="ml-auto font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-metin-3 underline underline-offset-4 hover:text-hata"
								>
									Kalıcı sil
								</button>
							</div>

							<p className="mt-3 text-sm text-metin-3">
								Pasif hesap giriş yapamaz ama kayıtları durur. Kalıcı silme
								yalnızca hiç kayıt bırakmamış hesaplarda çalışır.
							</p>
						</div>
					)}
				</div>
			)}
		</li>
	);
}

/* ---------- Ortak seçiciler ---------- */

function RolSecici({
	rol,
	setRol,
}: {
	rol: Rol;
	setRol: (r: Rol) => void;
}) {
	return (
		<div className="mt-4">
			<span className="etiket">Rol</span>
			<div className="mt-2 flex flex-wrap gap-2">
				{(Object.keys(ROL_ADLARI) as Rol[]).map((r) => (
					<button
						key={r}
						type="button"
						onClick={() => setRol(r)}
						aria-pressed={rol === r}
						className={`border px-3 py-2 text-left transition-colors ${
							rol === r
								? 'border-vurgu-metin bg-vurgu-metin text-zemin'
								: 'border-kenarlik text-metin-2 hover:border-metin'
						}`}
					>
						<span className="block text-sm font-medium">{ROL_ADLARI[r]}</span>
						<span className="block font-mono text-[0.625rem] uppercase tracking-[0.06em] opacity-80">
							{ROL_NOTU[r]}
						</span>
					</button>
				))}
			</div>
		</div>
	);
}

function YetkiSecici({
	yetkiler,
	setYetkiler,
}: {
	yetkiler: Record<string, Seviye | ''>;
	setYetkiler: (y: Record<string, Seviye | ''>) => void;
}) {
	return (
		<div className="mt-4">
			<span className="etiket">Modül yetkileri</span>
			<ul className="mt-2 space-y-2">
				{MODULLER.map((m) => (
					<li key={m.kod} className="flex flex-wrap items-center gap-3">
						<span className="w-36 text-sm">{m.ad}</span>
						<select
							value={yetkiler[m.kod] ?? ''}
							onChange={(e) =>
								setYetkiler({
									...yetkiler,
									[m.kod]: e.target.value as Seviye | '',
								})
							}
							className="alan min-w-40 flex-1"
							aria-label={`${m.ad} yetkisi`}
						>
							<option value="">Yetki yok</option>
							{SEVIYELER.map((s) => (
								<option key={s.kod} value={s.kod}>
									{s.ad}
								</option>
							))}
						</select>
					</li>
				))}
			</ul>
			<p className="mt-2 text-sm text-metin-3">
				Firmanın o modülü almamışsa yetki yine de geçmez — iki katman birden
				denetlenir.
			</p>
		</div>
	);
}
