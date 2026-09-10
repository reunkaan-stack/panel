'use client';

import { useState } from 'react';
import { GRUP_ADLARI, type GorevGrubu } from '@/lib/tipler';
import { kisaTarih } from '@/lib/ortak/tarih';

/* "Hangi görev aksıyor" tablosu.

   Bir görevin satırına tıklandığında, o göreve seçili tarih
   aralığında YAZILAN değerler altında açılıyor. Ayrı bir bölüm
   açmak yerine buraya gömüldü: sayfa zaten uzun ve "bu görevde ne
   yazılmış" sorusu görevin kendisine bakarken soruluyor.

   Yalnızca girdisi olan satır tıklanabilir; olmayanda düğme hiç
   çıkmıyor ki boşa tıklanmasın. */

export type GorevSatiri = {
	gorev_id: string;
	baslik: string;
	grup: GorevGrubu;
	zorunlu: boolean;
	gecerli_gun: number;
	yapilan: number;
	atlanan: number;
	oran: number | null;
};

export type Yazilan = {
	gorev_id: string;
	tarih: string;
	kisi: string | null;
	metin: string | null;
	sayi: number | null;
};

export function GorevTablosu({
	gorevler,
	yazilanlar,
}: {
	gorevler: GorevSatiri[];
	yazilanlar: Yazilan[];
}) {
	const [acik, setAcik] = useState<string | null>(null);

	/* Görev başına gruplanıyor: her satır kendi listesini arayarak
	   bulmak yerine hazır alsın. */
	const gruplu = new Map<string, Yazilan[]>();
	for (const y of yazilanlar) {
		const liste = gruplu.get(y.gorev_id);
		if (liste) liste.push(y);
		else gruplu.set(y.gorev_id, [y]);
	}

	return (
		<div className="mt-4 overflow-x-auto">
			<table className="w-full min-w-[36rem] border-t border-kenarlik text-sm">
				<thead>
					<tr className="border-b border-kenarlik">
						<Th>Görev</Th>
						<Th sag>Geçerli gün</Th>
						<Th sag>Yapıldı</Th>
						<Th sag>Atlandı</Th>
						<Th sag>Oran</Th>
					</tr>
				</thead>
				<tbody>
					{gorevler.map((g) => {
						const girdiler = gruplu.get(g.gorev_id) ?? [];
						const acikMi = acik === g.gorev_id;

						return (
							<Satir
								key={g.gorev_id}
								gorev={g}
								girdiler={girdiler}
								acik={acikMi}
								degistir={() => setAcik(acikMi ? null : g.gorev_id)}
							/>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

function Satir({
	gorev: g,
	girdiler,
	acik,
	degistir,
}: {
	gorev: GorevSatiri;
	girdiler: Yazilan[];
	acik: boolean;
	degistir: () => void;
}) {
	return (
		<>
			<tr className="border-b border-kenarlik-2">
				<td className="py-3 pr-4">
					<span className={g.zorunlu ? 'font-medium' : ''}>{g.baslik}</span>
					<span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3">
						{GRUP_ADLARI[g.grup] ?? g.grup}
					</span>

					{girdiler.length > 0 && (
						<button
							type="button"
							onClick={degistir}
							aria-expanded={acik}
							className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-vurgu-metin underline underline-offset-4"
						>
							{acik ? 'gizle' : `yazılanlar · ${girdiler.length}`}
						</button>
					)}
				</td>
				<Td>{g.gecerli_gun}</Td>
				<Td>{g.yapilan}</Td>
				<Td renk={Number(g.atlanan) > 0 ? 'text-uyari' : undefined}>
					{g.atlanan}
				</Td>
				<Td
					renk={
						Number(g.oran) < 60
							? 'text-hata'
							: Number(g.oran) < 90
								? 'text-uyari'
								: 'text-basarili'
					}
				>
					%{g.oran ?? 0}
				</Td>
			</tr>

			{acik && (
				<tr className="border-b border-kenarlik-2">
					<td colSpan={5} className="bg-zemin-2 px-4 py-4">
						<ul className="space-y-2">
							{girdiler.map((y, i) => (
								<li
									key={`${y.tarih}-${i}`}
									className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
								>
									<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
										{/* Öğle vakti veriliyor: 'YYYY-MM-DD' UTC gece yarısı
										    olarak okunuyor ve saat farkı olan yerde bir gün
										    kayabiliyor. */}
										{kisaTarih(y.tarih + 'T12:00:00Z')}
										{y.kisi && ` · ${y.kisi}`}
									</span>
									<span className="text-sm text-metin-2">
										{y.metin ?? ''}
										{y.sayi !== null && (
											<span className="font-medium tabular-nums">
												{y.metin ? ` · ${y.sayi}` : y.sayi}
											</span>
										)}
									</span>
								</li>
							))}
						</ul>
					</td>
				</tr>
			)}
		</>
	);
}

function Th({ children, sag }: { children: React.ReactNode; sag?: boolean }) {
	return (
		<th
			className={`py-2 font-mono text-[0.625rem] font-normal uppercase tracking-[0.08em] text-metin-3 ${
				sag ? 'pl-4 text-right' : 'pr-4 text-left'
			}`}
		>
			{children}
		</th>
	);
}

function Td({
	children,
	renk,
}: {
	children: React.ReactNode;
	renk?: string;
}) {
	return (
		<td className={`py-3 pl-4 text-right tabular-nums ${renk ?? ''}`}>
			{children}
		</td>
	);
}
