/* PANEL HARİTASI — TEK KAYNAK.

   Bu dosya panelin ne olduğunu, parçaların birbirine nasıl bağlandığını
   ve nelerin NEDEN öyle yapıldığını tutar. İki yerden okunur:

     · /ayarlar/harita          → ekranda görselleştirir
     · araclar/harita-kontrol.mjs → koda karşı denetler (npm run kontrol)

   Denetim şu yüzden var: kurumsal sitede "değişiklik yapınca haritayı
   güncelle" kuralı yazılıydı ve harita yine aylarca bayatladı. Kural
   yetmiyor; kod söylemeli.

   ⚠️ YENİ SAYFA / TABLO / EYLEM EKLEDİĞİNDE BURAYA DA EKLE.
   Eklemezsen `npm run kontrol` uyarır. */

export type Katman = 0 | 1 | 2 | 3 | 4;

export const KATMAN_ADLARI: Record<Katman, string> = {
	0: 'Tarayıcı',
	1: 'Next.js sunucu',
	2: 'lib — ortak mantık',
	3: 'Supabase',
	4: 'Dış servisler',
};

export type DugumTuru =
	| 'sayfa'
	| 'eylem'
	| 'uc'
	| 'lib'
	| 'tablo'
	| 'islev'
	| 'dis';

export const TUR_ADLARI: Record<DugumTuru, string> = {
	sayfa: 'Ekran',
	eylem: 'Sunucu eylemi',
	uc: 'API ucu',
	lib: 'Kütüphane',
	tablo: 'Tablo',
	islev: 'Veritabanı işlevi',
	dis: 'Dış servis',
};

export type ModulKodu = 'cekirdek' | 'ptp' | 'otp' | 'teklif' | 'bildirim' | 'edp';

export const MODUL_ADLARI: Record<ModulKodu, string> = {
	cekirdek: 'Çekirdek',
	ptp: 'Personel Takip',
	otp: 'Ödeme Takip',
	teklif: 'Teklif',
	bildirim: 'Bildirim',
	edp: 'Excel Dosya Yükleme',
};

export type Dugum = {
	/** Benzersiz kod; bağlantılar bununla kurulur */
	kod: string;
	ad: string;
	tur: DugumTuru;
	katman: Katman;
	modul: ModulKodu;
	/** Depo içindeki yol — tablo ve işlevlerde migration dosyası */
	yol?: string;
	/** Ne işe yarar */
	ne: string;
	/** Neden böyle — yalnızca açıklanması gereken yerlerde */
	neden?: string;
	/** Bu düğümün ihtiyaç duyduğu düğümler */
	baglar: string[];
	/** Çalışmayan ya da yarım kalan bir şey varsa */
	sorun?: string;
};

/* ============================================================
   DÜĞÜMLER
   ============================================================ */

