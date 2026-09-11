import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle } from '@/lib/yetki';
import { kisaTarih, saatiBicimle } from '@/lib/ortak/tarih';
import type { Modul } from '@/lib/tipler';

export const metadata: Metadata = { title: 'Genel bakış — Karas Panel' };
export const dynamic = 'force-dynamic';

/* Süperadmin genel bakışı — şimdilik yalnızca FİRMA DURUMU.

   Kapsamı bilerek dar: hangi firmada hangi modül açık, kaç kişi var,
   en son ne zaman kullanılmış. "Kim sistemi gerçekten kullanıyor"
   sorusunun cevabı.

   Operasyon ve para özetleri sonraki adımda eklenecek; her modül
   büyüdükçe buraya kendi bölümünü ekler. */

const MODUL_ADLARI: Record<Modul, string> = {
	ptp: 'Personel Takip',
	otp: 'Ödeme Takip',
	ttp: 'Tahsilat Takip',
	mtp: 'Mağaza Takip',
	edp: 'Excel Dosya Yükleme',
};

export default async function RaporSayfasi() {
	await superadminDenetle();
	const supabase = await sunucuIstemcisi();

	const [firmaSonuc, modulSonuc, kisiSonuc] = await Promise.all([
		supabase
			.from('firmalar')
			.select('id, ad, kisa_ad, aktif, olusturuldu')
			.is('silindi', null)
			.order('ad'),
		supabase.from('firma_modulleri').select('firma_id, modul, aktif'),
		supabase
			.from('kullanicilar')
			.select('firma_id, ad, rol, aktif, son_giris')
			.is('silindi', null),
	]);

	type Firma = {
		id: string;
		ad: string;
		kisa_ad: string;
		aktif: boolean;
		olusturuldu: string;
	};
	type FirmaModul = { firma_id: string; modul: Modul; aktif: boolean };
	type Kisi = {
		firma_id: string | null;
		ad: string;
		rol: string;
		aktif: boolean;
		son_giris: string | null;
	};

	const firmalar = (firmaSonuc.data ?? []) as Firma[];
	const modulSatirlari = (modulSonuc.data ?? []) as FirmaModul[];
	const kisiler = (kisiSonuc.data ?? []) as Kisi[];

	const satirlar = firmalar.map((f) => {
		const kendi = kisiler.filter((k) => k.firma_id === f.id);
		const girisler = kendi
			.filter((k) => k.son_giris)
			.sort((a, b) => (b.son_giris ?? '').localeCompare(a.son_giris ?? ''));

		return {
			firma: f,
			moduller: modulSatirlari
				.filter((m) => m.firma_id === f.id && m.aktif)
				.map((m) => m.modul),
			kisi: kendi.length,
			aktifKisi: kendi.filter((k) => k.aktif).length,
			sonGirisKisi: girisler[0] ?? null,
		};
	});

	/* Süperadminler firmaya bağlı değil; ayrı sayılıyor ki firma
	   sayıları yanlış görünmesin. */
	const superadminler = kisiler.filter((k) => k.rol === 'superadmin');

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/ayarlar" className="etiket text-metin-3 hover:text-metin">
				← Ayarlar
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Süperadmin</span>
			<h1 className="mt-3 text-2xl font-semibold tracking-[-0.015em]">
				Genel bakış
			</h1>
			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Bütün firmaların durumu. Kimin hangi modülü aldığı, kaç kişinin
				kullandığı ve en son ne zaman girildiği.
			</p>

			{/* ---- Özet ---- */}
			<div className="mt-8 grid grid-cols-2 gap-px border border-kenarlik bg-kenarlik sm:grid-cols-4">
				<Ozet
					etiket="Firma"
					deger={String(satirlar.filter((s) => s.firma.aktif).length)}
					alt={`${firmalar.length} kayıtlı`}
				/>
				<Ozet
					etiket="Kullanıcı"
					deger={String(kisiler.filter((k) => k.aktif).length)}
					alt={`${superadminler.length} süperadmin dahil`}
				/>
				<Ozet
					etiket="Açık modül"
					deger={String(modulSatirlari.filter((m) => m.aktif).length)}
					alt="firma × modül"
				/>
				<Ozet
					etiket="Hiç girilmemiş"
					deger={String(satirlar.filter((s) => !s.sonGirisKisi).length)}
					alt="firma"
				/>
			</div>

			{/* ---- Firmalar ---- */}
			<div className="mt-10">
				<span className="etiket">Firmalar</span>

				<ul className="mt-3 border-t border-kenarlik">
					{satirlar.map((s) => (
						<li key={s.firma.id} className="border-b border-kenarlik-2 py-4">
							<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
								<span
									className={`font-medium ${s.firma.aktif ? '' : 'text-metin-3 line-through'}`}
								>
									{s.firma.ad}
								</span>
								<span className="font-mono text-[0.6875rem] tracking-[0.08em] text-metin-3">
									{s.firma.kisa_ad}
								</span>
								<span className="min-w-0 flex-1" />
								<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
									{s.aktifKisi} kişi
								</span>
							</div>

							<div className="mt-2 flex flex-wrap gap-2">
								{s.moduller.length > 0 ? (
									s.moduller.map((m) => (
										<span
											key={m}
											className="border border-kenarlik px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-metin-2"
										>
											{MODUL_ADLARI[m]}
										</span>
									))
								) : (
									<span className="font-mono text-[0.6875rem] tracking-[0.04em] text-uyari">
										hiç modül açılmamış
									</span>
								)}
							</div>

							<p className="mt-2 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
								{s.sonGirisKisi?.son_giris ? (
									<>
										son giriş {kisaTarih(s.sonGirisKisi.son_giris)}{' '}
										{saatiBicimle(s.sonGirisKisi.son_giris)} ·{' '}
										{s.sonGirisKisi.ad}
									</>
								) : (
									<span className="text-uyari">
										hiç giriş yapılmamış · {kisaTarih(s.firma.olusturuldu)}{' '}
										tarihinde eklendi
									</span>
								)}
							</p>
						</li>
					))}
				</ul>

				{satirlar.length === 0 && (
					<div className="kose-nisan mt-3 border border-kenarlik p-8 text-center">
						<span className="etiket">Firma yok</span>
						<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
							Ayarlar › Firmalar ekranından ilk firmayı ekleyin.
						</p>
					</div>
				)}
			</div>

			<p className="mt-8 max-w-xl text-sm leading-relaxed text-metin-3">
				Bu sayfa şimdilik yalnızca firma durumunu gösteriyor. Modüller
				büyüdükçe operasyon ve para özetleri de buraya eklenecek.
			</p>
		</div>
	);
}

function Ozet({
	etiket,
	deger,
	alt,
}: {
	etiket: string;
	deger: string;
	alt: string;
}) {
	return (
		<div className="bg-zemin p-4">
			<span className="etiket">{etiket}</span>
			<p className="mt-2 text-xl font-semibold tracking-[-0.015em]">{deger}</p>
			<p className="mt-1 font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
				{alt}
			</p>
		</div>
	);
}
