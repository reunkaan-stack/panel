-- ============================================================
-- 14_  TELEGRAM
--
-- Yerel programda çalışan Telegram bağlantısı panele taşınıyor.
-- Ayar kolonlarının bir kısmı (telegram_aktif, telegram_chat_id,
-- gunluk_ozet_saati, kapanis_hatirlatma_saati) ilk kurulumdan beri
-- ptp_ayarlar içinde duruyordu; eksikler ekleniyor.
--
-- İKİ YAPISAL FARK:
--
-- 1. Dinleme yöntemi değişiyor. Yerel program getUpdates ile sürekli
--    döngüde bekliyordu; sunucusuz ortamda sürekli çalışan bir süreç
--    yok. Telegram bize WEBHOOK ile gelecek.
--
-- 2. "Bugünün özeti gönderildi mi" bilgisi belleğe değil TABLOYA
--    yazılıyor. Yerel programda değişkende tutuluyordu ve program
--    kapanınca sıfırlanıyordu; sunucusuzda her çağrı yeni bir süreç,
--    bellekte hiçbir şey kalmıyor. Damga olmadan özet dakikada bir
--    tekrar giderdi.
-- ============================================================


-- ---------- A. Eksik ayar kolonları ----------

alter table panel.ptp_ayarlar
  -- Her görev kapatıldığında haber verilsin mi. Günde ~23 görev var;
  -- kapatılabilir olmalı.
  add column if not exists telegram_gorev_bildir boolean not null default true,
  -- Gönderim damgaları: aynı gün ikinci kez gönderilmesin
  add column if not exists ozet_gonderilen_gun date,
  add column if not exists hatirlatma_gonderilen_gun date;

/* Webhook'tan gelen mesaj chat_id ile firmaya bağlanıyor. */
create index if not exists ptp_ayarlar_chat
  on panel.ptp_ayarlar (telegram_chat_id)
  where telegram_chat_id is not null;

comment on column panel.ptp_ayarlar.ozet_gonderilen_gun is
  'Gunluk ozetin en son gonderildigi gun. Ayni gun tekrar gonderilmesini engeller.';


-- ---------- B. Squala ayarları ----------
-- Chat id yerel programdaki değerle aynı. Jeton BURAYA YAZILMIYOR:
-- ortam değişkeninde duruyor. Veri tabanına yazılsaydı yedeklerde,
-- günlüklerde ve ekran görüntülerinde dolaşırdı.

update panel.ptp_ayarlar
   set telegram_chat_id = '1690340527',
       telegram_aktif = false
 where firma_id in (select id from panel.firmalar where kisa_ad = 'squala')
   and coalesce(telegram_chat_id, '') = '';

/* telegram_aktif = false ile başlıyor: yeni jeton Vercel'e girilip
   webhook kurulmadan açılırsa mesajlar sessizce kaybolur. Ayarlar
   ekranından elle açılacak. */


-- ---------- C. Zamanlanmış tetikleyici ----------
-- Vercel'in ücretsiz planında sık çalışan zamanlanmış iş yok; tetiği
-- Supabase'in kendi zamanlayıcısı çekiyor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

/* Eski iş varsa temizlensin — betik tekrar çalıştırılabilir olmalı. */
do $temizle$
begin
  perform cron.unschedule('ptp_telegram_zamanli');
exception when others then
  null;  -- iş yoksa hata verir, sorun değil
end
$temizle$;

comment on extension pg_cron is
  'Zamanlanmis isler. ptp_telegram_zamanli isi panel ucunu tetikler.';


-- ---------- Doğrulama ----------
-- İşin kendisi 15_telegram_cron.sql ile kurulacak: panel adresi ve
-- gizli anahtar orada yazılacağı için ayrı dosyada.

select firma_id, telegram_aktif, telegram_chat_id,
       gunluk_ozet_saati, kapanis_hatirlatma_saati, telegram_gorev_bildir
  from panel.ptp_ayarlar;