export const DUGUMLER: Dugum[] = [
	/* ---------- Katman 0: tarayıcı ---------- */
	{
		kod: 'giris-formu',
		ad: 'Giriş formu',
		tur: 'sayfa',
		katman: 0,
		modul: 'cekirdek',
		yol: 'bilesenler/arayuz/GirisFormu.tsx',
		ne: 'E-posta + şifre ile Supabase oturumu açar.',
		neden:
			'Giriş TARAYICIDA yapılıyor, sunucuda değil: Supabase oturum çerezlerini istemci kütüphanesi yazıyor. Bu yüzden "son giriş" damgası ayrı bir sunucu eylemine ihtiyaç duyuyor.',
		baglar: ['supabase-tarayici', 'giris-eylem'],
	},

	/* ---------- Katman 1: sunucu ---------- */
	{
		kod: 'middleware',
		ad: 'middleware',
		tur: 'eylem',
		katman: 1,
		modul: 'cekirdek',
		yol: 'middleware.ts',
		ne: 'Oturumu tazeler, girişsiz istekleri /giris adresine yollar.',
		neden:
			'DIS_UCLAR listesi bunu atlar. Telegram ve cron dışarıdan geliyor, oturumları yok; yönlendirilirlerse 307 alır ve sessizce çalışmazlar. Bir kez yaşandı.',
		baglar: ['supabase-sunucu'],
	},
	{
		kod: 'giris-eylem',
		ad: 'girisKaydet()',
		tur: 'eylem',
		katman: 1,
		modul: 'cekirdek',
		yol: 'bilesenler/arayuz/girisEylem.ts',
		ne: 'son_giris damgasını yazar ve "giriş yaptı" bildirimini gönderir.',
		neden:
			'BEKLENMESİ ŞART. Önce void ile ateşlenip bırakılıyordu; yönlendirme isteği iptal ediyordu ve damga hiç yazılmıyordu.',
		baglar: ['t-kullanicilar', 'bildirim-gonder'],
	},
	{
		kod: 'sayfa-ptp',
		ad: '/ptp — Görevler',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/page.tsx',
		ne: 'Günün görev listesi, grup grup katlanır. Üstte "Günü kapat".',
		baglar: ['ptp-eylemler', 'f-gunun-gorevleri', 't-ptp-gorevler', 't-ptp-kayitlar'],
	},
	{
		kod: 'sayfa-ptp-eksikler',
		ad: '/ptp/eksikler',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/eksikler/page.tsx',
		ne: 'Ürün eksiği, temel ihtiyaç ve müşteri talebi listeleri.',
		neden:
			'Kategoriler sayfadaki diziden basılıyor. Diziye eklenmeyen kategori veritabanında olsa bile EKRANDA HİÇ GÖRÜNMEZ.',
		baglar: ['t-ptp-eksikler', 'eksik-eylemler'],
	},
	{
		kod: 'sayfa-ptp-gorevler',
		ad: '/ptp/gorevler',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/gorevler/page.tsx',
		ne: 'Görev tanımları: tür, grup, tekrar, atama, eksik kategorisi.',
		baglar: ['t-ptp-gorevler', 't-ptp-gorev-maddeleri'],
	},
	{
		kod: 'sayfa-ptp-rapor',
		ad: '/ptp/rapor — Performans',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/rapor/page.tsx',
		ne: 'Kişi/görev/gün kırılımı, atlama sebepleri, göreve yazılanlar.',
		baglar: [
			'f-kisi-performansi',
			'f-gorev-performansi',
			'f-gun-ozeti',
			'f-atlananlar',
			'f-yazilanlar',
		],
	},
	{
		kod: 'sayfa-ptp-ciro',
		ad: '/ptp/ciro',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/ciro/page.tsx',
		ne: 'Günlük ciro girişi ve aylık takip.',
		baglar: ['t-ptp-cirolar'],
	},
	{
		kod: 'sayfa-ptp-prim',
		ad: '/ptp/prim',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/prim/page.tsx',
		ne: 'Kademeli prim hesabı; ciro KDV hariç değerlendirilir.',
		neden:
			'Son iki kademe sabit tutar değil MAAŞ KATI: ocakta zam gelince prim de kendiliğinden yükselsin diye.',
		baglar: ['lib-prim', 't-ptp-prim-kademeleri', 't-ptp-maaslar', 't-ptp-cirolar'],
		sorun:
			'Personel kendi prim ilerlemesini göremiyor — hesap var, personel görünümü yok.',
	},
	{
		kod: 'sayfa-ptp-kroki',
		ad: '/ptp/kroki',
		tur: 'sayfa',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/kroki/page.tsx',
		ne: 'Mağaza bölümlerinin krokisi; görevler bölüme bağlanır.',
		baglar: ['t-ptp-bolumler'],
	},
	{
		kod: 'ptp-eylemler',
		ad: 'PTP eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/eylemler.ts',
		ne: 'kayitEkle() ve gunuKapat(): görev kaydı, ciro, eksik üretimi.',
		neden:
			'gunuKapat() toplu çalışır: 15 gidiş-dönüş yerine 4. Bildirimler en sonda, kayıt yazıldıktan sonra.',
		baglar: ['t-ptp-kayitlar', 't-ptp-eksikler', 't-ptp-cirolar', 'ptp-bildirim', 'ortak-tarih'],
	},
	{
		kod: 'eksik-eylemler',
		ad: 'Eksik eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/eksikler/eylemler.ts',
		ne: 'Elle eksik bildirme ve kapatma.',
		baglar: ['t-ptp-eksikler'],
	},
	{
		kod: 'sayfa-otp',
		ad: '/otp — Ödeme Takip',
		tur: 'sayfa',
		katman: 1,
		modul: 'otp',
		yol: 'app/(panel)/otp/page.tsx',
		ne: 'Yereldeki programın arayüzünü çerçeve içinde açar.',
		neden:
			'1400 satırlık arayüz React\'e çevrilmedi; olduğu gibi sunuluyor. Çerçeve adresinde YAYIN KİMLİĞİ var (?s=commit) — olmasaydı tarayıcı eski kopyayı gösterirdi.',
		baglar: ['otp-arayuz', 'uc-payments'],
	},
	{
		kod: 'otp-arayuz',
		ad: 'public/otp/uygulama.html',
		tur: 'sayfa',
		katman: 0,
		modul: 'otp',
		yol: 'public/otp/uygulama.html',
		ne: 'Ödeme Takip arayüzü — ÜRETİLMİŞ DOSYA.',
		neden:
			'ELLE DÜZENLENMEZ. Kaynağı yereldeki program; bütün değişiklikler araclar/otp-arayuz-tasi.mjs içindeki adımlarla tanımlı ve betik yeniden üretiyor.',
		baglar: ['otp-tasi'],
	},
	{
		kod: 'otp-tasi',
		ad: 'otp-arayuz-tasi.mjs',
		tur: 'lib',
		katman: 2,
		modul: 'otp',
		yol: 'araclar/otp-arayuz-tasi.mjs',
		ne: '12 adımlık dönüşüm: API adresleri, tema, gizlenen düğmeler, kredi özeti, ay sıralaması, kredi ilerleme çubuğu.',
		neden:
			'Betik olmasaydı her değişiklik 1400 satırda elle aranırdı ve kaynak program güncellenince hepsi kaybolurdu.',
		baglar: [],
	},
	{
		kod: 'sayfa-otp-aktarim',
		ad: '/otp/aktarim — DIA',
		tur: 'sayfa',
		katman: 1,
		modul: 'otp',
		yol: 'app/(panel)/otp/aktarim/page.tsx',
		ne: 'DIA Excel raporunu içe aktarır; önizleme onaydan önce gösterilir.',
		baglar: ['uc-dia'],
	},
	{
		kod: 'uc-payments',
		ad: 'GET/POST /api/otp/payments',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/payments/route.ts',
		ne: 'Arayüzün bütün verisini tek yanıtta döndürür.',
		neden:
			'Yanıt biçimi yerel programla BİREBİR aynı; arayüz değişmesin diye. Değişen tek şey verinin nereden geldiği.',
		baglar: ['t-otp-odemeler', 't-otp-krediler', 't-otp-taksitler', 'otp-veri'],
	},
	{
		kod: 'uc-dia',
		ad: 'POST /api/otp/dia-import',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/dia-import/route.ts',
		ne: 'Excel çözer, önizler, onaydan sonra uygular. Yalnızca yönetici.',
		neden:
			'Kolonlar BAŞLIK ADINA göre okunuyor, sıraya göre değil. Yerel program harf sırasıyla okuyordu; DIA\'da bir kolon eklenince bütün alanlar kayar ve yanlış veri sessizce girerdi.',
		baglar: ['otp-dia', 'otp-dia-aktar', 't-otp-dia-eslemeleri'],
	},
	{
		kod: 'uc-export',
		ad: 'GET /api/otp/export.xlsx',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/export.xlsx/route.ts',
		ne: 'Excel dışa aktarma.',
		baglar: [],
		sorun: 'TAŞINMADI. Bilgi sayfası döndürüyor; yerel programdaki excel_aktar.py hâlâ tek yol.',
	},
	{
		kod: 'sayfa-teklifler',
		ad: '/teklifler',
		tur: 'sayfa',
		katman: 1,
		modul: 'teklif',
		yol: 'app/(panel)/teklifler/page.tsx',
		ne: 'Fiyat teklifi hazırlama, kalem kalem.',
		baglar: ['t-teklifler', 't-teklif-kalemleri', 'lib-teklif', 'f-teklif-no'],
	},
	{
		kod: 'sayfa-yazdir',
		ad: '/yazdir/teklif/[id]',
		tur: 'sayfa',
		katman: 1,
		modul: 'teklif',
		yol: 'app/yazdir/teklif/[id]/page.tsx',
		ne: 'Yazdırılabilir teklif; tarayıcıdan PDF alınır.',
		neden:
			'Adres tahmin edilebilir olmasın diye kimlik UUID ama tek başına yetmez: sayfa superadminDenetle() ile kapalı.',
		baglar: ['t-teklifler', 'lib-kurum'],
	},
	{
		kod: 'sayfa-kisiler',
		ad: '/kisiler',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/kisiler/page.tsx',
		ne: 'Hesap açma, yetki verme, şifre değiştirme, pasife alma.',
		baglar: ['kisi-eylemler', 't-kullanicilar', 't-modul-yetkileri'],
	},
	{
		kod: 'kisi-eylemler',
		ad: 'Kişi eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/kisiler/eylemler.ts',
		ne: 'Supabase Auth üzerinde hesap açar/siler, şifre değiştirir.',
		neden:
			'Yönetim istemcisi RLS\'i ATLAR. Yalnızca burada ve sunucuda kullanılır; SUPABASE_SERVICE_ROLE_KEY asla NEXT_PUBLIC_ almaz.',
		baglar: ['supabase-yonetim', 't-kullanicilar'],
	},
	{
		kod: 'sayfa-ayarlar',
		ad: '/ayarlar',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/ayarlar/page.tsx',
		ne: 'Süperadmin kapısı: firmalar, kişiler, bildirimler, teklifler, genel bakış, harita.',
		baglar: ['sayfa-firmalar', 'sayfa-bildirimler', 'sayfa-kisiler', 'sayfa-rapor', 'sayfa-harita'],
	},
	{
		kod: 'sayfa-harita',
		ad: '/ayarlar/harita',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/ayarlar/harita/page.tsx',
		ne: 'Bu harita. Ne nerede, ne neye bağlı, ne çalışmıyor, sırada ne var.',
		neden:
			'Her işe başlarken kod yeniden keşfediliyordu. Önce buraya bakmak hem zaman hem jeton kazandırıyor.',
		baglar: ['harita-veri'],
	},
	{
		kod: 'sayfa-firmalar',
		ad: '/ayarlar/firmalar',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/ayarlar/firmalar/page.tsx',
		ne: 'Firma ekleme, modül açma, pasife alma.',
		baglar: ['t-firmalar', 't-firma-modulleri'],
	},
	{
		kod: 'sayfa-bildirimler',
		ad: '/ayarlar/bildirimler',
		tur: 'sayfa',
		katman: 1,
		modul: 'bildirim',
		yol: 'app/(panel)/ayarlar/bildirimler/page.tsx',
		ne: 'Telegram bağlantısı, webhook durumu, hangi olayda haber verileceği.',
		baglar: ['t-telegram-ayarlari', 't-bildirim-tercihleri', 'bildirim-katalog'],
	},
	{
		kod: 'sayfa-rapor',
		ad: '/rapor — Genel bakış',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/rapor/page.tsx',
		ne: 'Bütün firmaların durumu tek ekranda.',
		baglar: ['t-firmalar', 't-kullanicilar'],
	},
	{
		kod: 'uc-telegram',
		ad: 'POST /api/telegram',
		tur: 'uc',
		katman: 1,
		modul: 'bildirim',
		yol: 'app/api/telegram/route.ts',
		ne: 'Telegram webhook: bota yazılan mesajları karşılar.',
		neden:
			'getUpdates kullanılamaz — sunucusuz ortamda sürekli çalışan süreç yok. Kimlik doğrulama secret_token başlığıyla.',
		baglar: ['lib-telegram', 't-telegram-ayarlari'],
	},
	{
		kod: 'uc-zamanli',
		ad: 'POST /api/telegram/zamanli',
		tur: 'uc',
		katman: 1,
		modul: 'bildirim',
		yol: 'app/api/telegram/zamanli/route.ts',
		ne: 'Zamanlı bildirimleri üretir; pg_cron çağırır.',
		neden: 'CRON_GIZLI_ANAHTAR ile korunuyor; middleware\'i atlayan iki uçtan biri.',
		baglar: ['bildirim-zamanli', 'cron'],
	},

	/* ---------- Katman 2: lib ---------- */
	{
		kod: 'lib-yetki',
		ad: 'lib/yetki',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/yetki/index.ts',
		ne: 'yetkiDenetle(), superadminDenetle(), aktifKullanici(), islemFirmasi().',
		neden:
			'HER SUNUCU EYLEMİNİN İLK SATIRI. Yetki tek yerden sorulur; ekranın gizlenmesi yetki değildir.',
		baglar: ['supabase-sunucu', 'f-modul-seviyesi'],
	},
	{
		kod: 'supabase-sunucu',
		ad: 'lib/supabase/sunucu',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/supabase/sunucu.ts',
		ne: 'Oturumlu sunucu istemcisi; RLS geçerli.',
		baglar: ['supabase'],
	},
	{
		kod: 'supabase-tarayici',
		ad: 'lib/supabase/tarayici',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/supabase/tarayici.ts',
		ne: 'Tarayıcı istemcisi; yalnızca giriş ve oturum için.',
		baglar: ['supabase'],
	},
	{
		kod: 'supabase-yonetim',
		ad: 'lib/supabase/yonetim',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/supabase/yonetim.ts',
		ne: 'service_role istemcisi — RLS ATLAR.',
		neden:
			'server-only ile işaretli. Tarayıcıya sızarsa bütün firmaların verisi açılır; bu yüzden yalnızca hesap açma/kapatma işlerinde.',
		baglar: ['supabase'],
	},
	{
		kod: 'bildirim-gonder',
		ad: 'bildir()',
		tur: 'lib',
		katman: 2,
		modul: 'bildirim',
		yol: 'lib/bildirim/index.ts',
		ne: 'Tek giriş kapısı: olay + mesaj alır, tercihe bakar, gönderir.',
		neden:
			'ASLA HATA FIRLATMAZ. Bildirim gönderilemedi diye asıl iş (görev kaydı, ciro) geri alınmamalı.',
		baglar: ['bildirim-katalog', 'lib-telegram', 't-bildirim-tercihleri'],
	},
	{
		kod: 'bildirim-katalog',
		ad: 'Olay kataloğu',
		tur: 'lib',
		katman: 2,
		modul: 'bildirim',
		yol: 'lib/bildirim/katalog.ts',
		ne: '7 olay: sistem.oturum_acildi, ptp.* (5), otp.vade_ozeti.',
		neden:
			'YENİ MODÜLÜN GENİŞLEME NOKTASI. Modül eklenince olayları buraya yazılır; kod "modul.olay" biçimini veritabanı kısıtıyla zorlar.',
		baglar: [],
	},
	{
		kod: 'bildirim-zamanli',
		ad: 'Zamanlı işleyiciler',
		tur: 'lib',
		katman: 2,
		modul: 'bildirim',
		yol: 'lib/bildirim/zamanli.ts',
		ne: 'Kapanış hatırlatması, günlük özet, vade özeti.',
		baglar: ['bildirim-gonder', 'ptp-ozet'],
	},
	{
		kod: 'lib-telegram',
		ad: 'lib/telegram',
		tur: 'lib',
		katman: 2,
		modul: 'bildirim',
		yol: 'lib/telegram.ts',
		ne: 'mesajGonder, webhookKur, webhookDurumu, kacir.',
		neden:
			'Bot jetonu YALNIZCA process.env.TELEGRAM_BOT_TOKEN\'dan okunur, veritabanında tutulmaz. Sohbete asla yazılmaz; doğrudan Vercel\'e girilir.',
		baglar: ['telegram'],
	},
	{
		kod: 'ptp-bildirim',
		ad: 'lib/ptp/bildirim',
		tur: 'lib',
		katman: 2,
		modul: 'ptp',
		yol: 'lib/ptp/bildirim.ts',
		ne: 'PTP olaylarının mesaj metinlerini üretir.',
		baglar: ['bildirim-gonder'],
	},
	{
		kod: 'ptp-ozet',
		ad: 'lib/ptp/ozet',
		tur: 'lib',
		katman: 2,
		modul: 'ptp',
		yol: 'lib/ptp/ozet.ts',
		ne: 'Gün sonu özeti: yapılan, atlanan, eksikler.',
		baglar: ['t-ptp-kayitlar'],
	},
	{
		kod: 'otp-veri',
		ad: 'lib/otp/veri',
		tur: 'lib',
		katman: 2,
		modul: 'otp',
		yol: 'lib/otp/veri.ts',
		ne: 'Firma çözümü, satır dönüşümü (seri_no ↔ seriNo), günlük yazımı.',
		neden:
			'aktifOtpFirmasi() firmaya SUNUCU karar verir; istemciden gelen ?sirket= yok sayılır. Yoksa adres çubuğuyla başka firmanın verisi istenebilirdi.',
		baglar: ['t-otp-odemeler', 't-otp-gunluk'],
	},
	{
		kod: 'otp-dia',
		ad: 'lib/otp/dia',
		tur: 'lib',
		katman: 2,
		modul: 'otp',
		yol: 'lib/otp/dia.ts',
		ne: 'Saf çözümleme: başlık eşleme, parmak izi, durum sözlüğü, tarih.',
		neden:
			'Saf tutuldu ki veritabanı olmadan sınanabilsin. Gerçek DIA dosyasıyla 31/31 kayıt doğrulandı.',
		baglar: [],
	},
	{
		kod: 'otp-dia-aktar',
		ad: 'lib/otp/diaAktar',
		tur: 'lib',
		katman: 2,
		modul: 'otp',
		yol: 'lib/otp/diaAktar.ts',
		ne: 'Eşleme öğrenme, çek ve kredi aktarımı, "panel kazanır" kuralı.',
		neden:
			'Panelde ödenmiş işaretlenmiş kayıt DIA "bekliyor" dese bile geri alınmaz; kullanıcı işini kaybetmesin.',
		baglar: ['otp-dia', 't-otp-dia-eslemeleri', 't-otp-krediler'],
	},
	{
		kod: 'lib-prim',
		ad: 'lib/prim',
		tur: 'lib',
		katman: 2,
		modul: 'ptp',
		yol: 'lib/prim.ts',
		ne: 'Kademe hesabı — ara değer YOK, basamak işlevi.',
		baglar: [],
	},
	{
		kod: 'lib-teklif',
		ad: 'lib/teklif',
		tur: 'lib',
		katman: 2,
		modul: 'teklif',
		yol: 'lib/teklif.ts',
		ne: 'Ara toplam, indirim, KDV, genel toplam.',
		baglar: [],
	},
	{
		kod: 'lib-kurum',
		ad: 'lib/kurum',
		tur: 'lib',
		katman: 2,
		modul: 'teklif',
		yol: 'lib/kurum.ts',
		ne: 'Karas Teknoloji künyesi: unvan, telefon, e-posta, adres, vergi.',
		neden: 'Tek kaynak. Telefon değişirse tek yerden değişsin.',
		baglar: [],
	},
	{
		kod: 'ortak-tarih',
		ad: 'lib/ortak/tarih',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/ortak/tarih.ts',
		ne: 'gunGecerli(), kisaTarih(), ay yardımcıları.',
		neden:
			'gunGecerli() BURADA. Aynı doğrulama üç dosyaya kopyalanmıştı, birinde kaçış karakteri bozuktu ve "Günü kapat" haftalarca çalışmadı.',
		baglar: [],
	},
	{
		kod: 'ortak-para',
		ad: 'lib/ortak/para',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/ortak/para.ts',
		ne: 'paraCoz, paraBicimle, degisim.',
		baglar: [],
	},
	{
		kod: 'lib-tipler',
		ad: 'lib/tipler',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/tipler.ts',
		ne: 'Alan türleri (Rol, GorevTuru, EksikKategori…) ve Türkçe arayüz etiketleri.',
		neden:
			'ÜRETİLMEZ, ELLE YAZILIR. İçindekilerin hiçbiri şemadan çıkmaz: alan türleri veritabanında metin+check olarak duruyor, etiketler ise hiç yok. Üretilen satır türleri ayrı dosyaya (lib/veritabani.ts) gider.',
		baglar: [],
	},
	{
		kod: 'harita-veri',
		ad: 'lib/harita/veri',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/harita/veri.ts',
		ne: 'Bu dosya. Haritanın tek kaynağı.',
		baglar: [],
	},

	/* ---------- Katman 3: Supabase ---------- */
	{
		kod: 'supabase',
		ad: 'Supabase — panel şeması',
		tur: 'dis',
		katman: 3,
		modul: 'cekirdek',
		ne: 'Postgres + Auth + Storage. Kurumsal sitenin veritabanını paylaşır.',
		neden:
			'Ayrı proje AÇILMADI: ücretsiz plan sınırı doldu. Site public şemasında, panel panel şemasında. anon rolüne kapalı.',
		baglar: [],
		sorun:
			'Ücretsiz planda GÜNLÜK YEDEK YOK. Panelin en büyük açık riski bu; karar bekliyor.',
	},
	{
		kod: 't-firmalar',
		ad: 'firmalar',
		tur: 'tablo',
		katman: 3,
		modul: 'cekirdek',
		yol: 'supabase/migrations/20260820_1200_temel_kurulum.sql',
		ne: 'Müşteri firmalar. Her satırın firma_id\'si buraya bakar.',
		baglar: ['supabase'],
	},
	{
		kod: 't-kullanicilar',
		ad: 'kullanicilar',
		tur: 'tablo',
		katman: 3,
		modul: 'cekirdek',
		yol: 'supabase/migrations/20260820_1200_temel_kurulum.sql',
		ne: 'Panel kullanıcıları; auth_id ile Supabase Auth\'a bağlı.',
		neden:
			'Kendi satırını güncelleyebilirsin ama rol/firma/aktiflik DEĞİŞTİRİLEMEZ — kullanici_degisimi_denetle() tetikleyicisi engelliyor. RLS kolon ayrımı yapamadığı için denetim tetikleyiciye alındı.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-modul-yetkileri',
		ad: 'modul_yetkileri',
		tur: 'tablo',
		katman: 3,
		modul: 'cekirdek',
		ne: 'Kişi × modül × seviye (okuma/yazma/yonetim).',
		baglar: ['t-kullanicilar'],
	},
	{
		kod: 't-firma-modulleri',
		ad: 'firma_modulleri',
		tur: 'tablo',
		katman: 3,
		modul: 'cekirdek',
		ne: 'Firmanın hangi modülleri açık. Satış kararı; firma değiştiremez.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-denetim',
		ad: 'denetim_kayitlari',
		tur: 'tablo',
		katman: 3,
		modul: 'cekirdek',
		ne: 'Kim neyi değiştirdi.',
		baglar: ['supabase'],
	},
	{
		kod: 't-ptp-gorevler',
		ad: 'ptp_gorevler',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		yol: 'supabase/migrations/5_kayit_defteri.sql',
		ne: 'Görev TANIMLARI. Gün gün üretilmez; hangi günün geçerli olduğu hesaplanır.',
		neden:
			'DİKKAT: bu tablo eskiden ptp_sablonlar\'dı, 5_ ile yeniden adlandırıldı. Aynı adı taşıyan ESKİ tablo (gün gün satırlar) düşürüldü.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-ptp-kayitlar',
		ad: 'ptp_kayitlar',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		yol: 'supabase/migrations/5_kayit_defteri.sql',
		ne: 'Kayıt defteri: görev ne zaman, kim tarafından, hangi değerle yapıldı.',
		neden:
			'CANLI TABLO BU. ptp_gorev_kayitlari düşürüldü; rapor işlevlerinin eski sürümü hâlâ 3_rapor.sql içinde duruyor ama 5_ onları ezdi.',
		baglar: ['t-ptp-gorevler'],
	},
	{
		kod: 't-ptp-gorev-maddeleri',
		ad: 'ptp_gorev_maddeleri',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Kontrol listesi maddeleri.',
		baglar: ['t-ptp-gorevler'],
	},
	{
		kod: 't-ptp-eksikler',
		ad: 'ptp_eksikler',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		yol: 'supabase/migrations/20260820_2200_eksikler.sql',
		ne: 'Eksik ve talep listesi. Kategori: urun / temel / musteri.',
		neden:
			'Kategori listesi İKİ kısıtta geçiyor: burada ve ptp_gorevler.gorev_eksik_kategori_tutarli. Yeni kategori eklerken ikisi birden genişletilmeli.',
		baglar: ['t-ptp-gorevler', 't-ptp-kayitlar'],
	},
	{
		kod: 't-ptp-cirolar',
		ad: 'ptp_cirolar',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Günlük ciro. Gün başına tek satır (benzersizlik indeksi).',
		neden: 'Girilen tutar KDV DAHİL; prim hesabına /1,2 ile giriyor.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-ptp-prim-kademeleri',
		ad: 'ptp_prim_kademeleri',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Ciro kademesi → prim tutarı ya da maaş katı.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-ptp-maaslar',
		ad: 'ptp_maaslar',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Tarihli maaş kaydı; maaş katı kademeleri bunu okur.',
		baglar: ['t-kullanicilar'],
	},
	{
		kod: 't-ptp-hedefler',
		ad: 'ptp_hedefler',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Aylık ciro hedefi.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-ptp-bolumler',
		ad: 'ptp_bolumler',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Mağaza bölümleri (kroki).',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-ptp-ayarlar',
		ad: 'ptp_ayarlar',
		tur: 'tablo',
		katman: 3,
		modul: 'ptp',
		ne: 'Firma başına PTP ayarları (KDV oranı, kapanış saati).',
		neden:
			'TUZAK: tablo zaten vardı, "create table if not exists" sessizce hiçbir şey yapmadı ve kolon eklenmediği için migration tohumda patladı. Var olan tabloya kolon "alter table ... add column if not exists" ile eklenir.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-otp-odemeler',
		ad: 'otp_odemeler',
		tur: 'tablo',
		katman: 3,
		modul: 'otp',
		yol: 'supabase/migrations/10_otp.sql',
		ne: 'Çek ve senetler.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-otp-krediler',
		ad: 'otp_krediler',
		tur: 'tablo',
		katman: 3,
		modul: 'otp',
		ne: 'Banka kredileri.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-otp-taksitler',
		ad: 'otp_taksitler',
		tur: 'tablo',
		katman: 3,
		modul: 'otp',
		ne: 'Kredi taksitleri: tutar, anapara, faiz, bsmv.',
		neden:
			'1150 taksidin 60\'ında tutar ≠ anapara+faiz+bsmv (~103 bin TL). Yerel program KKDF\'yi hiç almamış; fark "diğer" olarak GÖSTERİLİYOR, gizlenmiyor.',
		baglar: ['t-otp-krediler'],
	},
	{
		kod: 't-otp-dia-eslemeleri',
		ad: 'otp_dia_eslemeleri',
		tur: 'tablo',
		katman: 3,
		modul: 'otp',
		yol: 'supabase/migrations/17_dia_esleme.sql',
		ne: 'Öğrenilmiş kolon eşlemeleri; aynı biçim bir daha sorulmaz.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-otp-gunluk',
		ad: 'otp_gunluk',
		tur: 'tablo',
		katman: 3,
		modul: 'otp',
		ne: 'ÖTP işlem günlüğü.',
		baglar: ['t-firmalar'],
		sorun: 'Yazılıyor ama hiçbir ekranda gösterilmiyor.',
	},
	{
		kod: 't-teklifler',
		ad: 'teklifler',
		tur: 'tablo',
		katman: 3,
		modul: 'teklif',
		yol: 'supabase/migrations/12_teklif.sql',
		ne: 'Teklif başlığı, müşteri bilgisi, durum.',
		neden: 'Numaralandırma 173\'ten başlıyor — ilk teklif "1" görünmesin diye.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-teklif-kalemleri',
		ad: 'teklif_kalemleri',
		tur: 'tablo',
		katman: 3,
		modul: 'teklif',
		ne: 'Teklif satırları.',
		baglar: ['t-teklifler'],
	},
	{
		kod: 't-telegram-ayarlari',
		ad: 'telegram_ayarlari',
		tur: 'tablo',
		katman: 3,
		modul: 'bildirim',
		yol: 'supabase/migrations/14_telegram.sql',
		ne: 'Firma başına sohbet kimliği ve açık/kapalı.',
		neden: 'Bot jetonu BURADA DEĞİL, ortam değişkeninde.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-bildirim-tercihleri',
		ad: 'bildirim_tercihleri',
		tur: 'tablo',
		katman: 3,
		modul: 'bildirim',
		yol: 'supabase/migrations/16_bildirim.sql',
		ne: 'Firma × olay: hangi olayda haber verilecek.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 'f-modul-seviyesi',
		ad: 'modul_seviyesi()',
		tur: 'islev',
		katman: 3,
		modul: 'cekirdek',
		ne: 'Oturumun bir moduldeki seviyesi. RLS kurallarının çoğu bunu çağırır.',
		baglar: ['t-modul-yetkileri'],
	},
	{
		kod: 'f-gunun-gorevleri',
		ad: 'ptp_gunun_gorevleri()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		ne: 'Bir günde hangi görevlerin geçerli olduğunu hesaplar.',
		baglar: ['t-ptp-gorevler'],
	},
	{
		kod: 'f-kisi-performansi',
		ad: 'ptp_kisi_performansi()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		ne: 'Kim kaç görev yaptı, kaçını atladı.',
		baglar: ['t-ptp-kayitlar'],
	},
	{
		kod: 'f-gorev-performansi',
		ad: 'ptp_gorev_performansi()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		ne: 'Hangi görev aksıyor.',
		baglar: ['t-ptp-kayitlar', 't-ptp-gorevler'],
	},
	{
		kod: 'f-gun-ozeti',
		ad: 'ptp_gun_ozeti()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		ne: 'Gün gün toplam/yapılan/atlanan.',
		baglar: ['t-ptp-kayitlar'],
	},
	{
		kod: 'f-atlananlar',
		ad: 'ptp_atlananlar()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		ne: 'Atlama sebepleri.',
		baglar: ['t-ptp-kayitlar'],
	},
	{
		kod: 'f-yazilanlar',
		ad: 'ptp_yazilanlar()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		yol: 'supabase/migrations/21_yazilanlar.sql',
		ne: 'Görev yapılırken yazılan metin ve girilen sayılar.',
		neden:
			'18_ ile birlikte panel şemasındaki fonksiyonlarda EXECUTE public rolüne verilmiyor; YENİ işlevlere grant AÇIKÇA yazılmalı.',
		baglar: ['t-ptp-kayitlar'],
	},
	{
		kod: 'f-denetim-yaz',
		ad: 'denetim_yaz()',
		tur: 'islev',
		katman: 3,
		modul: 'cekirdek',
		yol: 'supabase/migrations/22_denetim_ve_hata.sql',
		ne: 'Denetim kaydi yazar. Tek yazma noktasi.',
		neden:
			'Tabloda INSERT politikasi YOK; dogrudan insert RLS tarafindan sessizce reddediliyordu ve tablo aylarca bos kaldi. Islev SECURITY DEFINER: yazma her zaman basarili, kimin yazdigi ise auth.uid() uzerinden turetiliyor — istemciden alinmiyor, yani kullanici baskasinin adina kayit dusemiyor.',
		baglar: ['t-denetim'],
	},
	{
		kod: 'lib-denetim',
		ad: 'lib/denetim',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/denetim.ts',
		ne: 'denetimYaz(): denetim kaydini islev uzerinden yazar.',
		neden:
			'Istemci disaridan geliyor: cagiranlarin cogu oturumlu istemciyi kullaniyor ama Telegram ucu oturumsuz calisip yonetim istemcisini tasiyor.',
		baglar: ['f-denetim-yaz'],
	},
	{
		kod: 'lib-hata',
		ad: 'lib/hata',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/hata.ts',
		ne: 'Sonuc turu, hataya() ve hatayiBildir(). Butun sunucu eylemlerinin hata yolu.',
		neden:
			'hataya() on ayri eylemler.ts dosyasina kopyalanmisti ve 48 yerden cagriliyordu; hicbiri hatayi bir yere BILDIRMIYORDU. Tek yere alininca 48 cagri yeri birden bildirim kazandi. Ayni hata 30 dakika icinde bir kez duyurulur, kaydi her seferinde tutulur.',
		baglar: ['lib-denetim', 'bildirim-gonder'],
	},
	{
		kod: 'sayfa-denetim',
		ad: '/ayarlar/denetim',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/ayarlar/denetim/page.tsx',
		ne: 'Kim ne yapti ve sunucuda ne patladi. Iki sekme.',
		neden:
			'Islem kaydi ile sistem hatasi ayni tabloda ama ayri sekmede: biri kim ne yapti, digeri ne bozuldu. Ayni listede karisirlarsa ikisi de okunmaz olur.',
		baglar: ['t-denetim'],
	},
	{
		kod: 'f-teklif-no',
		ad: 'teklif_yeni_no()',
		tur: 'islev',
		katman: 3,
		modul: 'teklif',
		ne: 'Sıradaki teklif numarası.',
		baglar: ['t-teklifler'],
	},

	{
		kod: 'sayfa-giris',
		ad: '/giris',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(giris)/giris/page.tsx',
		ne: 'Giriş ekranı.',
		baglar: ['giris-formu'],
	},
	{
		kod: 'sayfa-sifre',
		ad: '/sifre-sifirlama',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(giris)/sifre-sifirlama/page.tsx',
		ne: 'Şifre sıfırlama bağlantısıyla gelen kullanıcı yeni şifresini yazar.',
		baglar: ['supabase-tarayici'],
	},
	{
		kod: 'sayfa-ana',
		ad: '/ — Panel girişi',
		tur: 'sayfa',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/page.tsx',
		ne: 'Kullanıcının yetkili olduğu modüllerin kapısı.',
		neden: 'Modül kartları yetkiye göre süzülüyor; yetkisiz modül hiç görünmüyor.',
		baglar: ['lib-yetki', 't-firma-modulleri', 'panel-eylemler'],
	},
	{
		kod: 'panel-eylemler',
		ad: 'Panel eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/eylemler.ts',
		ne: 'firmaSec(): süperadminin baktığı firmayı değiştirir.',
		neden:
			'Seçim çerezde. Wellmop eklendiğinde seçici hiç yoktu — firmaSec() vardı ama onu çağıran ekran yazılmamıştı.',
		baglar: ['lib-yetki-firma'],
	},
	{
		kod: 'lib-yetki-firma',
		ad: 'lib/yetki/firma',
		tur: 'lib',
		katman: 2,
		modul: 'cekirdek',
		yol: 'lib/yetki/firma.ts',
		ne: 'islemFirmasi(): işlemin hangi firma adına yapıldığı.',
		neden:
			'Süperadmin bütün firmaları görebildiği için "hangi firma" sorusu her sorguda sorulmalı. Firma kimliği İSTEMCİDEN ALINMAZ.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 'sayfa-teklif-detay',
		ad: '/teklifler/[id]',
		tur: 'sayfa',
		katman: 1,
		modul: 'teklif',
		yol: 'app/(panel)/teklifler/[id]/page.tsx',
		ne: 'Teklif düzenleme: kalem ekleme, indirim, KDV.',
		baglar: ['t-teklifler', 't-teklif-kalemleri', 'teklif-eylemler'],
	},
	{
		kod: 'teklif-eylemler',
		ad: 'Teklif eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'teklif',
		yol: 'app/(panel)/teklifler/eylemler.ts',
		ne: 'Teklif ve kalem ekleme, güncelleme, durum değiştirme.',
		baglar: ['t-teklifler', 't-teklif-kalemleri', 'lib-teklif'],
	},
	{
		kod: 'ciro-eylemler',
		ad: 'Ciro eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/ciro/eylemler.ts',
		ne: 'Ciro girişi ve düzeltmesi.',
		baglar: ['t-ptp-cirolar'],
	},
	{
		kod: 'gorev-eylemler',
		ad: 'Görev tanımı eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/gorevler/eylemler.ts',
		ne: 'Görev tanımı ekleme, güncelleme, sıralama, pasife alma.',
		baglar: ['t-ptp-gorevler', 't-ptp-gorev-maddeleri'],
	},
	{
		kod: 'kroki-eylemler',
		ad: 'Kroki eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/kroki/eylemler.ts',
		ne: 'Bölüm ekleme ve kroki üzerinde konumlandırma.',
		baglar: ['t-ptp-bolumler'],
	},
	{
		kod: 'prim-eylemler',
		ad: 'Prim eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'ptp',
		yol: 'app/(panel)/ptp/prim/eylemler.ts',
		ne: 'Kademe ve maaş tanımlama.',
		baglar: ['t-ptp-prim-kademeleri', 't-ptp-maaslar'],
	},
	{
		kod: 'firma-eylemler',
		ad: 'Firma eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'cekirdek',
		yol: 'app/(panel)/ayarlar/firmalar/eylemler.ts',
		ne: 'Firma açma, modül açıp kapatma, pasife alma.',
		baglar: ['t-firmalar', 't-firma-modulleri'],
	},
	{
		kod: 'bildirim-eylemler',
		ad: 'Bildirim eylemleri',
		tur: 'eylem',
		katman: 1,
		modul: 'bildirim',
		yol: 'app/(panel)/ayarlar/bildirimler/eylemler.ts',
		ne: 'Telegram bağlama, webhook kurma, olay tercihlerini yazma.',
		neden:
			'webhookDurumu() son hatayı da döndürüyor ama Telegram o alanı hiç TEMİZLEMİYOR; bu yüzden yalnızca bekleyen mesaj varken kırmızı gösteriliyor.',
		baglar: ['lib-telegram', 't-telegram-ayarlari', 't-bildirim-tercihleri'],
	},
	{
		kod: 'uc-cikis',
		ad: 'POST /api/otp/cikis',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/cikis/route.ts',
		ne: 'Panel oturumunu kapatır.',
		neden:
			'Yerel programda kendi oturumunu kapatıyordu; panelde tek oturum var. Arayüzdeki çıkış düğmesi gizlendi ama uç duruyor.',
		baglar: ['supabase-sunucu'],
	},
	{
		kod: 'uc-odeme-tek',
		ad: '/api/otp/payments/[id]',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/payments/[id]/route.ts',
		ne: 'Tek ödemeyi günceller ya da siler.',
		baglar: ['t-otp-odemeler', 'otp-veri'],
	},
	{
		kod: 'uc-odeme-durum',
		ad: '/api/otp/payments/[id]/durum',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/payments/[id]/durum/route.ts',
		ne: 'Çek durumunu değiştirir (portföyde, tahsilde, ödendi…).',
		baglar: ['t-otp-odemeler'],
	},
	{
		kod: 'uc-odeme-toggle',
		ad: '/api/otp/payments/[id]/toggle',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/payments/[id]/toggle/route.ts',
		ne: 'Ödendi işaretini açıp kapatır.',
		neden:
			'Bu işaret DIA aktarımında KORUNUYOR: panel ödendi diyorsa DIA "bekliyor" dese bile geri alınmıyor.',
		baglar: ['t-otp-odemeler'],
	},
	{
		kod: 'uc-kredi-taksit',
		ad: '/api/otp/kredi-taksit',
		tur: 'uc',
		katman: 1,
		modul: 'otp',
		yol: 'app/api/otp/kredi-taksit/route.ts',
		ne: 'Kredi taksidini ödendi/geri al olarak işaretler.',
		baglar: ['t-otp-taksitler'],
	},
	{
		kod: 'f-bolge-yogunlugu',
		ad: 'ptp_bolge_yogunlugu()',
		tur: 'islev',
		katman: 3,
		modul: 'ptp',
		ne: 'Hangi bölümde kaç görev yapıldı.',
		baglar: ['t-ptp-kayitlar', 't-ptp-bolumler'],
	},

	{
		kod: 'sayfa-edp',
		ad: '/edp — Excel Dosya Yükleme',
		tur: 'sayfa',
		katman: 1,
		modul: 'edp',
		yol: 'app/(panel)/edp/page.tsx',
		ne: 'Tedarikçi PDF/Excel dosyasını okuyup Diaya yüklenecek Excel üretir.',
		neden:
			'ÖTPdeki "DIA raporu yükle" ile KARIŞTIRILMAMALI: o DIAdan veri ÇEKER, bu DIAya YÜKLENECEK dosyayı ÜRETİR. Yönleri ters. Modül kodu bu yüzden dia değil edp.',
		baglar: ['edp-arayuz', 'uc-edp-ayarlar'],
	},
	{
		kod: 'edp-arayuz',
		ad: 'public/edp/uygulama.html',
		tur: 'sayfa',
		katman: 0,
		modul: 'edp',
		yol: 'public/edp/uygulama.html',
		ne: 'Programın kendisi. ASIL KAYNAK — elle geliştiriliyor. Kodu public/edp/uygulama.js içinde.',
		neden:
			'İKİ AYRI KDV VAR ve karıştırılırsa her fiyat bozulur. FATURA kdv (belgede yazar, ne ödediğimizi belirler) ve ÜRÜN kdv (hiçbir belgede yazmaz, Dia F/J kolonlarını ve KDV hariç fiyatı belirler). Yarı fatura durumunda ayrışıyorlar: 100 TL ürün + %10 fatura = 110 ödenen; ürün %20 ise KDV hariç 110/1,2 = 91,67. F=20 ise J=1, F=10 ise J=2 — kural sabit, elle girilmez. pdf.js ve SheetJS panele gömülü.',
		baglar: ['edp-tasi'],
	},
	{
		kod: 'edp-tasi',
		ad: 'edp-ilk-tasima.mjs (arşiv)',
		tur: 'lib',
		katman: 2,
		modul: 'edp',
		yol: 'araclar/arsiv/edp-ilk-tasima.mjs',
		ne: 'İlk taşımayı yapan betik. ⛔ BİR DAHA ÇALIŞTIRILMAZ.',
		neden:
			'Taşımadan sonra panel sürümü kendi yoluna gitti: satır bazlı KDV, iki ayrı KDV kavramı (fatura/ürün), F-J kuralı. Bunların hiçbiri kaynak dosyada yok. Betik yeniden çalışırsa hepsini siler.',
		baglar: [],
	},
	{
		kod: 'uc-edp-ayarlar',
		ad: 'GET/PUT /api/edp/ayarlar',
		tur: 'uc',
		katman: 1,
		modul: 'edp',
		yol: 'app/api/edp/ayarlar/route.ts',
		ne: 'Tedarikçi oranları, Dia sabitleri, fiyat yüzdeleri ve kolon eşlemesi.',
		neden:
			'Yanıt biçimi programın localStorageda tuttuğu cfg nesnesiyle BİREBİR aynı; böylece arayüz kodu hiç değişmedi, yalnızca okuma/yazmanın yeri değişti. Kaydetme geciktirmeli: canlı fiyat kutuları her tuşta kaydediyor.',
		baglar: ['t-edp-ayarlar', 't-edp-tedarikciler'],
	},
	{
		kod: 't-edp-ayarlar',
		ad: 'edp_ayarlar',
		tur: 'tablo',
		katman: 3,
		modul: 'edp',
		yol: 'supabase/migrations/23_edp.sql',
		ne: 'Firma başına tek satır: Dia sabitleri, fiyat yüzdeleri, öğrenilmiş kolon eşlemesi.',
		neden:
			'Yereldeki program hepsini tarayıcıda tutuyordu; ikinci bilgisayardan girince yok oluyordu. Anlaşma oranları ve kolon eşlemesi iş bilgisidir.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 'uc-edp-urunler',
		ad: 'POST/PUT /api/edp/urunler',
		tur: 'uc',
		katman: 1,
		modul: 'edp',
		yol: 'app/api/edp/urunler/route.ts',
		ne: 'Ürün hafızası: barkod → öğrenilmiş ad ve ürün KDVsi.',
		neden:
			'POST ile SORULAN barkodlar dönüyor, tamamı değil: katalog binlere çıkacak ama bir listede birkaç yüz ürün var. Yazma yalnızca Excel indirildiğinde — indirmek onaylamak demek, ekranda oynanıp vazgeçilen değer hafızaya geçmemeli. Boş ad öğrenilmiş adı silmiyor.',
		baglar: ['t-edp-urunler'],
	},
	{
		kod: 't-edp-urunler',
		ad: 'edp_urunler',
		tur: 'tablo',
		katman: 3,
		modul: 'edp',
		yol: 'supabase/migrations/24_edp_urun_hafizasi.sql',
		ne: 'Barkod → öğrenilmiş ad, ürün KDVsi ve kaç kez görüldüğü.',
		neden:
			'Anahtar BARKOD: tedarikçi kodu ve adı değişebiliyor ama barkod ürünün kendisine ait. Ürünün KDVsi hiçbir belgede yazmadığı için tek öğrenme yolu bu. gorulme sayacı güvenilirlik göstergesi: bir kez düzeltilmiş ad ile otuz kez doğrulanmış ad aynı şey değil.',
		baglar: ['t-firmalar'],
	},
	{
		kod: 't-edp-tedarikciler',
		ad: 'edp_tedarikciler',
		tur: 'tablo',
		katman: 3,
		modul: 'edp',
		yol: 'supabase/migrations/23_edp.sql',
		ne: 'Grup kodu → KDV çarpanı. Tedarikçi anlaşması.',
		baglar: ['t-firmalar'],
	},
	/* ---------- Katman 4: dış ---------- */
	{
		kod: 'telegram',
		ad: 'Telegram Bot API',
		tur: 'dis',
		katman: 4,
		modul: 'bildirim',
		ne: 'Bildirim kanalı. Webhook ile karşılanır.',
		baglar: [],
	},
	{
		kod: 'cron',
		ad: 'pg_cron + pg_net',
		tur: 'dis',
		katman: 4,
		modul: 'bildirim',
		yol: 'supabase/migrations/15_telegram_cron.sql',
		ne: 'Zamanlı bildirimleri tetikler; veritabanından HTTP çağrısı yapar.',
		neden:
			'Vercel cron yerine bu seçildi: zamanlama verinin yanında dursun ve plan sınırına takılmasın.',
		baglar: [],
	},
	{
		kod: 'dia',
		ad: 'DIA — Excel raporu',
		tur: 'dis',
		katman: 4,
		modul: 'otp',
		ne: 'Çek-Senet ve Banka Kredi Taksit listeleri .xlsx olarak alınır.',
		baglar: [],
		sorun:
			'API anahtarı BEKLENİYOR (satis@dia.com.tr). Gelirse elle Excel indirmek bitecek. Alan eşlemesi ve durum sözlüğü hazır; sunucu kodu ve Squala/Wellmop tek hesap mı sorusu cevapsız.',
	},
	{
		kod: 'vercel',
		ad: 'Vercel',
		tur: 'dis',
		katman: 4,
		modul: 'cekirdek',
		ne: 'Yayın. Bölge fra1 — veritabanı Frankfurt\'ta.',
		neden:
			'Bölge ayrıldığında her işlem 2 saniye sürüyordu. Ortam değişkenleri burada: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_GIZLI, CRON_GIZLI_ANAHTAR.',
		baglar: [],
	},
];

