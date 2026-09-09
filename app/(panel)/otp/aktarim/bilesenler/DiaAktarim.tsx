'use client';

import { useRef, useState } from 'react';

/* DIA raporu içe aktarma.

   ÜÇ DURUM: eşleme sorulur → önizleme → uygulanır.

   Önizlemede hiçbir şey yazılmıyor. Para verisinde "yükle ve gör"
   kabul edilebilir değil; ne olacağını önce göstermek gerekiyor. */

type Alan = { kod: string; ad: string; zorunlu: boolean };

type EslemeYaniti = {
	eslemeGerekli: true;
	tur: 'cek' | 'kredi';
	basliklar: string[];
	ornekler: string[][];
	esleme: Record<string, number>;
	eksik: { kod: string; ad: string }[];
	alanlar: Alan[];
};

type CekYaniti = {
	tur: 'cek';
	toplam: number;
	yeni: string[];
	guncellenen: string[];
	korunan: string[];
	degismeyen: number;
	onizleme: boolean;
};

type KrediYaniti = {
	tur: 'kredi';
	toplam: number;
	krediYeni: number;
	taksitYeni: number;
	guncellenen: number;
	korunan: string[];
	degismeyen: number;
	onizleme: boolean;
};

type Yanit = EslemeYaniti | CekYaniti | KrediYaniti | { error: string };

