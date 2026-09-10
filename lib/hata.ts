import 'server-only';

import { sunucuIstemcisi } from '@/lib/supabase/sunucu';
import { YetkisizHata } from '@/lib/yetki';
import { sistemBildir } from '@/lib/bildirim';
import { kacir } from '@/lib/telegram';

/* Sunucu eylemlerinin ortak sonuç türü ve hata yolu.

   NEDEN TEK DOSYADA: hataya() on ayrı eylemler.ts dosyasına birebir
   kopyalanmıştı ve 48 yerden çağrılıyordu. Kopyaların hiçbiri hatayı
   bir yere BİLDİRMİYORDU, yalnızca console.error yazıyordu — o da
   Vercel günlüklerine gidiyor ve kimse oraya bakmıyor. Yani sunucu
   hataları pratikte yok sayılıyordu.

   Tek yere alınınca 48 çağrı yeri birden bildirim kazandı. */

export type Sonuc<T = void> =
	| { tamam: true; veri: T }
	| { tamam: false; mesaj: string };

/* Aynı hata art arda yüz kez olabilir (bozuk bir sorgu, düşmüş bir
   servis). Her biri için Telegram mesajı atmak bildirimi
   kullanılamaz hale getirir; kullanıcı sessize alır ve asıl haber de
   kaybolur.

   Bu yüzden aynı imza bu süre içinde bir kez duyuruluyor. Kayıt yine
   HER SEFERİNDE düşüyor — susturulan şey bildirim, kayıt değil. */
const SESSIZLIK_DAKIKA = 30;

/**
 * Sunucu hatasını kaydeder ve gerekiyorsa haber verir.
 *
 * ASLA FIRLATMAZ: hata bildirimi sırasında çıkan hata, asıl hatayı
 * gölgeleyip isteği büsbütün çökertmemeli.
 */
export async function hatayiBildir(
	kaynak: string,
	hata: unknown,
	ek?: Record<string, unknown>
): Promise<void> {
	try {
		const mesaj =
			hata instanceof Error ? hata.message : String(hata ?? 'bilinmeyen hata');
		const imza = `${kaynak}:${mesaj}`.slice(0, 200);

		const supabase = await sunucuIstemcisi();

		await supabase.rpc('denetim_yaz', {
			p_eylem: 'sistem_hatasi',
			p_hedef_tablo: null,
			p_hedef_id: null,
			p_ayrinti: {
				kaynak,
				mesaj: mesaj.slice(0, 1000),
				imza,
				yigin:
					hata instanceof Error && hata.stack
						? hata.stack.split('\n').slice(0, 6).join('\n')
						: null,
				...ek,
			},
			p_firma_id: null,
		});

		/* Son bildirimden bu yana yeterince zaman geçti mi. Bellekte
		   tutulamaz: sunucusuz ortamda her istek başka bir örnekte
		   çalışabiliyor ve bellek paylaşılmıyor. */
		const esik = new Date(Date.now() - SESSIZLIK_DAKIKA * 60_000).toISOString();

		const { count } = await supabase
			.from('denetim_kayitlari')
			.select('id', { count: 'exact', head: true })
			.eq('eylem', 'sistem_hatasi')
			.eq('ayrinti->>imza', imza)
			.gte('olusturuldu', esik);

		/* Az önce yazdığımız kayıt da sayıya dahil; 1 ise bu ilk.  */
		if ((count ?? 0) > 1) return;

		await sistemBildir(
			'sistem.hata',
			`🔴 <b>Sistem hatası</b>
${kacir(kaynak)}
<code>${kacir(mesaj.slice(0, 300))}</code>`
		);
	} catch {
		/* Buraya düşmek, hatayı kaydedememek demek. Yapılabilecek tek
		   şey konsola yazmak; onu da aşağıdaki hataya() zaten yaptı. */
	}
}

/**
 * Eylem hatasını kullanıcıya gösterilecek sonuca çevirir.
 *
 * Yetki hatası kullanıcının kendi hatasıdır: mesajı olduğu gibi
 * gösterilir ve BİLDİRİLMEZ — sistem arızası değil.
 */
export function hataya(
	e: unknown,
	varsayilan: string,
	kaynak = 'panel'
): Sonuc<never> {
	if (e instanceof YetkisizHata) return { tamam: false, mesaj: e.message };

	console.error(`[${kaynak}]`, e);

	/* Beklenmiyor: kullanıcıya cevap dönmeyi geciktirmesin. Sunucu
	   eylemi cevabı gönderdikten sonra da çalışmaya devam ediyor,
	   çünkü yönlendirme burada YOK — giriş formundaki gibi iptal
	   edilme durumu yaşanmıyor. */
	void hatayiBildir(kaynak, e);

	return { tamam: false, mesaj: varsayilan };
}
