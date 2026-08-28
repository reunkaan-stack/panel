import type { Metadata } from 'next';
import Link from 'next/link';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle } from '@/lib/yetki';
import { kisaTarih } from '@/lib/ortak/tarih';
import { paraBicimle } from '@/lib/ortak/para';
import { DURUM_ADLARI, toplamlar, type TeklifDurumu } from '@/lib/teklif';
import { YeniTeklif } from './bilesenler/YeniTeklif';

export const metadata: Metadata = { title: 'Teklifler — Karas Panel' };
export const dynamic = 'force-dynamic';

type Satir = {
	id: string;
	no: string;
	musteri_ad: string;
	musteri_firma: string;
	baslik: string;
	tarih: string;
	gecerlilik: string | null;
	indirim: number;
	kdv_orani: number;
	durum: TeklifDurumu;
	teklif_kalemleri: { miktar: number; birim_fiyat: number }[];
};

const DURUM_RENGI: Record<TeklifDurumu, string> = {
	taslak: 'text-metin-3',
	gonderildi: 'text-vurgu-metin',
	kabul: 'text-basarili',
	red: 'text-metin-3',
};

export default async function TeklifListesi() {
	await superadminDenetle();
	const supabase = await sunucuIstemcisi();

	const { data, error } = await supabase
		.from('teklifler')
		.select('*, teklif_kalemleri(miktar, birim_fiyat)')
		.is('silindi', null)
		.order('tarih', { ascending: false })
		.order('no', { ascending: false });

	const teklifler = (data ?? []) as unknown as Satir[];
	const bugun = new Date().toISOString().slice(0, 10);

	return (
		<div className="mx-auto max-w-4xl px-6 py-10">
			<Link href="/" className="etiket text-metin-3 hover:text-metin">
				← Panel
			</Link>

			<span className="etiket mt-6 block text-vurgu-metin">Süperadmin</span>

			<div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-[-0.015em]">Teklifler</h1>
				<YeniTeklif />
			</div>

			<p className="mt-2 max-w-xl text-sm leading-relaxed text-metin-2">
				Müşteri adayına fiyat teklifi hazırlarsınız; kalemleri düzenleyip
				yazdırma ekranından PDF olarak kaydeder, e-postayla gönderirsiniz.
			</p>

			{error && (
				<p className="mt-6 border border-hata px-4 py-3 text-sm text-hata">
					Teklifler okunamadı. Migration çalıştırıldı mı?
				</p>
			)}

			{teklifler.length === 0 && !error ? (
				<div className="kose-nisan mt-8 border border-kenarlik p-8 text-center">
					<span className="etiket">Teklif yok</span>
					<p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-metin-2">
						“Yeni teklif” ile başlayın. Hazır kalemlerle açılır; başlıkları ve
						fiyatları düzenlersiniz.
					</p>
				</div>
			) : (
				<ul className="mt-8 border-t border-kenarlik">
					{teklifler.map((t) => {
						const hesap = toplamlar(
							t.teklif_kalemleri ?? [],
							Number(t.indirim),
							Number(t.kdv_orani)
						);
						const gecti = !!t.gecerlilik && t.gecerlilik < bugun;

						return (
							<li key={t.id} className="border-b border-kenarlik-2">
								<Link
									href={`/teklifler/${t.id}`}
									className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4 transition-colors hover:bg-zemin-2"
								>
									<span className="w-20 shrink-0 font-mono text-[0.6875rem] tracking-[0.08em] text-metin-3">
										{t.no}
									</span>

									<div className="min-w-40 flex-1">
										<p className="font-medium">
											{t.musteri_firma || t.musteri_ad || 'Alıcı girilmedi'}
										</p>
										<p className="mt-0.5 text-sm text-metin-2">{t.baslik}</p>
									</div>

									<span className="tabular-nums font-medium">
										{paraBicimle(hesap.genelToplam)}
									</span>

									<span
										className={`w-24 shrink-0 text-right font-mono text-[0.6875rem] uppercase tracking-[0.08em] ${DURUM_RENGI[t.durum]}`}
									>
										{DURUM_ADLARI[t.durum]}
									</span>

									<span className="w-full font-mono text-[0.6875rem] tracking-[0.04em] text-metin-3">
										{kisaTarih(t.tarih)}
										{t.gecerlilik &&
											` · geçerlilik ${kisaTarih(t.gecerlilik)}${gecti ? ' (doldu)' : ''}`}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
