import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { modulSeviyesi } from '@/lib/yetki';
import { firmaCoz, gunlukYaz, odemeyeCevir, senkronOdendi } from '@/lib/otp/veri';

/* POST /api/otp/payments/<id>/toggle — ödendi işaretini çevirir.

   Kural yerel programla aynı: ödenmişse yöne göre BEKLIYOR/PORTFOYDE'ye
   döner, ödenmemişse ODENDI/TAHSIL olur. */

export const dynamic = 'force-dynamic';

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
		const govde = (await istek.json().catch(() => ({}))) as { sirket?: string };
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
			.select('id, yon, durum, tutar, odendi')
			.eq('id', id)
			.eq('firma_id', firma.id)
			.is('silindi', null)
			.maybeSingle();

		if (!p) return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });

		const durum = p.odendi
			? p.yon === 'ALINAN'
				? 'PORTFOYDE'
				: 'BEKLIYOR'
			: p.yon === 'ALINAN'
				? 'TAHSIL'
				: 'ODENDI';

		const { data, error } = await supabase
			.from('otp_odemeler')
			.update({ durum, ...senkronOdendi(p.yon, durum, Number(p.tutar)) })
			.eq('id', id)
			.eq('firma_id', firma.id)
			.select('*')
			.single();

		if (error) throw error;

		await gunlukYaz(
			firma.id,
			data.odendi ? 'ÖDENDİ/TAHSİL İŞARETLENDİ' : 'ÖDENDİ GERİ ALINDI',
			id,
			{ durum }
		);

		return NextResponse.json(odemeyeCevir(data));
	} catch (e) {
		console.error('[otp/toggle]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}
