import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { aktifKullanici, modulSeviyesi } from '@/lib/yetki';
import {
	firmaCoz,
	gunlukYaz,
	kolonlaraCevir,
	odemeyeCevir,
	otpFirmalari,
	senkronOdendi,
	yeniKimlik,
} from '@/lib/otp/veri';

/* GET  /api/otp/payments?sirket=...  → tüm veri + oturum bilgisi
   POST /api/otp/payments             → yeni kayıt

   Yanıt biçimi yerel programla BİREBİR aynı; arayüz değişmedi.
   Değişen tek şey verinin nereden geldiği. */

export const dynamic = 'force-dynamic';

const SURUM = '2.0';

function yetkisiz() {
	return NextResponse.json(
		{ error: 'geçersiz veya yetkisiz şirket' },
		{ status: 403 }
	);
}

export async function GET(istek: Request) {
	try {
		const kullanici = await aktifKullanici();
		const seviye = await modulSeviyesi('otp');
		if (!seviye) return yetkisiz();

		const istenen = new URL(istek.url).searchParams.get('sirket') ?? '';
		const firma = await firmaCoz(istenen);
		if (!firma) return yetkisiz();

		const supabase = await sunucuIstemcisi();

		const [odemeSonuc, krediSonuc, taksitSonuc] = await Promise.all([
			supabase
				.from('otp_odemeler')
				.select('*')
				.eq('firma_id', firma.id)
				.is('silindi', null)
				.order('tarih', { ascending: false }),

			supabase
				.from('otp_krediler')
				.select('id, kod, ad, banka')
				.eq('firma_id', firma.id)
				.is('silindi', null)
				.order('kod'),

			supabase
				.from('otp_taksitler')
				.select('kredi_id, no, vade, tutar, odenen, kalan, anapara, faiz, bsmv')
				.eq('firma_id', firma.id)
				.order('no'),
		]);

		if (odemeSonuc.error) throw odemeSonuc.error;

		/* Taksitler kredinin içine geri konuyor: arayüz onları böyle
		   bekliyor. Tabloda ayrı durmaları raporlama içindi. */
		type Taksit = {
			kredi_id: string;
			no: number;
			vade: string;
			tutar: number;
			odenen: number;
			kalan: number;
			anapara: number;
			faiz: number;
			bsmv: number;
		};
		const taksitler = (taksitSonuc.data ?? []) as Taksit[];

		const krediler = (krediSonuc.data ?? []).map((k) => ({
			kod: k.kod,
			ad: k.ad,
			banka: k.banka,
			taksitler: taksitler
				.filter((t) => t.kredi_id === k.id)
				.map(({ kredi_id: _atla, ...t }) => ({
					no: Number(t.no),
					vade: t.vade,
					tutar: Number(t.tutar),
					odenen: Number(t.odenen),
					kalan: Number(t.kalan),
					anapara: Number(t.anapara),
					faiz: Number(t.faiz),
					bsmv: Number(t.bsmv),
				})),
		}));

		const firmalar = await otpFirmalari();

		return NextResponse.json({
			payments: (odemeSonuc.data ?? []).map(odemeyeCevir),
			krediler,
			oturum: {
				kullanici: kullanici.ad,
				rol: seviye === 'yonetim' ? 'admin' : 'kullanici',
			},
			surum: SURUM,
			sirketAktif: firma.kod,
			sirketler: firmalar.map((f) => ({ kod: f.kod, ad: f.ad })),
		});
	} catch (e) {
		console.error('[otp/payments GET]', e);
		return NextResponse.json({ error: 'okunamadı' }, { status: 500 });
	}
}

export async function POST(istek: Request) {
	try {
		const seviye = await modulSeviyesi('otp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') return yetkisiz();

		const govde = (await istek.json()) as Record<string, unknown>;
		const firma = await firmaCoz(String(govde.sirket ?? ''));
		if (!firma) return yetkisiz();

		const kolonlar = kolonlaraCevir(govde);

		/* Varsayılanlar programdaki sırayla: yön yoksa VERILEN, durum
		   yoksa yöne göre BEKLIYOR / PORTFOYDE. */
		const yon = String(kolonlar.yon ?? 'VERILEN');
		const durum = String(
			kolonlar.durum ?? (yon === 'VERILEN' ? 'BEKLIYOR' : 'PORTFOYDE')
		);
		const tutar = Number(kolonlar.tutar ?? 0);

		const satir = {
			id: yeniKimlik(),
			firma_id: firma.id,
			yon,
			tur: String(kolonlar.tur ?? 'ÇEK'),
			durum,
			tarih: kolonlar.tarih,
			firma: String(kolonlar.firma ?? ''),
			borclu: String(kolonlar.borclu ?? ''),
			banka: String(kolonlar.banka ?? ''),
			hedef: String(kolonlar.hedef ?? ''),
			tutar,
			seri_no: String(kolonlar.seri_no ?? ''),
			not_metni: String(kolonlar.not_metni ?? ''),
			...senkronOdendi(yon, durum, tutar),
		};

		const supabase = await sunucuIstemcisi();
		const { data, error } = await supabase
			.from('otp_odemeler')
			.insert(satir)
			.select('*')
			.single();

		if (error) throw error;

		await gunlukYaz(firma.id, 'KAYIT EKLENDİ', satir.id, {
			firma: satir.firma,
			tutar: satir.tutar,
			tarih: satir.tarih,
		});

		return NextResponse.json(odemeyeCevir(data));
	} catch (e) {
		console.error('[otp/payments POST]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}