export function DiaAktarim() {
	const dosyaRef = useRef<HTMLInputElement>(null);
	const [dosya, setDosya] = useState<File | null>(null);
	const [yanit, setYanit] = useState<Yanit | null>(null);
	const [esleme, setEsleme] = useState<Record<string, number>>({});
	const [bekliyor, setBekliyor] = useState(false);
	const [uygulandi, setUygulandi] = useState(false);

	async function gonder(secilen: File, onizle: boolean, elle?: Record<string, number>) {
		setBekliyor(true);
		try {
			const veri = new FormData();
			veri.append('dosya', secilen);
			if (elle && Object.keys(elle).length > 0) {
				veri.append('esleme', JSON.stringify(elle));
			}

			const cevap = await fetch(
				`/api/otp/dia-import${onizle ? '?onizle=1' : ''}`,
				{ method: 'POST', body: veri }
			);
			const j = (await cevap.json()) as Yanit;

			setYanit(j);
			if ('eslemeGerekli' in j) setEsleme(j.esleme ?? {});
			if (!onizle && !('error' in j) && !('eslemeGerekli' in j)) setUygulandi(true);
		} catch {
			setYanit({ error: 'Sunucuya ulaşılamadı. Tekrar deneyin.' });
		} finally {
			setBekliyor(false);
		}
	}

	function sifirla() {
		setDosya(null);
		setYanit(null);
		setEsleme({});
		setUygulandi(false);
		if (dosyaRef.current) dosyaRef.current.value = '';
	}

	/* ---------- Dosya seçimi ---------- */

	if (!dosya || !yanit) {
		return (
			<div className="border border-kenarlik p-6">
				<span className="etiket">DIA raporu</span>
				<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
					DIA’dan aldığınız <strong>Çek-Senet Listesi</strong> ya da{' '}
					<strong>Banka Kredi Taksit Ödeme Listesi</strong> raporunu yükleyin.
					Hangisi olduğu başlıklardan anlaşılıyor, seçmenize gerek yok.
				</p>

				<input
					ref={dosyaRef}
					type="file"
					accept=".xlsx"
					className="alan mt-4"
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (!f) return;
						setDosya(f);
						setUygulandi(false);
						void gonder(f, true);
					}}
				/>

				{bekliyor && (
					<p className="mt-3 text-sm text-metin-2">Dosya okunuyor…</p>
				)}

				<p className="mt-4 text-sm leading-relaxed text-metin-3">
					Yükleme iki adımlı: önce ne olacağı gösterilir, onaylamadan hiçbir
					kayıt değişmez. Panelde işaretlediğiniz ödemeler geri alınmaz.
				</p>
			</div>
		);
	}

	/* ---------- Hata ---------- */

	if ('error' in yanit) {
		return (
			<Kutu baslik="Rapor okunamadı" renk="hata">
				<p className="text-sm leading-relaxed text-metin-2">{yanit.error}</p>
				<button type="button" onClick={sifirla} className="dugme dugme-bos mt-4">
					Başka dosya seç
				</button>
			</Kutu>
		);
	}

	/* ---------- Kolon eşleme ---------- */

	if ('eslemeGerekli' in yanit) {
		const eksikVar = yanit.alanlar.some(
			(a) => a.zorunlu && esleme[a.kod] === undefined
		);

		return (
			<Kutu baslik="Bu raporu tanımadım" renk="uyari">
				<p className="text-sm leading-relaxed text-metin-2">
					Şu alanları bulamadım:{' '}
					<strong>{yanit.eksik.map((e) => e.ad).join(', ')}</strong>. Hangi
					kolonda olduklarını seçin — bir kez seçtiğinizde{' '}
					<strong>aynı biçimdeki raporlar bir daha sorulmaz</strong>.
				</p>

				<ul className="mt-5 space-y-4">
					{yanit.alanlar.map((alan) => (
						<li key={alan.kod} className="flex flex-wrap items-center gap-3">
							<span className="w-44 shrink-0 text-sm">
								{alan.ad}
								{alan.zorunlu && (
									<span className="ml-1 text-vurgu-metin" title="Zorunlu">
										*
									</span>
								)}
							</span>

							<select
								value={esleme[alan.kod] ?? ''}
								onChange={(e) =>
									setEsleme((s) => {
										const y = { ...s };
										if (e.target.value === '') delete y[alan.kod];
										else y[alan.kod] = Number(e.target.value);
										return y;
									})
								}
								className="alan min-w-52 flex-1"
							>
								<option value="">— yok —</option>
								{yanit.basliklar.map((b, i) => {
									const ornek = yanit.ornekler[0]?.[i] ?? '';
									return (
										<option key={i} value={i}>
											{b || `(kolon ${i + 1})`}
											{ornek && ` — ${ornek.slice(0, 24)}`}
										</option>
									);
								})}
							</select>
						</li>
					))}
				</ul>

				<div className="mt-6 flex flex-wrap gap-3">
					<button
						type="button"
						disabled={bekliyor || eksikVar}
						onClick={() => void gonder(dosya, true, esleme)}
						className="dugme dugme-dolu"
					>
						{bekliyor ? 'Okunuyor…' : 'Devam et'}
					</button>
					<button type="button" onClick={sifirla} className="dugme dugme-bos">
						Vazgeç
					</button>
				</div>

				{eksikVar && (
					<p className="mt-3 text-sm text-metin-3">
						Yıldızlı alanların hepsi seçilmeden devam edilemez.
					</p>
				)}
			</Kutu>
		);
	}

	/* ---------- Önizleme / sonuç ---------- */

	const cek = yanit.tur === 'cek' ? yanit : null;
	const kredi = yanit.tur === 'kredi' ? yanit : null;

	const degisiklik = cek
		? cek.yeni.length + cek.guncellenen.length
		: (kredi?.krediYeni ?? 0) + (kredi?.taksitYeni ?? 0) + (kredi?.guncellenen ?? 0);

	return (
		<Kutu
			baslik={
				uygulandi
					? 'Aktarıldı'
					: degisiklik === 0
						? 'Veri zaten güncel'
						: 'Önizleme — onayınız bekleniyor'
			}
			renk={uygulandi ? 'basarili' : 'normal'}
		>
			{!uygulandi && degisiklik > 0 && (
				<p className="border border-uyari px-4 py-2.5 text-sm text-metin-2">
					Henüz hiçbir şey değişmedi. Aşağıdakiler ancak onaylarsanız
					uygulanacak.
				</p>
			)}

			<div className="mt-4 grid grid-cols-2 gap-px border border-kenarlik bg-kenarlik sm:grid-cols-4">
				{cek && (
					<>
						<Sayac ad="Dosyada" deger={cek.toplam} />
						<Sayac ad="Yeni" deger={cek.yeni.length} vurgu />
						<Sayac ad="Güncellenen" deger={cek.guncellenen.length} vurgu />
						<Sayac ad="Değişmeyen" deger={cek.degismeyen} />
					</>
				)}
				{kredi && (
					<>
						<Sayac ad="Dosyada taksit" deger={kredi.toplam} />
						<Sayac ad="Yeni kredi" deger={kredi.krediYeni} vurgu />
						<Sayac ad="Yeni taksit" deger={kredi.taksitYeni} vurgu />
						<Sayac ad="Güncellenen" deger={kredi.guncellenen} vurgu />
					</>
				)}
			</div>

			{/* Korunanlar en üstte ve dikkat çekici: kullanıcı bunları
			    DIA'da düzeltmek isteyecek. */}
			{yanit.korunan.length > 0 && (
				<div className="mt-6 border border-uyari p-4">
					<span className="etiket text-uyari">
						DIA’da düzeltmeniz gerekenler · {yanit.korunan.length}
					</span>
					<p className="mt-2 text-sm leading-relaxed text-metin-2">
						Bu kayıtlar panelde ödenmiş görünüyor ama DIA’da hâlâ bekliyor.
						Panel kazandı — kayıtlarınız değişmedi. Muhasebede düzeltmek
						isterseniz liste burada.
					</p>
					<ul className="mt-3 space-y-1">
						{yanit.korunan.map((k) => (
							<li
								key={k}
								className="font-mono text-[0.6875rem] leading-relaxed tracking-[0.02em] text-metin-2"
							>
								{k}
							</li>
						))}
					</ul>
				</div>
			)}

			{cek && cek.yeni.length > 0 && (
				<Liste baslik="Eklenecek" satirlar={cek.yeni} />
			)}
			{cek && cek.guncellenen.length > 0 && (
				<Liste baslik="Güncellenecek" satirlar={cek.guncellenen} />
			)}

			<div className="mt-6 flex flex-wrap gap-3">
				{!uygulandi && degisiklik > 0 && (
					<button
						type="button"
						disabled={bekliyor}
						onClick={() => void gonder(dosya, false, esleme)}
						className="dugme dugme-dolu"
					>
						{bekliyor ? 'Uygulanıyor…' : 'Onayla ve uygula'}
					</button>
				)}
				<button type="button" onClick={sifirla} className="dugme dugme-bos">
					{uygulandi ? 'Yeni dosya yükle' : 'Vazgeç'}
				</button>
			</div>
		</Kutu>
	);
}

