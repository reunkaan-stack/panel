-- ============================================================
-- 24_  EDP ÜRÜN HAFIZASI
--
-- Program aynı ürünü her seferinde ilk kez görüyormuş gibi
-- davranıyordu:
--
--   · Listede "BLS05 SİLİKAT KAVANOZ" yazıyor, Kaan bunu
--     "Akasya 150ml cam kavanoz" diye düzeltiyor. İki gün sonra
--     aynı barkod geliyor, düzeltme yeniden yapılıyor.
--
--   · Ürünün KDV'si hiçbir belgede yazmıyor. Tekstil %10, gerisi
--     %20. Her listede yeniden işaretleniyordu.
--
--   · Elle yuvarlanan satış fiyatı (487,50 → 500) unutuluyordu.
--
-- ANAHTAR BARKOD. Tedarikçi kodu ve ürün adı değişebiliyor ama
-- barkod ürünün kendisine ait; programda da çapa o. Barkodsuz satır
-- öğrenilmiyor — program zaten o hücreyi sarı yapıp elle yazdırıyor.
--
-- NE ZAMAN YAZILIR: Excel İNDİRİLDİĞİNDE. "İndirdim" = "onayladım";
-- ekranda oynanıp vazgeçilen değer hafızaya geçmiyor.
-- ============================================================

create table if not exists panel.edp_urunler (
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,
  barkod      text not null,

  -- ---------- Öğrenilen ----------

  /* Kaan'ın verdiği temiz ad. Boş olabilir: yalnızca KDV
     düzeltilmiş olabilir. */
  ad          text not null default '',

  /* Ürünün GERÇEK KDV'si — faturanınki DEĞİL. Fatura %10 kesilse
     bile ürün %20 olabiliyor (yarı fatura); Dia'nın F ve J
     kolonlarını bu belirliyor. */
  kdv         smallint check (kdv in (10, 20)),

  /* Son görülen stok kodu ve tedarikçi. Aynı ürün birden fazla
     tedarikçiden gelebiliyor; burada EN SON görüleni duruyor,
     tamamı alış geçmişinde olacak. */
  kod           text not null default '',
  son_tedarikci text not null default '',

  -- ---------- Öneri için saklananlar ----------

  /* Elle yuvarlanan satış fiyatı (fiyat4). ÖNERİ olarak gösterilir,
     kutuyu KENDİLİĞİNDEN DOLDURMAZ: alış fiyatı yükselmişse eski
     satış fiyatıyla devam etmek kâr marjını sessizce eritir.
     Kullanıcı geçmişi görür, kararı kendi verir. */
  son_satis_fiyati numeric(14,2),

  /* Son alış — KDV HARİÇ (fiyat1). Zam karşılaştırması bununla
     yapılıyor: KDV dahil tutar üzerinden karşılaştırmak, fatura
     KDV'si değiştiğinde sahte zam gösterirdi.

     ⚠️ BU BİR ÖNBELLEK. Alışların tamamı ileride edp_alislar
     tablosunda tutulacak ve ASIL KAYNAK o olacak. Burada
     durmasının sebebi sıcak yol: dosya yüklenirken zaten barkoda
     göre bu tablo okunuyor, zam uyarısı için ikinci bir sorgu ve
     "her barkodun en sonuncusu" hesabı gerekmesin diye. İkisi
     AYNI yazma işleminde güncellenir. */
  son_alis_fiyati  numeric(14,2),
  son_alis_tarihi  date,

  /* Serbest not: "bu ürün artık gelmiyor", "ambalajı değişti" gibi.
     Şimdilik arayüzde yok, ileride ürün kartına eklenecek. */
  notlar      text not null default '',

  /* Kaç kez görüldü. Bir kez düzeltilmiş ad ile otuz kez
     doğrulanmış ad aynı güvenilirlikte değil. */
  gorulme     integer not null default 1,

  guncelleyen_id uuid references panel.kullanicilar(id) on delete set null,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),

  primary key (firma_id, barkod)
);

comment on table panel.edp_urunler is
  'EDP urun hafizasi: barkod -> ogrenilmis ad, urun KDVsi, son alis ve satis fiyati.';
comment on column panel.edp_urunler.kdv is
  'Urunun gercek KDVsi (10 ya da 20). Fatura KDVsi DEGIL.';
comment on column panel.edp_urunler.son_alis_fiyati is
  'KDV haric son alis. edp_alislar geldiginde onun onbellegi olacak.';

/* "Son neler aldım" ve ürün arama ekranları için. */
create index if not exists edp_urunler_son_alis
  on panel.edp_urunler (firma_id, son_alis_tarihi desc nulls last);

drop trigger if exists t_edp_urunler_guncellendi on panel.edp_urunler;
create trigger t_edp_urunler_guncellendi before update on panel.edp_urunler
  for each row execute function panel.guncellendi_yaz();


-- ---------- RLS ----------

alter table panel.edp_urunler enable row level security;

drop policy if exists edp_urunler_okuma on panel.edp_urunler;
create policy edp_urunler_okuma on panel.edp_urunler for select
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') is not null)
  );

drop policy if exists edp_urunler_yazma on panel.edp_urunler;
create policy edp_urunler_yazma on panel.edp_urunler for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') in ('yazma','yonetim'))
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') in ('yazma','yonetim'))
  );

grant select, insert, update, delete on panel.edp_urunler
  to authenticated, service_role;
revoke all on panel.edp_urunler from anon;


-- ---------- Doğrulama ----------

-- a) Tablo ve RLS
select relname, relrowsecurity as rls_acik
  from pg_class where relname = 'edp_urunler';

-- b) Hafızada ne var — Excel indirdikçe dolar
select f.kisa_ad,
       count(*) as urun,
       count(*) filter (where u.ad <> '')            as adi_ogrenilmis,
       count(*) filter (where u.kdv = 10)            as tekstil_yuzde10,
       count(*) filter (where u.son_satis_fiyati is not null) as satis_fiyati_var
  from panel.edp_urunler u
  join panel.firmalar f on f.id = u.firma_id
 group by f.kisa_ad;

-- c) En son aldıkların
select barkod, ad, kod, son_tedarikci,
       son_alis_fiyati, son_alis_tarihi, son_satis_fiyati, gorulme
  from panel.edp_urunler
 order by son_alis_tarihi desc nulls last
 limit 20;
