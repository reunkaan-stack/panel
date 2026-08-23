import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { yetkiDenetle } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';
import {
	ayAdi,
	ayGecerli,
	ayKaydir,
	aydakiGun,
	buAy,
	bugun,
} from '@/lib/ortak/tarih';
import { paraBicimle } from '@/lib/ortak/para';
import { ayinMaasi, kademeTutari, primHesapla } from '@/lib/prim';
import type {
	Hedef,
	Maas,
	PrimKademesi,
	PtpAyarlari,
} from '@/lib/tipler';
import { PrimAyarlari } from './bilesenler/PrimAyarlari';

export const metadata: Metadata = { title: 'Prim — Karas Panel' };
export const dynamic = 'force-dynamic';

export default async function PrimSayfasi({
	searchParams,
}: {
	searchParams: Promise<{ ay?: string }>;
}) {
	await yetkiDenetle('ptp', 'yonetim');

	const { ay: istenenAy } = await searchParams;
	const ay = ayGecerli(istenenAy) ? istenenAy : buAy();
	const sonGun = `${ay}-${String(aydakiGun(ay)).padStart(2, '0')}`;

	const firmaId = await islemFirmasi();
	const supabase = await sunucuIstemcisi();

	const [ciroSonuc, hedefSonuc, kademeSonuc, maasSonuc, kisiSonuc, ayarSonuc] =
		await Promise.all([
			supabase
				.from('ptp_cirolar')
				.select('tutar, net_tutar')
				.eq('firma_id', firmaId)
				.gte('tarih', `${ay}-01`)
				.lte('tarih', sonGun)
				.is('silindi', null),

			supabase
				.from('ptp_hedefler')
				.select('*')
				.eq('firma_id', firmaId)
				.eq('ay', `${ay}-01`)
				.maybeSingle(),

			supabase
				.from('ptp_prim_kademeleri')
				.select('*')
				.eq('firma_id', firmaId)
				.order('oran'),

			supabase
				.from('ptp_maaslar')
				.select('*')
				.eq('firma_id', firmaId)
				.lte('gecerli_ay', `${ay}-01`),

			supabase
				.from('kullanicilar')
				.select('id, ad')
				.eq('firma_id', firmaId)
				.eq('aktif', true)
				.is('silindi', null)
				.order('ad'),

			supabase
				.from('ptp_ayarlar')
				.select('*')
				.eq('firma_id', firmaId)
				.maybeSingle(),
		]);

	const cirolar = (ciroSonuc.data ?? []) as { tutar: number; net_tutar: number }[];
	const kademeler = (kademeSonuc.data ?? []) as PrimKademesi[];
	const maaslar = (maasSonuc.data ?? []) as Maas[];
	const kisiler = (kisiSonuc.data ?? []) as { id: string; ad: string }[];
	const ayar = (ayarSonuc.data ?? null) as PtpAyarlari | null;
	const hedefKaydi = (hedefSonuc.data ?? null) as Hedef | null;

	const brut = cirolar.reduce((t, c) => t + Number(c.tutar), 0);
	const net = cirolar.reduce((t, c) => t + Number(c.net_tutar), 0);
	const hedef = Number(hedefKaydi?.hedef ?? ayar?.varsayilan_hedef ?? 0);

	/* Prim kişi başı: her personel kendi maaşıyla kendi hesabını alır.
	   Sabit kademeler herkeste aynı, maaş katı olanlar kişiye göre
	   değişir. */
	const satirlar = kisiler.map((kisi) => {
		const maas = ayinMaasi(
			maaslar.filter((m) => m.kullanici_id === kisi.id),
			ay
		);
		return { kisi, maas, hesap: primHesapla(net, hedef, kademeler, maas) };
	});

	const toplamPrim = satirlar.reduce((t, s) => t + s.hesap.primTutari, 0);

	/* Kademeler herkeste aynı orana düşüyor; ilerleme çubuğu ve "ne
	   kadar kaldı" için bir örnek yeterli. */
	const ornek = satirlar[0]?.hesap ?? primHesapla(net, hedef, kademeler, 0);

	const gecenGun =
		ay > buAy() ? 0 : ay === buAy() ? Number(bugun().slice(8, 10)) : aydakiGun(ay);
	/* Bu hızla ay sonunda nereye varır: yöneticinin asıl sorusu bu. */
	const tahmin =
		gecenGun > 0 ? (net / gecenGun) * aydakiGun(ay) : 0;
	const tahminHesap = primHesapla(
		tahmin,
		hedef,
		kademeler,
		satirlar[0]?.maas ?? 0
	);

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/ptp" className="etiket text-metin-3 hover:text-metin">
				← Görevler
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Prim</span>

			<div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-[-0.015em]">
					{ayAdi(ay)}
				</h1>
				<div className="flex gap-2">
					<Link
						href={`/ptp/prim?ay=${ayKaydir(ay, -1)}`}
						className="dugme dugme-bos !px-3 !py-1.5"
					>
						← {ayAdi(ayKaydir(ay, -1)).split(' ')[0]}
					</Link>
					{ay < buAy() && (
						<Link
							href={`/ptp/prim?ay=${ayKaydir(ay, 1)}`}
							className="dugme dugme-bos !px-3 !py-1.5"
						>
							{ayAdi(ayKaydir(ay, 1)).split(' ')[0]} →
						</Link>
					)}
				</div>
			</div>

			{hedef === 0 ? (
				<p className="mt-8 border border-uyari px-4 py-3 text-sm text-metin-2">
					Bu ay için hedef girilmemiş. Aşağıdaki ayarlardan girin, prim hesabı
					ondan sonra çalışır.
				</p>
			) : (
				<>
					{/* ---- Durum ---- */}
					<div className="mt-8 border border-kenarlik p-5">
						<div className="flex flex-wrap items-baseline justify-between gap-3">
							<span className="etiket">Net ciro / hedef</span>
							<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
								brüt {paraBicimle(brut)} · KDV %{ayar?.kdv_orani ?? 20}
							</span>
						</div>

						<p className="mt-3 text-3xl font-semibold tracking-[-0.02em] tabular-nums">
							{paraBicimle(net)}
							<span className="ml-2 text-lg font-normal text-metin-3">
								/ {paraBicimle(hedef)}
							</span>
						</p>

						{/* İlerleme: %100'ü aşarsa çubuk dolu kalır, sayı gerçeği söyler */}
						<div
							className="mt-4 h-2 w-full bg-zemin-2"
							role="img"
							aria-label={`Gerçekleşme yüzde ${Math.round(ornek.gerceklesme)}`}
						>
							<div
								className="h-full bg-vurgu-metin"
								style={{ width: `${Math.min(100, ornek.gerceklesme)}%` }}
							/>
						</div>

						<div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
							<span className="font-mono text-sm tracking-[0.04em]">
								%{ornek.gerceklesme.toFixed(1)} gerçekleşme
							</span>
							<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
								{gecenGun} / {aydakiGun(ay)} gün
							</span>
						</div>

						<div className="mt-5 grid gap-4 border-t border-kenarlik-2 pt-4 sm:grid-cols-3">
							<div>
								<span className="etiket">Şu anki kademe</span>
								<p className="mt-1.5 font-medium">
									{ornek.ulasilan ? `%${ornek.ulasilan.oran}` : 'Kademe yok'}
								</p>
							</div>
							<div>
								<span className="etiket">Hak edilen prim</span>
								<p className="mt-1.5 font-medium text-basarili">
									{paraBicimle(toplamPrim)}
								</p>
							</div>
							<div>
								<span className="etiket">Bu hızla ay sonu</span>
								<p className="mt-1.5 font-medium">
									{tahmin > 0
										? `%${tahminHesap.gerceklesme.toFixed(0)} · ${
												tahminHesap.ulasilan
													? paraBicimle(tahminHesap.primTutari)
													: 'prim yok'
											}`
										: '—'}
								</p>
							</div>
						</div>

						{ornek.sonraki && (
							<p className="mt-4 border-t border-kenarlik-2 pt-4 text-sm text-metin-2">
								Bir üst kademe <strong>%{ornek.sonraki.oran}</strong> —{' '}
								{paraBicimle(ornek.kalan)} net ciro kaldı
								{ornek.sonrakiPrim > ornek.primTutari && (
									<>
										, prim{' '}
										<strong className="text-basarili">
											{paraBicimle(ornek.sonrakiPrim - ornek.primTutari)}
										</strong>{' '}
										artar
									</>
								)}
								.
							</p>
						)}
					</div>

					{/* ---- Kişiler ---- */}
					{satirlar.length > 0 && (
						<div className="mt-8">
							<span className="etiket">Kişi başı</span>
							<ul className="mt-3 border-t border-kenarlik">
								{satirlar.map(({ kisi, maas, hesap }) => (
									<li
										key={kisi.id}
										className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-kenarlik-2 py-3"
									>
										<span className="min-w-32 flex-1 font-medium">
											{kisi.ad}
										</span>
										<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
											maaş {maas > 0 ? paraBicimle(maas) : 'girilmedi'}
										</span>
										<span className="tabular-nums font-medium text-basarili">
											{paraBicimle(hesap.primTutari)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}

					{/* ---- Kademe tablosu ---- */}
					<div className="mt-8">
						<span className="etiket">Kademeler</span>
						<ul className="mt-3 border-t border-kenarlik">
							{[...kademeler]
								.sort((a, b) => a.oran - b.oran)
								.map((k) => {
									const ulasildi = ornek.gerceklesme + 1e-9 >= k.oran;
									const suanki = ornek.ulasilan?.id === k.id;
									return (
										<li
											key={k.id}
											className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-kenarlik-2 py-2.5 ${
												suanki ? 'bg-zemin-2 px-3' : ''
											}`}
										>
											<span
												className={`w-14 font-mono text-sm tracking-[0.04em] ${
													ulasildi ? 'text-basarili' : 'text-metin-3'
												}`}
											>
												%{k.oran}
											</span>
											<span className="w-36 tabular-nums text-sm text-metin-2">
												{paraBicimle((hedef * k.oran) / 100)}
											</span>
											<span className="flex-1 text-sm">
												{k.tur === 'sabit'
													? paraBicimle(Number(k.tutar))
													: `${Number(k.kat)} maaş`}
												{k.tur === 'maas_kati' && satirlar[0] && (
													<span className="ml-2 font-mono text-[0.6875rem] text-metin-3">
														= {paraBicimle(kademeTutari(k, satirlar[0].maas))}
													</span>
												)}
											</span>
											{suanki && (
												<span className="etiket text-vurgu-metin">şu an</span>
											)}
										</li>
									);
								})}
						</ul>
						<p className="mt-3 text-sm text-metin-3">
							Kademe basamaklıdır: %89 gerçekleşmede %80 kademesinin primi
							ödenir, ara değer hesaplanmaz.
						</p>
					</div>
				</>
			)}

			{/* ---- Ayarlar ---- */}
			<div className="mt-12">
				<PrimAyarlari
					ay={ay}
					hedef={hedefKaydi}
					varsayilanHedef={Number(ayar?.varsayilan_hedef ?? 0)}
					kdvOrani={Number(ayar?.kdv_orani ?? 20)}
					kademeler={kademeler}
					kisiler={kisiler}
					maaslar={maaslar}
				/>
			</div>
		</div>
	);
}