/* ============================================================
   "ŞUNU YAPMAK İSTİYORUM" → NEREYE BAKILIR
   Haritanın en çok iş gören kısmı. Kod aramadan önce buraya.
   ============================================================ */

export type Yonlendirme = { istek: string; yer: string; not?: string };

export const NEREYE_BAK: Yonlendirme[] = [
	{
		istek: 'Yeni modül eklemek',
		yer: 'lib/tipler.ts (Modul türü) → migration (tablolar + RLS) → lib/bildirim/katalog.ts (olaylar) → app/(panel)/<modul>/',
		not: 'Olay kataloğuna yazmadan modül bitmiş sayılmaz.',
	},
	{
		istek: 'Yeni ekran eklemek',
		yer: 'app/(panel)/<yol>/page.tsx + eylemler.ts',
		not: 'Eylemin ilk satırı yetkiDenetle(). Ekranı gizlemek yetki değildir.',
	},
	{
		istek: 'Yeni tablo eklemek',
		yer: 'supabase/migrations/<sıradaki>_<ad>.sql',
		not: 'firma_id + RLS + anon\'dan revoke. Var olan tabloya kolon: alter table ... add column if not exists.',
	},
	{
		istek: 'Yeni veritabanı işlevi eklemek',
		yer: 'Migration içinde; set search_path YAZ ve grant execute to authenticated EKLE.',
		not: '18_ sonrası public rolüne EXECUTE verilmiyor; grant yazılmazsa sayfa "permission denied" ile düşer.',
	},
	{
		istek: 'ÖTP arayüzünde bir şey değiştirmek',
		yer: 'araclar/otp-arayuz-tasi.mjs → node araclar/otp-arayuz-tasi.mjs',
		not: 'public/otp/uygulama.html ELLE DÜZENLENMEZ; betik üretiyor.',
	},
	{
		istek: 'Yeni bildirim olayı eklemek',
		yer: 'lib/bildirim/katalog.ts; zamanlıysa lib/bildirim/zamanli.ts',
		not: 'Kod "modul.olay" biçiminde olmalı; veritabanı kısıtı zorluyor.',
	},
	{
		istek: 'Eksikler listesine yeni kategori eklemek',
		yer: 'lib/tipler.ts (EksikKategori + iki Record) → eksikler/page.tsx kategoriler dizisi → EksikFormu dizisi → migration (İKİ kısıt)',
		not: 'Dört yerden biri unutulursa satırlar kaydedilir ama görünmez.',
	},
	{
		istek: 'Yetki kuralını değiştirmek',
		yer: 'lib/yetki/index.ts + ilgili migration\'daki RLS politikaları',
		not: 'Politika genişletmek yetmez; daraltmak için eskisini drop etmek gerekir.',
	},
	{
		istek: 'Tarih doğrulaması yapmak',
		yer: 'lib/ortak/tarih.ts → gunGecerli()',
		not: 'Kopyalama. Aynı regex üç dosyaya yazılmıştı ve biri bozuktu.',
	},
	{
		istek: 'Para biçimlendirmek',
		yer: 'lib/ortak/para.ts',
	},
	{
		istek: 'Firma bilgisi (telefon, adres, vergi) değiştirmek',
		yer: 'lib/kurum.ts',
	},
	{
		istek: 'Bu haritayı güncellemek',
		yer: 'lib/harita/veri.ts',
		not: 'npm run kontrol sapmayı yakalar.',
	},
];

