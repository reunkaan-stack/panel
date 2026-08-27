import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { modulSeviyesi } from '@/lib/yetki';
import {
	firmaCoz,
	gunlukYaz,
	kolonlaraCevir,
	odemeyeCevir,
	senkronOdendi,
} from '@/lib/otp/veri';

/* PUT    /api/otp/payments/<id>  → düzenle
   DELETE /api/otp/payments/<id>  → sil

   Silme YUMUŞAK: satır duruyor, `silindi` damgalanıyor. Yerel program
   diziden çıkarıyordu ve geri dönüşü yoktu; burada yanlışlıkla silinen
   bir çek kaybolmuyor, gizleniyor. */

export const dynamic = 'force-dynamic';

function yetkisiz() {
	return NextResponse.json(
		{ error: 'geçersiz veya yetkisiz şirket' },
		{ status: 403 }
	);
}

export async function PUT(
	istek: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const seviye = await modulSeviyesi('otp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') return yetkisiz();

		const { id } = await params;
		const govde = (await istek.json()) as Record<string, unknown>;
		const firma = await firmaCoz(String(govde.sirket ?? ''));
		if (!firma) return yetkisiz();

		const supabase = await sunucuIstemcisi();

		const { data: mevcut } = await supabase
			.from('otp_odemeler')
			.select('*')
			.eq('id', id)
			.eq('firma_id', firma.id)
			.is('silindi', null)
			.maybeSingle();

		if (!mevcut) {
			return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });
		}

		const degisen = kolonlaraCevir(govde);
		const yon = String(degisen.yon ?? mevcut.yon);
		const durum = String(degisen.durum ?? mevcut.durum);
		const tutar = Number(degisen.tutar ?? mevcut.tutar);

		const { data, error } = await supabase
			.from('otp_odemeler')
			.update({ ...degisen, ...senkronOdendi(yon, durum, tutar) })
			.eq('id', id)
			.eq('firma_id', firma.id)
			.select('*')
			.single();

		if (error) throw error;

		await gunlukYaz(firma.id, 'KAYIT DÜZENLENDİ', id, {
			degisen: Object.keys(degisen),
		});

		return NextResponse.json(odemeyeCevir(data));
	} catch (e) {
		console.error('[otp/payments PUT]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}

export async function DELETE(
	istek: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const seviye = await modulSeviyesi('otp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') return yetkisiz();

		const { id } = await params;
		const istenen = new URL(istek.url).searchParams.get('sirket') ?? '';
		const firma = await firmaCoz(istenen);
		if (!firma) return yetkisiz();

		const supabase = await sunucuIstemcisi();
		const { data, error } = await supabase
			.from('otp_odemeler')
			.update({ silindi: new Date().toISOString() })
			.eq('id', id)
			.eq('firma_id', firma.id)
			.is('silindi', null)
			.select('firma, tutar, tarih')
			.maybeSingle();

		if (error) throw error;
		if (!data) return NextResponse.json({ error: 'bulunamadı' }, { status: 404 });

		await gunlukYaz(firma.id, 'KAYIT SİLİNDİ', id, data);
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error('[otp/payments DELETE]', e);
		return NextResponse.json({ error: 'silinemedi' }, { status: 500 });
	}
}
