import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { modulSeviyesi } from '@/lib/yetki';
import { firmaCoz, gunlukYaz, odemeyeCevir, senkronOdendi } from '@/lib/otp/veri';

/* POST /api/otp/payments/<id>/durum — çek durumunu değiştirir.

   PORTFOYDE'ye dönerken hedef temizleniyor: çek kasaya döndüyse
   "kime ciro edildi" bilgisi artık yanlış. Yerel programın kuralı. */

export const dynamic = 'force-dynamic';

/** Programdaki tr_upper: Türkçe i'yi doğru büyütür. */
function trBuyuk(s: string): string {
	return String(s).replace(/i/g, 'İ').replace(/ı/g, 'I').toUpperCase();
}

export async function POST(
	istek: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const seviye = await modulSeviyesi('otp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') {
			return NextResponse.json({ error: 'yetkisiz' }, { status: 403 });
		}

		const { id } = await params;
		const govde = (await istek.json()) as {
			sirket?: string;
			durum?: string;
			hedef?: string;
		};

		const firma = await firmaCoz(String(govde.sirket ?? ''));
		if (!firma) {
			return NextResponse.json(
				{ error: 'geçersiz veya yetkisiz şirket' },
				{ status: 403 }
			);
		}

		const supabase = await sunucuIstemcisi();
		const { data: p } = await supabase
			.from('otp_odemeler')
			.select('id, yon, durum, tutar, hedef')
			.eq('id', id)
			.eq('firma_id', firma.id)
			.is('silindi', null)
			.maybeSingle();

		if (!p) return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });

		const durum = govde.durum ?? p.durum;
		let hedef = p.hedef;
		if (govde.hedef !== undefined) {
			hedef = trBuyuk(String(govde.hedef).trim().replace(/\s+/g, ' '));
		}
		if (durum === 'PORTFOYDE') hedef = '';

		const { data, error } = await supabase
			.from('otp_odemeler')
			.update({
				durum,
				hedef,
				...senkronOdendi(p.yon, durum, Number(p.tutar)),
			})
			.eq('id', id)
			.eq('firma_id', firma.id)
			.select('*')
			.single();

		if (error) throw error;

		await gunlukYaz(firma.id, 'ÇEK DURUMU DEĞİŞTİ', id, {
			eski: p.durum,
			yeni: durum,
			hedef,
		});

		return NextResponse.json(odemeyeCevir(data));
	} catch (e) {
		console.error('[otp/durum]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}
