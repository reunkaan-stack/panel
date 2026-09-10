-- ============================================================
-- 20_  MÜŞTERİ TALEPLERİ EKSİKLER LİSTESİNE AKIYOR
--
-- SORUN: "Musteri talepleri notu" görevi 'metin' türünde tanımlanmış.
-- Metin türü yazılanı ptp_kayitlar.deger_metin'e koyar ve o değer
-- ekranda TEK BİR YERDE görünür: o günün görev satırında, "ayrıntı"
-- düğmesinin arkasında. Ertesi gün pratikte kaybolur.
--
-- Personel aylardır yazıyor, kimse göremiyor.
--
-- NEDEN BÖYLE OLMUŞ: bu görev 1_ numaralı dosyada tohumlandı; 'eksik'
-- görev türü ise 6_ ile geldi. 6_ yalnızca "Eksik urun tespiti"
-- görevini çevirmiş, bu görev gözden kaçmış.
--
-- ÇÖZÜM ÜÇ PARÇALI:
--   A. ptp_eksikler yeni bir kategori kabul etsin: 'musteri'
--   B. Görev 'eksik' türüne çevrilsin, kategorisi atansın
--   C. GEÇMİŞTE YAZILMIŞ notlar eksikler listesine taşınsın
--
-- C ŞART: yalnızca A ve B yapılırsa bundan sonrası görünür ama
-- geçmiş görünmez kalır. Veri kaybı olmasın diye taşınıyor.
-- ============================================================


-- ---------- A. Yeni kategori ----------

alter table panel.ptp_eksikler
  drop constraint if exists ptp_eksikler_kategori_check;

alter table panel.ptp_eksikler
  add constraint ptp_eksikler_kategori_check
  check (kategori in ('urun','temel','musteri'));

comment on column panel.ptp_eksikler.kategori is
  'urun = fuardan toplanir, temel = marketten alinir, musteri = musterinin isteyip bulamadigi urun.';

/* İKİNCİ KISIT. Kategori iki ayrı tabloda geçiyor: ptp_eksikler'de
   satırın kendisi, ptp_gorevler'de görevin hangi listeye yazacağı.
   İkisi de listeyi ayrı ayrı sayıyor; yalnızca birini genişletmek
   "violates check constraint gorev_eksik_kategori_tutarli" veriyor.

   Aynı kural iki yere yazılmış — 04-KOD.md'deki kuralın veritabanı
   karşılığı. Şimdilik ikisi birden güncelleniyor. */

alter table panel.ptp_gorevler
  drop constraint if exists gorev_eksik_kategori_tutarli;

alter table panel.ptp_gorevler
  add constraint gorev_eksik_kategori_tutarli check (
    (tur = 'eksik' and eksik_kategori in ('urun','temel','musteri'))
    or (tur <> 'eksik' and eksik_kategori is null)
  );


-- ---------- B. Görev tanımları ----------
-- Başlığa göre eşleşiyor: görevler her firmaya ayrı satır olarak
-- tohumlandı, kimlikleri farklı. Kullanıcı başlığı değiştirmiş
-- olabileceği için kalıp geniş tutuldu ama TÜR de şart koşuldu —
-- zaten 'eksik' olan bir görev yanlışlıkla yeniden yazılmasın.

update panel.ptp_gorevler
   set tur = 'eksik',
       eksik_kategori = 'musteri'
 where tur = 'metin'
   and silindi is null
   and baslik ilike '%talep%';

/* "Eksik urun tespiti" görevine DOKUNULMUYOR: 6_eksik_gorevi.sql
   onu zaten 'eksik'/'urun' türüne çevirmiş. Burada tekrar denemek
   gereksiz; bırakılırsa sonraki okuyan iki dosyanın çeliştiğini
   sanır. */


-- ---------- C. Geçmiş notların taşınması ----------
-- Her kayıt bir eksik satırı oluyor. Bildiren ve tarih korunuyor:
-- "bu ürün hangi gün, kim tarafından bildirildi" sorusu duruyor.
--
-- kayit_id üzerinden tekilleştiriliyor; dosya iki kez çalıştırılırsa
-- aynı not ikinci kez eklenmiyor.
--
-- Boş ve yalnızca boşluktan ibaret metinler alınmıyor: ptp_eksikler'de
-- metnin dolu olmasını şart koşan bir kısıt var, yoksa dosya patlar.

insert into panel.ptp_eksikler
  (firma_id, metin, kategori, bildiren_id, gorev_id, kayit_id, olusturuldu)
select k.firma_id,
       btrim(k.deger_metin),
       g.eksik_kategori,
       k.yapan_id,
       k.gorev_id,
       k.id,
       k.zaman
  from panel.ptp_kayitlar k
  join panel.ptp_gorevler g on g.id = k.gorev_id
 where g.tur = 'eksik'
   /* YALNIZCA MÜŞTERİ TALEPLERİ. Kısıt "eksik türündeki her görev"
      olsaydı "Eksik urun tespiti"nin 6_'dan ÖNCEKİ metin kayıtları da
      dolardı: aylar önce bildirilmiş, çoktan temin edilmiş ürünler
      bugün "bekliyor" damgasıyla listeye düşerdi. Var olmayan iş
      üretmek, işi görünmez bırakmaktan daha kötü.

      O kayıtlar duruyor, silinmedi. İstenirse aşağıdaki satır
      'musteri' yerine 'urun' yazılarak ayrıca çalıştırılabilir. */
   and g.eksik_kategori = 'musteri'
   and k.deger_metin is not null
   and length(btrim(k.deger_metin)) > 0
   and not exists (
     select 1 from panel.ptp_eksikler e where e.kayit_id = k.id
   );


-- ---------- Doğrulama ----------

-- a) Hangi görevler çevrildi
select f.kisa_ad,
       g.baslik,
       g.tur,
       g.eksik_kategori
  from panel.ptp_gorevler g
  join panel.firmalar f on f.id = g.firma_id
 where g.tur = 'eksik'
   and g.silindi is null
 order by f.kisa_ad, g.baslik;

-- b) Kategori başına kaç eksik var — 'musteri' satırı DOLU çıkmalı
select f.kisa_ad,
       e.kategori,
       e.durum,
       count(*) as adet
  from panel.ptp_eksikler e
  join panel.firmalar f on f.id = e.firma_id
 where e.silindi is null
 group by f.kisa_ad, e.kategori, e.durum
 order by f.kisa_ad, e.kategori, e.durum;

-- c) Taşınan en son 20 müşteri talebi — gözle kontrol için
select e.olusturuldu::date as gun,
       e.metin,
       k.ad as bildiren
  from panel.ptp_eksikler e
  left join panel.kullanicilar k on k.id = e.bildiren_id
 where e.kategori = 'musteri'
   and e.silindi is null
 order by e.olusturuldu desc
 limit 20;

-- d) Hâlâ görünmeyen metin kaydı kaldı mı — BOŞ ÇIKMALI
select g.baslik, count(*) as gorunmeyen_kayit
  from panel.ptp_kayitlar k
  join panel.ptp_gorevler g on g.id = k.gorev_id
 where g.tur = 'metin'
   and k.deger_metin is not null
   and length(btrim(k.deger_metin)) > 0
 group by g.baslik;
