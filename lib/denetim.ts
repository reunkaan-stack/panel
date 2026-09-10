import 'server-only';

/* Denetim kaydı yazma.

   ⚠️ NEDEN DOĞRUDAN INSERT YAPILMIYOR: denetim_kayitlari tablosunda
   RLS açık ve INSERT politikası YOK. Tablo yorumunda "yazma yalnızca
   service_role" yazıyordu ama koddaki on bir yazma yerinin hepsi
   normal oturum istemcisini kullanıyordu. RLS bunları sessizce
   reddediyordu — Postgres hata döndürmüyor, satır yazılmıyor, kod da
   dönen hatayı kontrol etmiyordu. Sonuç: tablo aylarca boş kaldı.

   Artık yazma panel.denetim_yaz() işlevinden geçiyor. İşlev
   SECURITY DEFINER: RLS atlanıyor ve kaydı KİMİN yazdığı istemciden
   alınmıyor, auth.uid() üzerinden türetiliyor. Kullanıcı başkasının
   adına kayıt düşemiyor.

   İstemci dışarıdan geliyor: çağıranların çoğu oturumlu istemciyi
   kullanıyor ama Telegram ucu oturumsuz çalışıyor ve yönetim
   istemcisini taşıyor. Burada yenisini yaratmak o durumu bozardı. */

type Istemci = {
	rpc: (
		islev: string,
		girdi: Record<string, unknown>
	) => PromiseLike<{ error: unknown }>;
};

export type DenetimKaydi = {
	eylem: string;
	/** Süperadmin başka firma adına iş yapıyorsa. Yoksa oturumunki. */
	firmaId?: string | null;
	hedefTablo?: string | null;
	hedefId?: string | null;
	ayrinti?: Record<string, unknown> | null;
};

/**
 * Denetim kaydı düşer.
 *
 * ASLA FIRLATMAZ: denetim kaydı yazılamadı diye asıl iş geri
 * alınmamalı. Ama SESSİZ DE KALMAZ — hata konsola yazılır. Sessiz
 * kalması bu tablonun aylarca boş kalmasının sebebiydi.
 */
export async function denetimYaz(
	supabase: Istemci,
	kayit: DenetimKaydi
): Promise<void> {
	try {
		const { error } = await supabase.rpc('denetim_yaz', {
			p_eylem: kayit.eylem,
			p_hedef_tablo: kayit.hedefTablo ?? null,
			p_hedef_id: kayit.hedefId ?? null,
			p_ayrinti: kayit.ayrinti ?? null,
			p_firma_id: kayit.firmaId ?? null,
		});

		if (error) console.error('[denetim] yazılamadı', kayit.eylem, error);
	} catch (e) {
		console.error('[denetim] yazılamadı', kayit.eylem, e);
	}
}
