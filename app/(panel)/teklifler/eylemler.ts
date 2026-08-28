'use server';

import { revalidatePath } from 'next/cache';
import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { superadminDenetle, YetkisizHata } from '@/lib/yetki';
import { paraCoz } from '@/lib/ortak/para';
import type { Sonuc } from '../ptp/eylemler';

/* Teklif eylemleri — yalnızca süperadmin. */

function hataya(e: unknown, varsayilan: string): Sonuc<never> {
	if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };
	console.error('[teklifler]', e);
	return { tamam: false, mesaj: varsayilan };
}

/* Yeni teklif, hazır kalemlerle açılıyor. Boş bir formun karşısında
   "ne yazacağım" diye durmak, aceleyle gönderilen eksik teklif
   üretiyor. Fiyatlar sıfır: rakamı yazan sensin. */
const HAZIR_KALEMLER = [
	{
		baslik: 'Tasarım ve kurulum',
		aciklama:
			'Markaya özel arayüz tasarımı, mobil uyumlu kurulum, alan adı ve sunucu bağlantısı.',
	},
	{
		baslik: 'İçerik sayfaları',
		aciklama:
			'Anasayfa, hakkımda, hizmetler, iletişim. Metin yerleşimi ve görsel düzeni dahil.',
	},
	{
		baslik: 'Online randevu modülü',
		aciklama:
			'Ziyaretçi müsait saatleri görür ve randevu talebi oluşturur. Talep yönetim ekranına düşer.',
	},
	{
		baslik: 'Yönetim paneli',
		aciklama:
			'Randevuları görme, onaylama, iptal etme; çalışma saatlerini ve müsaitliği belirleme.',
	},
	{
		baslik: 'Arama motoru düzenlemesi',
		aciklama:
			'Başlık ve açıklamalar, site haritası, Google Search Console bağlantısı.',
	},
];

const HAZIR_KOSULLAR = `Teslim süresi: onay ve içeriklerin tesliminden itibaren … iş günü.
Ödeme: %50 başlangıç, %50 teslimde.
Fiyata dahil: bir yıl alan adı ve barındırma, teslim sonrası 1 ay düzeltme desteği.
Fiyata dahil değil: telifli görsel/ikon alımı, metin yazarlığı, sonraki yıl yenileme bedelleri.`;

/** Yeni teklif açar, kimliğini döndürür. */
export async function teklifAc(): Promise<Sonuc<string>> {
	try {
		const kullanici = await superadminDenetle();
		const supabase = await sunucuIstemcisi();

		const { data: no, error: noHatasi } = await supabase.rpc('teklif_yeni_no');
		if (noHatasi) throw noHatasi;

		const bugun = new Date();
		const gecerli = new Date(bugun);
		gecerli.setDate(gecerli.getDate() + 15);

		const { data: teklif, error } = await supabase
			.from('teklifler')
			.insert({
				no: no as string,
				baslik: 'Web sitesi ve online randevu sistemi',
				giris:
					'Aşağıda, görüşmemizde konuştuğumuz kapsam için hazırladığım fiyat teklifini bulacaksınız. Kalemler ayrı ayrı yazıldı; istemediğiniz bir kalemi çıkarıp toplamı yeniden değerlendirebiliriz.',
				kosullar: HAZIR_KOSULLAR,
				gecerlilik: gecerli.toISOString().slice(0, 10),
				olusturan_id: kullanici.id,
			})
			.select('id')
			.single();

		if (error) throw error;

		const { error: kalemHatasi } = await supabase
			.from('teklif_kalemleri')
			.insert(
				HAZIR_KALEMLER.map((k, i) => ({
					teklif_id: teklif.id,
					sira: i + 1,
					baslik: k.baslik,
					aciklama: k.aciklama,
					miktar: 1,
					birim: 'adet',
					birim_fiyat: 0,
				}))
			);
		if (kalemHatasi) throw kalemHatasi;

		revalidatePath('/teklifler');
		return { tamam: true, veri: teklif.id };
	} catch (e) {
		return hataya(e, 'Teklif açılamadı. Tekrar deneyin.');
	}
}

