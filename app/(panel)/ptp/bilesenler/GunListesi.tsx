'use client';

import { useState, useTransition } from 'react';
import {
	GRUP_ADLARI,
	type Bolge,
	type GorevGrubu,
	type GunlukGorev,
} from '@/lib/tipler';
import { saatiBicimle } from '@/lib/ortak/tarih';
import { atamaDegistir } from '../eylemler';
import { GorevSatir } from './GorevSatir';

/* Günün görev listesi.

   Toplu atama var: görevler işaretlenip tek seferde bir kişiye
   veriliyor. Atama KALICI — her gün yeniden atamak gerekmiyor, aynı
   işi genelde aynı kişi yapıyor. */

type Kisi = { id: string; ad: string };

export function GunListesi({
	gorevler,
	yonetici,
	kullaniciId,
	kisiler,
	bolgeler,
	tarih,
}: {
	gorevler: GunlukGorev[];
	yonetici: boolean;
	kullaniciId: string;
	kisiler: Kisi[];
	bolgeler: Bolge[];
	tarih: string;
}) {
	const [secili, setSecili] = useState<Set<string>>(new Set());
	const [atanacak, setAtanacak] = useState('');
	const [bekliyor, basla] = useTransition();
	const [hata, setHata] = useState<string | null>(null);

	if (gorevler.length === 0) {
		return (
			<div className="kose-nisan border border-kenarlik p-8 text-center">
				<span className="etiket">Görev yok</span>
				<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
					{yonetici
						? 'Bugüne düşen görev tanımı yok. “Görev tanımları”ndan ekleyebilirsiniz.'
						: 'Bugün size atanmış bir görev bulunmuyor.'}
				</p>
			</div>
		);
	}

	function isaretle(id: string) {
		setSecili((o) => {
			const y = new Set(o);
			if (y.has(id)) y.delete(id);
			else y.add(id);
			return y;
		});
	}

	function ata() {
		setHata(null);
		basla(async () => {
			const sonuc = await atamaDegistir([...secili], atanacak || null);
			if (!sonuc.tamam) return setHata(sonuc.mesaj);
			setSecili(new Set());
			setAtanacak('');
		});
	}

	/* Gruplara ayır: mağazada iş bu sırayla yapılıyor. */
	const gruplar = gorevler.reduce<Record<string, GunlukGorev[]>>((t, g) => {
		(t[g.grup] ??= []).push(g);
		return t;
	}, {});

	/* "Yapıldı" = o güne ait en az bir 'yapildi' kaydı var. */
	const yapilan = gorevler.filter((g) =>
		g.kayitlar.some((k) => k.durum === 'yapildi')
	).length;

	return (
		<>
			<div className="flex items-baseline justify-between border-b border-kenarlik pb-3">
				<span className="etiket">
					{yapilan} / {gorevler.length} yapıldı
				</span>
				{yonetici && secili.size > 0 && (
					<span className="etiket text-vurgu-metin">
						{secili.size} görev seçili
					</span>
				)}
			</div>

			{yonetici && secili.size > 0 && (
				<div className="mt-4 flex flex-col gap-3 border border-kenarlik bg-zemin-2 p-4 sm:flex-row sm:items-end">
					<label className="flex-1">
						<span className="etiket">Kime atansın (kalıcı)</span>
						<select
							value={atanacak}
							onChange={(e) => setAtanacak(e.target.value)}
							className="alan mt-2"
						>
							<option value="">Atamayı kaldır (herkese açık)</option>
							{kisiler.map((k) => (
								<option key={k.id} value={k.id}>
									{k.ad}
								</option>
							))}
						</select>
					</label>
					<button
						type="button"
						onClick={ata}
						disabled={bekliyor}
						className="dugme dugme-dolu shrink-0"
					>
						{bekliyor ? 'Atanıyor…' : `${secili.size} görevi ata`}
					</button>
				</div>
			)}

			{hata && (
				<p role="alert" className="mt-4 border border-hata px-4 py-3 text-sm text-hata">
					{hata}
				</p>
			)}

			{Object.entries(gruplar).map(([grup, liste]) => (
				<section key={grup} className="mt-8">
					<span className="etiket">
						{GRUP_ADLARI[grup as GorevGrubu] ?? grup}
					</span>
					<ul className="mt-3 border-t border-kenarlik">
						{liste.map((gorev) => (
							<GorevSatir
								key={gorev.id}
								gorev={gorev}
								yonetici={yonetici}
								benim={gorev.atanan_id === kullaniciId}
								secili={secili.has(gorev.id)}
								isaretle={() => isaretle(gorev.id)}
								saatiBicimle={saatiBicimle}
								bolgeler={bolgeler}
								tarih={tarih}
							/>
						))}
					</ul>
				</section>
			))}
		</>
	);
}