/* ============================================================
   TUZAKLAR — hepsi YAŞANDI
   ============================================================ */

export type Tuzak = { baslik: string; olan: string; kural: string };

export const TUZAKLAR: Tuzak[] = [
	{
		baslik: 'Aynı kural iki yere yazılmaz',
		olan: 'gunGecerli() regex\'i üç dosyaya kopyalanmıştı; birinde kaçış karakterleri bozuktu. İkisi doğru olduğu için hata gizlendi ve "Günü kapat" haftalarca çalışmadı.',
		kural: 'Doğrulama tek yerde yaşar, oradan çağrılır.',
	},
	{
		baslik: 'Sessiz catch olmaz',
		olan: 'Kredi özeti hiç çizilmedi; catch(e){} yüzünden konsolda iz yoktu. İki tur önbellek suçlandı.',
		kural: 'Yakala ama MUTLAKA yaz. Konsolda hata yoksa çökme değil erken çıkıştır.',
	},
	{
		baslik: 'window üzerinden let/const okunmaz',
		olan: 'ÖTP arayüzü DB\'yi "let DB" ile tanımlıyor; window.DB hep undefined kaldı ve özet sessizce atlandı.',
		kural: 'Klasik betikte üst seviye let/const global nesneye yazılmaz. typeof ile sına.',
	},
	{
		baslik: 'Beklenmeyen sunucu eylemi iptal olur',
		olan: 'void girisKaydet() hemen ardından yönlendirme; istek iptal oldu, son_giris hiç yazılmadı, giriş bildirimi hiç düşmedi.',
		kural: 'Yönlendirmeden önce await et; kendi try/catch\'inde tut ki hata girişi engellemesin.',
	},
	{
		baslik: 'RLS sessizce sıfır satır günceller',
		olan: 'Politika izin vermezse Supabase HATA DÖNDÜRMEZ, sadece hiçbir satır etkilenmez.',
		kural: 'Kritik güncellemede count: "exact" iste ve sıfırsa günlüğe yaz.',
	},
	{
		baslik: 'create table if not exists sessizce geçer',
		olan: 'ptp_ayarlar zaten vardı; yeni kolon eklenmedi ve tohum adımı patladı.',
		kural: 'Var olan tabloya kolon: alter table ... add column if not exists.',
	},
	{
		baslik: 'İzin veren RLS kısıtlamaz',
		olan: 'Yeni dar politika eklendi ama eski geniş politika duruyordu; PERMISSIVE politikalar OR ile birleşir.',
		kural: 'Daraltmak için önce drop policy.',
	},
	{
		baslik: 'Aynı liste iki kısıtta',
		olan: 'Eksik kategorisi hem ptp_eksikler hem ptp_gorevler kısıtında sayılı; biri genişletilince update diğerine takıldı.',
		kural: 'Kategori eklerken ikisini birden genişlet.',
	},
	{
		baslik: 'Betikle kod üretirken kaçış karakterleri',
		olan: 'Üretilen dosyada \\d yerine d yazıldı; düzenli ifade sessizce yanlış çalıştı.',
		kural: 'Üretilen çıktıda kaçışları gözle doğrula; büyük dosyada heredoc yerine dosya yaz.',
	},
	{
		baslik: 'Sabit dosya önbellekte kalır',
		olan: 'public/otp/uygulama.html adresi hiç değişmediği için tarayıcı yeni yayını almıyordu.',
		kural: 'Çerçeve adresine yayın kimliği ekli (?s=commit). Sabit varlık adresi sürümlenmeli.',
	},
	{
		baslik: 'Kalıp iki yere birden uyar',
		olan: 'Rapor sayfasında tabloyu değiştirirken kalıp önce KİŞİ tablosuna uydu; tip denetimi ve derleme geçti.',
		kural: 'Benzer blokları düzenlerken benzersiz çıpa kullan (başlık metni, satır aralığı).',
	},
	{
		baslik: 'Tohum eskiyince görünmez iş birikir',
		olan: '"Müşteri talepleri notu" görevi metin türünde tohumlanmıştı; eksik türü sonradan geldi, tohum güncellenmedi. Personel aylarca yazdı, kimse görmedi.',
		kural: 'Yeni görev türü eklendiğinde mevcut tohumlar gözden geçirilir.',
	},
];