function Kutu({
	baslik,
	renk = 'normal',
	children,
}: {
	baslik: string;
	renk?: 'normal' | 'hata' | 'uyari' | 'basarili';
	children: React.ReactNode;
}) {
	const cerceve =
		renk === 'hata'
			? 'border-hata'
			: renk === 'uyari'
				? 'border-uyari'
				: 'border-kenarlik';
	const yazi =
		renk === 'hata'
			? 'text-hata'
			: renk === 'uyari'
				? 'text-uyari'
				: renk === 'basarili'
					? 'text-basarili'
					: 'text-vurgu-metin';

	return (
		<div className={`border p-6 ${cerceve}`}>
			<span className={`etiket ${yazi}`}>{baslik}</span>
			<div className="mt-3">{children}</div>
		</div>
	);
}

function Sayac({
	ad,
	deger,
	vurgu = false,
}: {
	ad: string;
	deger: number;
	vurgu?: boolean;
}) {
	return (
		<div className="bg-zemin p-3">
			<span className="etiket">{ad}</span>
			<p
				className={`mt-1.5 text-lg font-semibold tabular-nums ${
					vurgu && deger > 0 ? 'text-vurgu-metin' : ''
				}`}
			>
				{deger}
			</p>
		</div>
	);
}

function Liste({ baslik, satirlar }: { baslik: string; satirlar: string[] }) {
	return (
		<div className="mt-6">
			<span className="etiket">
				{baslik} · {satirlar.length}
			</span>
			<ul className="mt-2 max-h-72 space-y-1 overflow-y-auto border border-kenarlik-2 p-3">
				{satirlar.map((s) => (
					<li
						key={s}
						className="font-mono text-[0.6875rem] leading-relaxed tracking-[0.02em] text-metin-2"
					>
						{s}
					</li>
				))}
			</ul>
		</div>
	);
}
