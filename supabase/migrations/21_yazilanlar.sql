-- ============================================================
-- 21_  GÖREVE YAZILANLAR RAPORA GİRİYOR
--
-- Bir görev yapılırken yazılan metin (deger_metin) ya da girilen
-- sayı (deger_sayi) hiçbir rapora girmiyordu. Tek görünme yeri o
-- günün görev satırında "ayrıntı" düğmesinin arkasıydı; ertesi gün
-- pratikte ulaşılamıyordu.
--
-- Atlama sebepleri KAPSAM DIŞI: onlar zaten ptp_atlananlar ile
-- "Sebepler" bölümünde duruyor. İkisi ayrı kalıyor çünkü biri
-- YAPILAN işin içeriği, diğeri YAPILMAYANIN gerekçesi; tek listede
-- karışırlarsa ikisi de okunmaz olur.
--
-- Rapor sayfasında "Görev bazında" tablosunun satırına gömülüyor:
-- göreve tıklayınca o görevin seçili aralıktaki girdileri açılıyor.
-- Ayrı bölüm açılmadı, sayfa uzamasın diye.
-- ============================================================

create or replace function panel.ptp_yazilanlar(
  p_firma_id uuid, p_baslangic date, p_bitis date
)
returns table (
  gorev_id uuid, tarih date, kisi text, metin text, sayi numeric
)
language sql stable
set search_path = panel, public
as $$
  select k.gorev_id,
         k.tarih,
         u.ad,
         nullif(btrim(k.deger_metin), ''),
         k.deger_sayi
    from panel.ptp_kayitlar k
    left join panel.kullanicilar u on u.id = k.yapan_id
   where k.firma_id = p_firma_id
     and k.tarih between p_baslangic and p_bitis
     and k.durum = 'yapildi'
     /* Boş metin ve boş sayı satır açmasın: onay türü görevlerin
        kayıtlarında iki alan da boş, hepsi gelseydi tablo şişerdi. */
     and (
       (k.deger_metin is not null and length(btrim(k.deger_metin)) > 0)
       or k.deger_sayi is not null
     )
   order by k.tarih desc, k.zaman desc;
$$;

comment on function panel.ptp_yazilanlar(uuid, date, date) is
  'Gorev yapilirken yazilan metin ve girilen sayilar. Atlama sebepleri haric; onlar ptp_atlananlar ile geliyor.';


-- ---------- Yetki ----------
-- 18_ ile birlikte panel şemasındaki fonksiyonlarda EXECUTE artık
-- public rolüne verilmiyor; varsayılan yetki de öyle ayarlandı.
-- Bu yüzden YENİ fonksiyona grant AÇIKÇA yazılmalı — yazılmazsa
-- rapor sayfası "permission denied" ile düşer.

revoke execute on function panel.ptp_yazilanlar(uuid, date, date) from public;
grant execute on function panel.ptp_yazilanlar(uuid, date, date)
  to authenticated, service_role;


-- ---------- Doğrulama ----------

-- a) Fonksiyon çağrılabiliyor mu ve ne dönüyor
select count(*) as yazilan_girdi_sayisi
  from panel.ptp_yazilanlar(
    (select id from panel.firmalar order by olusturuldu limit 1),
    current_date - 90,
    current_date
  );

-- b) Hangi görevlerde girdi var — tabloda hangi satırlar açılabilir
select g.baslik, count(*) as girdi
  from panel.ptp_kayitlar k
  join panel.ptp_gorevler g on g.id = k.gorev_id
 where k.durum = 'yapildi'
   and (
     (k.deger_metin is not null and length(btrim(k.deger_metin)) > 0)
     or k.deger_sayi is not null
   )
 group by g.baslik
 order by girdi desc;

-- c) Yetki yerinde mi — authenticated true, public false olmalı
select has_function_privilege('authenticated',
         'panel.ptp_yazilanlar(uuid,date,date)', 'execute') as authenticated,
       has_function_privilege('public',
         'panel.ptp_yazilanlar(uuid,date,date)', 'execute') as public_rolu;