/* ============================================================
   BEKLEYEN İŞLER — öncelik sırasıyla
   ============================================================ */

export type Oncelik = 'risk' | 'yarim' | 'yeni';

export const ONCELIK_ADLARI: Record<Oncelik, string> = {
	risk: 'Risk',
	yarim: 'Yarım kalmış',
	yeni: 'Yeni iş',
};

export type Bekleyen = {
	baslik: string;
	oncelik: Oncelik;
	modul: ModulKodu;
	neden: string;
	engel?: string;
};

export const BEKLEYENLER: Bekleyen[] = [
	{
		baslik: 'Yedekleme',
		oncelik: 'risk',
		modul: 'cekirdek',
		neden:
			'Supabase ücretsiz planında günlük yedek yok. Bir kaza bütün firmaların verisini götürür.',
		engel: 'Karar bekleniyor: Ayarlar\'a "Yedek indir" + aylık hatırlatma mı, Pro plan mı.',
	},
	{
		baslik: 'Prim personel görünümü',
		oncelik: 'yarim',
		modul: 'ptp',
		neden:
			'Prim hesabı çalışıyor ama personel kendi ilerlemesini göremiyor. Görmediği hedef motive etmiyor.',
	},
	{
		baslik: 'ÖTP Excel dışa aktarma',
		oncelik: 'yarim',
		modul: 'otp',
		neden: 'Uç var ama bilgi sayfası döndürüyor; rapor almak için hâlâ yerel program gerekiyor.',
	},
	{
		baslik: 'ÖTP günlük ekranı',
		oncelik: 'yarim',
		modul: 'otp',
		neden:
			'denetim_kayitlari artık /ayarlar/denetim ekranında görünüyor ama otp_gunluk hâlâ yazılıp okunmuyor. Yazılan ve okunmayan kayıt, olmayan kayıttır.',
	},
	{
		baslik: 'TTP — tahsilat takip taşınması',
		oncelik: 'yeni',
		modul: 'cekirdek',
		neden: 'ttp/wellmop-tahsilat klasörü duruyor; ÖTP taşıma yöntemi kanıtlandı, aynısı uygulanabilir.',
	},
	{
		baslik: 'Fotoğraf yükleme',
		oncelik: 'yarim',
		modul: 'ptp',
		neden: 'ptp-fotograf kovası ve RLS hazır, yükleme arayüzü yok.',
		engel: 'Kaan en sona bıraktı.',
	},
	{
		baslik: 'Sözleşme şablonu',
		oncelik: 'yeni',
		modul: 'teklif',
		neden: 'Teklif kabul edilince sıradaki belge bu; teklif altyapısı aynen kullanılabilir.',
	},
	{
		baslik: 'DIA API bağlantısı',
		oncelik: 'yeni',
		modul: 'otp',
		neden: 'Elle Excel indirmek bitsin.',
		engel:
			'API anahtarı bekleniyor. Ayrıca sunucu kodu ve Squala/Wellmop tek DIA hesabı mı sorusu cevapsız.',
	},
	{
		baslik: 'Migration 19 boşluğu',
		oncelik: 'yarim',
		modul: 'cekirdek',
		neden:
			'19 numara atlandı: kaan şeması sıkılaştırması panele ait olmadığı için yazılmadı. Numara boş kalması karışıklık yaratabilir.',
	},
	{
		baslik: 'Ölü kod temizliği',
		oncelik: 'yeni',
		modul: 'cekirdek',
		neden:
			'Taslak uçlar, kullanılmayan dışa aktarımlar ve ezilmiş SQL işlev tanımları birikti. ÖNCE RAPOR, sonra silme: liste onaylanmadan tek satır silinmez. Üç kovaya ayrılır — kanıtlanmış ölü (silinir), yarım kalmış (silinmez, bitirilir), ezilmiş migration (hiç dokunulmaz, sadece nota geçer). Kanıt elle okumayla değil araçla toplanır: noUnusedLocals, knip ve harita denetimi.',
		engel:
			'YEDEKLEMEDEN SONRA yapılır. Yedeği olmayan veritabanında silme işine girmek ters sıradır. Ayrıca bu oturumda iki kez görüldü: kullanılmayan görünen şey ölü değil BOZUK olabiliyor (son_giris kolonu, oturum_acildi olayı). Silmeden önce her aday için hangi kova olduğu kanıtlanmalı.',
	},
	{
		baslik: 'Supabase istemcilerinin tiplenmesi',
		oncelik: 'yarim',
		modul: 'cekirdek',
		neden:
			'İstemciler tipsiz: createServerClient(...) çağrısında <Database> yok. Bu yüzden .from("herhangibirsey") derleniyor ve her sorgu sonucu elle "as" ile dönüştürülüyor. Yol hazır: npm run tipler çıktıyı lib/veritabani.ts dosyasına yazıyor, sonra üç istemciye tür geçilecek.',
		engel:
			'Supabase kişisel erişim jetonu üretilip kabuğa verilmeli — jeton depoya ve sohbete yazılmaz. Ara çözüm çalışıyor: harita denetimi kodun sorguladığı her tablo adını migration dosyalarındaki canlı tablo kümesiyle karşılaştırıyor; ölü tabloya sorgu yazılırsa npm run kontrol düşüyor.',
	},
];