export type TeklifGirdisi = {
	musteri_ad: string;
	musteri_firma: string;
	musteri_eposta: string;
	musteri_telefon: string;
	baslik: string;
	giris: string;
	kosullar: string;
	tarih: string;
	gecerlilik: string;
	indirim: string;
	kdv_orani: string;
	durum: 'taslak' | 'gonderildi' | 'kabul' | 'red';
};

export async function teklifKaydet(
	id: string,
	girdi: TeklifGirdisi
): Promise<Sonuc> {
	try {
		await superadminDenetle();

		const indirim = paraCoz(girdi.indirim) ?? 0;
		const kdv = paraCoz(girdi.kdv_orani) ?? 20;
		if (indirim < 0) return { tamam: false, mesaj: 'İndirim eksi olamaz.' };
		if (kdv < 0 || kdv >= 100) {
			return { tamam: false, mesaj: 'KDV oranı 0 ile 100 arasında olmalı.' };
		}

		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('teklifler')
			.update({
				musteri_ad: girdi.musteri_ad.trim(),
				musteri_firma: girdi.musteri_firma.trim(),
				musteri_eposta: girdi.musteri_eposta.trim(),
				musteri_telefon: girdi.musteri_telefon.trim(),
				baslik: girdi.baslik.trim(),
				giris: girdi.giris.trim(),
				kosullar: girdi.kosullar.trim(),
				tarih: girdi.tarih || null,
				gecerlilik: girdi.gecerlilik || null,
				indirim,
				kdv_orani: kdv,
				durum: girdi.durum,
			})
			.eq('id', id);

		if (error) throw error;
		revalidatePath('/teklifler');
		revalidatePath(`/teklifler/${id}`);
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kaydedilemedi. Tekrar deneyin.');
	}
}

export type KalemGirdisi = {
	id?: string;
	sira: number;
	baslik: string;
	aciklama: string;
	miktar: string;
	birim: string;
	birim_fiyat: string;
};

/**
 * Kalemleri tümüyle yeniden yazar.
 *
 * Tek tek fark almak yerine sil-yaz: satır sayısı bir elin parmakları
 * kadar ve sıralama değiştiğinde hangi satırın nereye gittiğini
 * eşlemek, kazandığından çok hata üretir.
 */
export async function kalemleriKaydet(
	teklifId: string,
	kalemler: KalemGirdisi[]
): Promise<Sonuc> {
	try {
		await superadminDenetle();
		const supabase = await sunucuIstemcisi();

		const { error: silmeHatasi } = await supabase
			.from('teklif_kalemleri')
			.delete()
			.eq('teklif_id', teklifId);
		if (silmeHatasi) throw silmeHatasi;

		const yazilacak = kalemler
			.filter((k) => k.baslik.trim() || Number(k.birim_fiyat) > 0)
			.map((k, i) => ({
				teklif_id: teklifId,
				sira: i + 1,
				baslik: k.baslik.trim(),
				aciklama: k.aciklama.trim(),
				miktar: paraCoz(k.miktar) ?? 1,
				birim: k.birim.trim() || 'adet',
				birim_fiyat: paraCoz(k.birim_fiyat) ?? 0,
			}));

		if (yazilacak.length > 0) {
			const { error } = await supabase
				.from('teklif_kalemleri')
				.insert(yazilacak);
			if (error) throw error;
		}

		revalidatePath(`/teklifler/${teklifId}`);
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Kalemler kaydedilemedi. Tekrar deneyin.');
	}
}

export async function teklifSil(id: string): Promise<Sonuc> {
	try {
		await superadminDenetle();
		const supabase = await sunucuIstemcisi();
		const { error } = await supabase
			.from('teklifler')
			.update({ silindi: new Date().toISOString() })
			.eq('id', id);
		if (error) throw error;
		revalidatePath('/teklifler');
		return { tamam: true, veri: undefined };
	} catch (e) {
		return hataya(e, 'Silinemedi. Tekrar deneyin.');
	}
}
