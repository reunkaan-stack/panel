import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { bugun, tarihiBicimle } from '@/lib/ortak/tarih';
import { GRUP_ADLARI, type GorevGrubu } from '@/lib/tipler';

export const metadata: Metadata = { title: 'Performans — Karas Panel' };
export const dynamic = 'force-dynamic';

type KisiSatiri = {
	kullanici_id: string;
	ad: string;
	atanan: number;
	tamamlanan: number;
	atlanan: number;
	bekleyen: number;
	tekrar_sayisi: number;
	ort_saat: number | null;
};

type GorevSatiri = {
	baslik: string;
	grup: GorevGrubu;
	zorunlu: boolean;
	toplam: number;
	tamamlanan: number;
	atlanan: number;
	bekleyen: number;
	oran: number | null;
};

type GunSatiri = {
	tarih: string;
	toplam: number;
	tamamlanan: number;
	atlanan: number;
	oran: number | null;
};

type AtlananSatiri = {
	tarih: string;
	baslik: string;
	sebep: string;
	kisi: string | null;
	zaman: string | null;
};

function gunOnce(sayi: number): string {
	const d = new Date(bugun() + 'T12:00:00');
	d.setDate(d.getDate() - sayi);
	return d.toLocaleDateString('en-CA');
}

/** 14.5 → "14:30" */
function saatBicimi(ondalik: number | null): string {
	if (ondalik === null) return '—';
	const saat = Math.floor(ondalik);
	const dakika = Math.round((ondalik - saat) * 60);
	return `${String(saat).padStart(2, '0')}:${String(dakika).padStart(2, '0')}`;
}