/* ============================================================
   ÖLÜ TABLOLAR — düşürüldü ya da adı değişti
   Yeni gelenin en çok kaybolduğu yer burası.
   ============================================================ */

export const OLU_TABLOLAR: { ad: string; ne_oldu: string }[] = [
	{ ad: 'ptp_sablonlar', ne_oldu: '5_ ile ptp_gorevler adını aldı.' },
	{ ad: 'ptp_sablon_maddeleri', ne_oldu: '5_ ile ptp_gorev_maddeleri adını aldı.' },
	{
		ad: 'ptp_gorevler (eski)',
		ne_oldu:
			'Gün gün satır tutan ESKİ tablo 5_ ile düşürüldü. Bugünkü ptp_gorevler TANIM tablosudur.',
	},
	{ ad: 'ptp_gorev_kayitlari', ne_oldu: '5_ ile düşürüldü; yerine ptp_kayitlar.' },
	{ ad: 'ptp_personeller', ne_oldu: 'Personel kullanıcı oldu; kullanicilar tablosuna taşındı.' },
	{ ad: 'ptp_giris_kayitlari', ne_oldu: 'Düşürüldü.' },
	{ ad: 'ptp_gunluk_satis / ptp_gunluk_yemek', ne_oldu: 'İlk tasarımdan kalma; kullanılmıyor.' },
];
