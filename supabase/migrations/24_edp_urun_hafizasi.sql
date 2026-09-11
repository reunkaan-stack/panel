-- ============================================================
-- 24_  EDP ÜRÜN HAFIZASI
--
-- Program aynı ürünü her seferinde ilk kez görüyormuş gibi
-- davranıyordu. Oysa:
--
--   · Tedarikçi listesinde "BLS05 SİLİKAT KAVANOZ" yazıyor,
--     Kaan bunu "Akasya 150ml cam kavanoz" diye düzeltiyor.
--     İki gün sonra aynı barkod geliyor, düzeltme yeniden
--     yapılıyor.
--
--   · Ürünün KDV'si hiçbir belgede yazmıyor. Tekstil ürünü %10,
--     gerisi %20. Her listede yeniden işaretlemek gerekiyordu.
--
-- Bu tablo BARKODU hatırlıyor: bir kez düzeltilen ad ve KDV,
-- aynı barkod tekrar geldiğinde kendiliğinden geliyor.
--
-- Ne zaman yazılır: Excel İNDİRİLDİĞİNDE. "İndirdim" demek
-- "bunu onayladım" demek; sadece ekranda oynanan bir değer
-- hafızaya geçmiyor.
-- ============================================================

create table if not exists panel.edp_urunler (
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,

  /* Barkod anahtar: tedarikçi kodu ve adı değişebiliyor ama barkod
     ürünün kendisine ait. Programda da çapa olarak o kullanılıyor. */
  barkod      text not null,

  /* Kaan'ın verdiği temiz ad. Boş olabilir: kullanıcı yalnızca
     KDV'yi düzeltmiş olabilir. */
  ad          text not null default '',

  /* Ürünün GERÇEK KDV'si — faturanınki değil. Yalnızca 10 ya da 20;
     başka oran gelirse yazılmıyor, program soruyor. */
  kdv         smallint check (kdv in (10, 20)),

  /* Kaç kez görüldü: güvenilirlik göstergesi. Bir kez düzeltilmiş
     ad ile otuz kez doğrulanmış ad aynı şey değil. */
  gorulme     integer not null default 1,

  guncelleyen_id uuid references panel.kullanicilar(id) on delete set null,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),

  primary key (firma_id, barkod)
);

comment on table panel.edp_urunler is
  'EDP urun hafizasi: barkod -> ogrenilmis ad ve urun KDVsi.';
comment on column panel.edp_urunler.kdv is
  'Urunun gercek KDVsi (10 ya da 20). Fatura KDVsi DEGIL.';

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

-- b) Hafızada ne var — Excel indirdikçe dolmaya başlar
select f.kisa_ad,
       count(*) as urun,
       count(*) filter (where u.ad <> '') as adi_ogrenilmis,
       count(*) filter (where u.kdv = 10) as tekstil_yuzde10
  from panel.edp_urunler u
  join panel.firmalar f on f.id = u.firma_id
 group by f.kisa_ad;

-- c) En çok görülen ürünler
select barkod, ad, kdv, gorulme, guncellendi::date as son
  from panel.edp_urunler
 order by gorulme desc, guncellendi desc
 limit 20;