export default async function RaporSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ aralik?: string }>;
}) {
	/* Performans verisi yalnızca yöneticinin işi. */
	await yetkiDenetle('ptp', 'yonetim');

	const { aralik } = await searchParams;
	const gun = aralik === '7' ? 7 : aralik === '90' ? 90 : 30;
	const baslangic = gunOnce(gun);
	const bitis = bugun();

	const supabase = await sunucuIstemcisi();
	const p = { p_baslangic: baslangic, p_bitis: bitis };

	const [kisiSonuc, gorevSonuc, gunSonuc, atlananSonuc] = await Promise.all([
		supabase.rpc('ptp_kisi_performansi', p),
		supabase.rpc('ptp_gorev_performansi', p),
		supabase.rpc('ptp_gun_ozeti', p),
		supabase.rpc('ptp_atlananlar', p),
	]);

	const kisiler = (kisiSonuc.data ?? []) as KisiSatiri[];
	const gorevler = (gorevSonuc.data ?? []) as GorevSatiri[];
	const gunler = (gunSonuc.data ?? []) as GunSatiri[];
	const atlananlar = (atlananSonuc.data ?? []) as AtlananSatiri[];

	const toplamGorev = gunler.reduce((t, g) => t + Number(g.toplam), 0);
	const toplamTamam = gunler.reduce((t, g) => t + Number(g.tamamlanan), 0);
	const genelOran = toplamGorev ? Math.round((toplamTamam / toplamGorev) * 100) : 0;

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Performans</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Son {gun} gün
			</h1>

			<div className="mt-6 flex gap-2">
				{['7', '30', '90'].map((s) => (
					<Link
						key={s}
						href={`/ptp/rapor?aralik=${s}`}
						className={`border px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.06em] transition-colors ${
							String(gun) === s
								? 'border-vurgu-metin bg-vurgu-metin text-zemin'
								: 'border-kenarlik text-metin-3 hover:border-metin hover:text-metin'
						}`}
					>
						{s} gün
					</Link>
				))}
			</div>

			{toplamGorev === 0 ? (
				<div className="kose-nisan mt-8 border border-kenarlik p-8 text-center">
					<span className="etiket">Veri yok</span>
					<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
						Bu aralıkta görev kaydı bulunmuyor. Görevler oluşturulup
						kullanılmaya başlandığında rapor dolar.
					</p>
				</div>
			) : (
				<>
					{/* — Genel — */}
					<div className="kose-nisan mt-8 grid gap-6 border border-kenarlik p-6 sm:grid-cols-3">
						<Kutu etiket="Tamamlanma" deger={`%${genelOran}`} />
						<Kutu etiket="Toplam görev" deger={String(toplamGorev)} />
						<Kutu
							etiket="Atlanan"
							deger={String(gunler.reduce((t, g) => t + Number(g.atlanan), 0))}
						/>
					</div>

					{/* — Kişi performansı — */}
					<section className="mt-12">
						<span className="etiket">Kişi bazında</span>
						<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
							Kim ne yaptı
						</h2>

						<div className="mt-4 overflow-x-auto">
							<table className="w-full min-w-[36rem] border-t border-kenarlik text-sm">
								<thead>
									<tr className="border-b border-kenarlik">
										<Th>Kişi</Th>
										<Th sag>Atanan</Th>
										<Th sag>Yaptı</Th>
										<Th sag>Atladı</Th>
										<Th sag>Bekleyen</Th>
										<Th sag>Tekrar</Th>
										<Th sag>Ort. saat</Th>
									</tr>
								</thead>
								<tbody>
									{kisiler.map((k) => (
										<tr key={k.kullanici_id} className="border-b border-kenarlik-2">
											<td className="py-3 pr-4 font-medium">{k.ad}</td>
											<Td>{k.atanan}</Td>
											<Td renk="text-basarili">{k.tamamlanan}</Td>
											<Td renk={Number(k.atlanan) > 0 ? 'text-uyari' : undefined}>
												{k.atlanan}
											</Td>
											<Td>{k.bekleyen}</Td>
											<Td>{k.tekrar_sayisi}</Td>
											<Td>{saatBicimi(k.ort_saat)}</Td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<p className="mt-3 text-sm leading-relaxed text-metin-3">
							“Tekrar”, gün içinde birden çok kez yapılan görevlerin toplam
							yapılış sayısı. “Ort. saat”, görevlerin ortalama kapatılma saati.
						</p>
					</section>

					{/* — En çok atlanan görevler — */}
					<section className="mt-12">
						<span className="etiket">Görev bazında</span>
						<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
							Hangi görev aksıyor
						</h2>

						<div className="mt-4 overflow-x-auto">
							<table className="w-full min-w-[36rem] border-t border-kenarlik text-sm">
								<thead>
									<tr className="border-b border-kenarlik">
										<Th>Görev</Th>
										<Th sag>Toplam</Th>
										<Th sag>Yapıldı</Th>
										<Th sag>Atlandı</Th>
										<Th sag>Oran</Th>
									</tr>
								</thead>
								<tbody>
									{gorevler.map((g) => (
										<tr key={g.baslik} className="border-b border-kenarlik-2">
											<td className="py-3 pr-4">
												<span className={g.zorunlu ? 'font-medium' : ''}>
													{g.baslik}
												</span>
												<span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-3">
													{GRUP_ADLARI[g.grup] ?? g.grup}
												</span>
											</td>
											<Td>{g.toplam}</Td>
											<Td>{g.tamamlanan}</Td>
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
									))}
								</tbody>
							</table>
						</div>
					</section>

					{/* — Atlanma sebepleri — */}
					{atlananlar.length > 0 && (
						<section className="mt-12">
							<span className="etiket">Sebepler</span>
							<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
								Neden yapılamadı
							</h2>
							<p className="mt-2 max-w-lg text-sm leading-relaxed text-metin-2">
								Sayıdan çok bunlar işe yarar: aynı sebep tekrarlıyorsa
								çözülecek bir sorun var demektir.
							</p>

							<ul className="mt-4 border-t border-kenarlik">
								{atlananlar.slice(0, 30).map((a, i) => (
									<li key={i} className="border-b border-kenarlik-2 py-3">
										<p className="text-sm font-medium">{a.baslik}</p>
										<p className="mt-1 text-sm text-uyari">{a.sebep}</p>
										<p className="mt-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
											{a.tarih}
											{a.kisi && ` · ${a.kisi}`}
										</p>
									</li>
								))}
							</ul>
						</section>
					)}

					{/* — Gün gün — */}
					<section className="mt-12">
						<span className="etiket">Gün gün</span>
						<h2 className="mt-3 text-xl font-semibold tracking-[-0.015em]">
							Tamamlanma eğilimi
						</h2>

						<ul className="mt-4 border-t border-kenarlik">
							{gunler.map((g) => (
								<li
									key={g.tarih}
									className="flex items-center gap-4 border-b border-kenarlik-2 py-3"
								>
									<span className="w-44 shrink-0 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
										{tarihiBicimle(g.tarih)}
									</span>

									{/* Çubuk grafik: yüzdeyi tek bakışta okumak için */}
									<span
										className="h-3 flex-1 bg-zemin-3"
										role="img"
										aria-label={`%${g.oran ?? 0} tamamlandı`}
									>
										<span
											className="block h-full bg-vurgu-metin"
											style={{ width: `${g.oran ?? 0}%` }}
										/>
									</span>

									<span className="w-24 shrink-0 text-right font-mono text-[0.75rem] text-metin-2">
										%{g.oran ?? 0}
										<span className="ml-2 text-metin-3">
											{g.tamamlanan}/{g.toplam}
										</span>
									</span>
								</li>
							))}
						</ul>
					</section>
				</>
			)}
		</div>
	);
}

function Kutu({ etiket, deger }: { etiket: string; deger: string }) {
	return (
		<div>
			<span className="etiket">{etiket}</span>
			<p className="mt-2 text-3xl font-semibold tracking-[-0.02em]">{deger}</p>
		</div>
	);
}

function Th({ children, sag }: { children: React.ReactNode; sag?: boolean }) {
	return (
		<th
			scope="col"
			className={`py-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.08em] text-metin-3 ${
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
	/* Sayılar font-mono: değişken genişlikli rakam sütunu hizasız görünür. */
	return (
		<td className={`py-3 pl-4 text-right font-mono ${renk ?? 'text-metin-2'}`}>
			{children}
		</td>
	);
}
