-- ============================================================
-- ŞABLON TEKRARI TEMİZLİĞİ VE ÖNLENMESİ
--
-- kurulum-verisi.sql iki kez çalıştırıldı ve şablonlar ikiye katlandı.
-- Sebep: o dosyadaki ptp_sablonlar insert'inde `on conflict` yoktu.
-- Diğer bütün eklemelerde vardı, orada unutulmuştu.
--
-- Bu dosya üç iş yapar:
--   1. Üretilmiş görevleri siler (test verisi)
--   2. Tekrarlanan şablonları siler, her birinden bir tane bırakır
--   3. Bir daha tekrarlanmasını veri tabanı seviyesinde imkânsız kılar
--
-- ⚠️ 1. adım BÜTÜN görev kayıtlarını siler. Temiz başlangıç kararı
-- gereği elde yalnızca deneme kaydı var. Gerçek veri girdikten sonra
-- böyle bir temizlik ASLA toptan yapılmaz.
-- ============================================================


-- ---------- 1. Üretilmiş görevleri sil ----------
-- Tekrarlanan şablonlardan üretildikleri için onlar da tekrarlı.
-- Şablonlar temizlendikten sonra panelden yeniden üretilecek.

delete from panel.ptp_gorevler;


-- ---------- 2. Tekrarlanan şablonları temizle ----------
-- Her (firma, grup, başlık) üçlüsünden en eskisi kalır.

delete from panel.ptp_sablonlar s
 where s.id not in (
   select distinct on (firma_id, grup, baslik) id
     from panel.ptp_sablonlar
    order by firma_id, grup, baslik, olusturuldu, id
 );


-- ---------- 3. Tekrarı veri tabanı engellesin ----------
-- Kısmi indeks: yumuşak silinen kayıtlar sayılmaz, yoksa bir şablon
-- silinip aynı adla yeniden açılamazdı.

create unique index if not exists ptp_sablonlar_benzersiz
  on panel.ptp_sablonlar (firma_id, grup, baslik)
  where silindi is null;


-- ---------- 4. Aynı gün aynı şablondan iki görev üretilmesin ----------
-- Uygulama zaten denetliyor ama iki istek aynı anda gelirse ikisi de
-- "yok" görüp ikisi de yazabilir. Kısıt bunu kapatır.

create unique index if not exists ptp_gorevler_gun_sablon
  on panel.ptp_gorevler (firma_id, tarih, sablon_id)
  where sablon_id is not null and silindi is null;


-- ---------- Doğrulama ----------

select 'sablon'  as tablo, count(*) from panel.ptp_sablonlar
union all
select 'gorev', count(*) from panel.ptp_gorevler;
