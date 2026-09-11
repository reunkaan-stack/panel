import { NextResponse } from 'next/server';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { modulSeviyesi } from '@/lib/yetki';
import { islemFirmasi } from '@/lib/yetki/firma';

/* Ürün hafızası: barkod → öğrenilmiş ad ve ürün KDV'si.

   POST → barkod listesi gönderilir, bilinenler döner (arama)
   PUT  → öğrenilenler yazılır (Excel indirildiğinde)

   NEDEN GET DEĞİL: katalog binlerce satıra çıkacak ama bir listede
   en fazla birkaç yüz ürün var. Tamamını çekmek yerine yalnızca
   sorulan barkodlar dönüyor. */

export const dynamic = 'force-dynamic';

/* Tek seferde okunacak/yazılacak azami satır. Bir sipariş listesi
   bunu aşmaz; aşıyorsa bir yanlışlık vardır ve sessizce yarısını
   işlemek yerine durmak doğru. */
const AZAMI = 2000;

type Kayit = { barkod: string; ad: string; kdv: number | null };

function barkodlariTemizle(veri: unknown): string[] {
	if (!Array.isArray(veri)) return [];
	const kume = new Set<string>();
	for (const b of veri) {
		const temiz = String(b ?? '').trim();
		if (temiz) kume.add(temiz.slice(0, 40));
	}
	return [...kume];
}

export async function POST(istek: Request) {
	try {
		const seviye = await modulSeviyesi('edp');
		if (!seviye) return NextResponse.json({ error: 'yetkisiz' }, { status: 403 });

		const firmaId = await islemFirmasi();
		const govde = (await istek.json()) as { barkodlar?: unknown };
		const barkodlar = barkodlariTemizle(govde.barkodlar);

		if (barkodlar.length === 0) return NextResponse.json({ urunler: {} });
		if (barkodlar.length > AZAMI) {
			return NextResponse.json(
				{ error: `Tek seferde en fazla ${AZAMI} barkod sorulabilir.` },
				{ status: 400 }
			);
		}

		const supabase = await sunucuIstemcisi();
		const { data, error } = await supabase
			.from('edp_urunler')
			.select('barkod, ad, kdv')
			.eq('firma_id', firmaId)
			.in('barkod', barkodlar);

		if (error) throw error;

		const urunler: Record<string, { ad: string; kdv: number | null }> = {};
		for (const satir of (data ?? []) as Kayit[]) {
			urunler[satir.barkod] = { ad: satir.ad, kdv: satir.kdv };
		}

		return NextResponse.json({ urunler });
	} catch (e) {
		console.error('[edp/urunler POST]', e);
		return NextResponse.json({ error: 'okunamadı' }, { status: 500 });
	}
}

export async function PUT(istek: Request) {
	try {
		const seviye = await modulSeviyesi('edp');
		if (seviye !== 'yazma' && seviye !== 'yonetim') {
			return NextResponse.json({ error: 'yetkisiz' }, { status: 403 });
		}

		const firmaId = await islemFirmasi();
		const govde = (await istek.json()) as { urunler?: unknown };

		if (!Array.isArray(govde.urunler)) {
			return NextResponse.json({ error: 'ürün listesi gelmedi' }, { status: 400 });
		}
		if (govde.urunler.length > AZAMI) {
			return NextResponse.json(
				{ error: `Tek seferde en fazla ${AZAMI} ürün yazılabilir.` },
				{ status: 400 }
			);
		}

		const supabase = await sunucuIstemcisi();

		/* Görülme sayısı artacağı için mevcut kayıtlar önce okunuyor.
		   upsert tek başına sayacı artıramaz; artırmadan yazarsak
		   "kaç kez doğrulandı" bilgisi hep 1 kalır ve öğrenilmiş adın
		   ne kadar güvenilir olduğu anlaşılmaz. */
		const gelen = govde.urunler as {
			barkod?: unknown;
			ad?: unknown;
			kdv?: unknown;
		}[];

		const satirlar = gelen
			.map((u) => ({
				barkod: String(u.barkod ?? '').trim().slice(0, 40),
				ad: String(u.ad ?? '').trim().slice(0, 200),
				kdv: Number(u.kdv),
			}))
			.filter((u) => u.barkod.length > 0 && (u.kdv === 10 || u.kdv === 20));

		if (satirlar.length === 0) return NextResponse.json({ yazilan: 0 });

		const { data: mevcut } = await supabase
			.from('edp_urunler')
			.select('barkod, gorulme, ad')
			.eq('firma_id', firmaId)
			.in(
				'barkod',
				satirlar.map((u) => u.barkod)
			);

		const oncekiler = new Map<string, { gorulme: number; ad: string }>();
		for (const m of (mevcut ?? []) as {
			barkod: string;
			gorulme: number;
			ad: string;
		}[]) {
			oncekiler.set(m.barkod, { gorulme: m.gorulme, ad: m.ad });
		}

		const yazilacak = satirlar.map((u) => {
			const onceki = oncekiler.get(u.barkod);
			return {
				firma_id: firmaId,
				barkod: u.barkod,
				/* Boş ad öğrenilmiş adı SİLMEZ. Kullanıcı adı otomatik
				   kullandığı bir listede indirme yaparsa, daha önce elle
				   düzelttiği ad kaybolmamalı. */
				ad: u.ad || onceki?.ad || '',
				kdv: u.kdv,
				gorulme: (onceki?.gorulme ?? 0) + 1,
			};
		});

		const { error } = await supabase
			.from('edp_urunler')
			.upsert(yazilacak, { onConflict: 'firma_id,barkod' });
		if (error) throw error;

		return NextResponse.json({ yazilan: yazilacak.length });
	} catch (e) {
		console.error('[edp/urunler PUT]', e);
		return NextResponse.json({ error: 'kaydedilemedi' }, { status: 500 });
	}
}
