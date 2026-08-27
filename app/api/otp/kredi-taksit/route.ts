import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { modulSeviyesi } from '@/lib/yetki';
import { firmaCoz, gunlukYaz } from '@/lib/otp/veri';

/* POST /api/otp/kredi-taksit — taksidi ödendi / geri al.

   Yerel programın kuralı aynen: kalan varsa tamamı ödenmiş sayılır,
   kalan yoksa geri alınır. Kısmi ödeme yok. */

export const dynamic = 'force-dynamic';

export async function POST(istek: Request) {
	try {
		const seviye = await modulSeviyesi('otp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') {
			return NextResponse.json({ error: 'yetkisiz' }, { status: 403 });
		}

		const govde = (await istek.json()) as {
			sirket?: string;
			kod?: string;
			ad?: string;
			no?: number;
			vade?: string;
		};

		const firma = await firmaCoz(String(govde.sirket ?? ''));
		if (!firma) {
			return NextResponse.json(
				{ error: 'geçersiz veya yetkisiz şirket' },
				{ status: 403 }
			);
		}

		const supabase = await sunucuIstemcisi();

		const { data: kredi } = await supabase
			.from('otp_krediler')
			.select('id, kod')
			.eq('firma_id', firma.id)
			.eq('kod', govde.kod ?? '')
			.is('silindi', null)
			.maybeSingle();

		if (!kredi) return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });

		const { data: t } = await supabase
			.from('otp_taksitler')
			.select('id, no, vade, tutar, odenen, kalan, anapara, faiz, bsmv')
			.eq('kredi_id', kredi.id)
			.eq('no', govde.no ?? -1)
			.eq('vade', govde.vade ?? '')
			.maybeSingle();

		if (!t) return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });

		const odenmis = Number(t.kalan) > 0.01;
		const yeni = odenmis
			? { odenen: Number(t.tutar), kalan: 0 }
			: { odenen: 0, kalan: Number(t.tutar) };

		const { data, error } = await supabase
			.from('otp_taksitler')
			.update(yeni)
			.eq('id', t.id)
			.select('no, vade, tutar, odenen, kalan, anapara, faiz, bsmv')
			.single();

		if (error) throw error;

		await gunlukYaz(
			firma.id,
			odenmis ? 'KREDİ TAKSİDİ ÖDENDİ' : 'KREDİ TAKSİDİ GERİ ALINDI',
			kredi.id,
			{ kod: kredi.kod, no: t.no, vade: t.vade, tutar: Number(t.tutar) }
		);

		return NextResponse.json({
			no: Number(data.no),
			vade: data.vade,
			tutar: Number(data.tutar),
			odenen: Number(data.odenen),
			kalan: Number(data.kalan),
			anapara: Number(data.anapara),
			faiz: Number(data.faiz),
			bsmv: Number(data.bsmv),
		});
	} catch (e) {
		console.error('[otp/kredi-taksit]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}
