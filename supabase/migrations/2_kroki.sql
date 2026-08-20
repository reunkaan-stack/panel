-- ============================================================
-- 2_  MAĞAZA KROKİSİ
--
-- Yönetici mağazanın planını çiziyor: bir dikdörtgen içine "ön alan",
-- "raf 1", "depo" gibi bölümler. Çizilen her dikdörtgen BİR BÖLGEDİR —
-- ayrı tablo açılmıyor, `ptp_bolumler` geometri kazanıyor.
--
-- Sebep: "bölge" ile "krokideki kutu" aynı şey. İki tabloya bölmek,
-- ikisini eşlemek ve senkron tutmak demek olurdu; biri silinince
-- diğeri öksüz kalırdı.
--
-- Amaç: temizlik görevlerinde hangi bölümün ne sıklıkla seçildiğini
-- kroki üzerinde görmek.
-- ============================================================


-- ---------- Geometri ----------
-- Koordinatlar 1000 x 600 birimlik sabit bir çizim alanında tutulur.
-- Ondalık yerine tam sayı: yuvarlama hatası olmaz, karşılaştırma
-- kolaydır. Ekranda bu alan orantılı ölçeklenir.

alter table panel.ptp_bolumler
  add column if not exists kroki_x     integer,
  add column if not exists kroki_y     integer,
  add column if not exists kroki_en    integer,
  add column if not exists kroki_boy   integer,
  add column if not exists renk        text;

comment on column panel.ptp_bolumler.kroki_x is
  'Krokideki sol kenar (0-1000). NULL ise bölge krokiye yerleştirilmemiş.';
comment on column panel.ptp_bolumler.renk is
  'İsteğe bağlı ayırt edici renk. Boşsa arayüz kendi tonunu kullanır.';

-- Krokiye yerleştirilmişse dört değer birden dolu olmalı
alter table panel.ptp_bolumler
  drop constraint if exists bolum_kroki_tutarli;

alter table panel.ptp_bolumler
  add constraint bolum_kroki_tutarli check (
    (kroki_x is null and kroki_y is null and kroki_en is null and kroki_boy is null)
    or
    (kroki_x is not null and kroki_y is not null
     and kroki_en is not null and kroki_boy is not null
     and kroki_en > 0 and kroki_boy > 0
     and kroki_x >= 0 and kroki_y >= 0
     and kroki_x + kroki_en <= 1000
     and kroki_y + kroki_boy <= 600)
  );


-- ---------- Isı haritası görünümü ----------
-- Hangi bölge kaç kez seçildi. İki kaynaktan toplanır:
--   ptp_gorevler          → tek seferlik tamamlanma
--   ptp_gorev_kayitlari   → tekrarlanabilir görevlerin her tekrarı
--
-- ⚠️ security_invoker = on ZORUNLU. Postgres'te görünümler varsayılan
-- olarak oluşturanın yetkisiyle çalışır ve RLS'i atlar; çok firmalı
-- bir sistemde bu, bir müşterinin diğerinin verisini görmesi demektir.

create or replace view panel.ptp_bolge_yogunlugu
with (security_invoker = on) as
  select b.id                as bolge_id,
         b.firma_id,
         b.ad,
         k.tarih,
         count(*)            as adet
    from panel.ptp_bolumler b
    join lateral (
      select g.tarih
        from panel.ptp_gorevler g
       where g.deger_bolge_id = b.id
         and g.silindi is null
      union all
      select kay.zaman::date as tarih
        from panel.ptp_gorev_kayitlari kay
       where kay.deger_bolge_id = b.id
    ) k on true
   where b.silindi is null
   group by b.id, b.firma_id, b.ad, k.tarih;

revoke all on panel.ptp_bolge_yogunlugu from anon;
grant select on panel.ptp_bolge_yogunlugu to authenticated, service_role;


-- ---------- Mevcut bölümlere başlangıç yerleşimi ----------
-- Kurulumda on bölüm eklenmişti ama krokide yerleri yok. Yönetici
-- sürükleyerek düzenleyecek; başlangıçta ızgaraya diziliyorlar ki
-- kroki boş açılmasın.

with sirali as (
  select id,
         row_number() over (order by sira, ad) - 1 as n
    from panel.ptp_bolumler
   where silindi is null and kroki_x is null
)
update panel.ptp_bolumler b
   set kroki_x   = (s.n % 5) * 200 + 10,
       kroki_y   = (s.n / 5) * 150 + 10,
       kroki_en  = 180,
       kroki_boy = 130
  from sirali s
 where b.id = s.id;


-- ---------- Doğrulama ----------

select ad,
       kroki_x, kroki_y, kroki_en, kroki_boy
  from panel.ptp_bolumler
 where silindi is null
 order by kroki_y, kroki_x;
