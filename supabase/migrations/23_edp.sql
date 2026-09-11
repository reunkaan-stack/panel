-- ============================================================
-- 23_  EXCEL DOSYA YÜKLEME PROGRAMI (edp)
--
-- Tedarikçiden gelen sipariş PDF'i ya da fiyat listesi Excel'i
-- okunup, Dia'ya yüklenebilir Excel üretiliyor. Yereldeki tek
-- dosyalık program panele taşındı.
--
-- ⚠️ ÖTP'DEKİ "DIA RAPORU YÜKLE" İLE KARIŞTIRILMAMALI.
-- O, DIA'dan veri ÇEKER (çek/kredi listesi içe aktarma).
-- Bu, DIA'ya YÜKLENECEK dosyayı ÜRETİR. Yönleri ters.
--
-- AYARLAR NEDEN TABLOYA ALINIYOR: yereldeki program hepsini
-- tarayıcının localStorage'ında tutuyordu. Anlaşma oranları
-- (CANSU %10 gibi) ve öğrenilmiş kolon eşlemesi iş bilgisidir;
-- ikinci bir bilgisayardan girildiğinde yok olmaları ya da
-- tarayıcı temizlenince kaybolmaları kabul edilemez.
-- ============================================================


-- ---------- A. Modül kodu tanınsın ----------
-- Yetki tabloları modül kodunu sayıyor; 'edp' eklenmeden kimseye
-- yetki verilemez ve firmada modül açılamaz.

alter table panel.modul_yetkileri
  drop constraint if exists modul_yetkileri_modul_check;
alter table panel.modul_yetkileri
  add constraint modul_yetkileri_modul_check
  check (modul in ('ptp','otp','ttp','mtp','edp'));

alter table panel.firma_modulleri
  drop constraint if exists firma_modulleri_modul_check;
alter table panel.firma_modulleri
  add constraint firma_modulleri_modul_check
  check (modul in ('ptp','otp','ttp','mtp','edp'));


-- ---------- B. Ayarlar ----------
-- Firma başına TEK satır. Programdaki cfg nesnesinin karşılığı.

create table if not exists panel.edp_ayarlar (
  firma_id      uuid primary key references panel.firmalar(id) on delete cascade,

  -- Dia sabitleri: çıktı Excel'inde her satıra aynı yazılır
  birim         text not null default 'ADET',
  kdv           text not null default '20',
  sistem_kdv    text not null default '1',

  -- Fiyat zinciri yüzdeleri. Metin tutuluyor çünkü arayüz virgüllü
  -- giriş kabul ediyor ("12,5") ve sayıya çevirme programın kendi
  -- işi; burada dönüştürmek iki ayrı ayrıştırma kuralı demek olurdu.
  f1_iskonto    text not null default '0',
  f1_iskonto2   text not null default '',
  f3_karlilik   text not null default '100',
  f5_karlilik   text not null default '100',

  /* Genel Excel'lerde hangi kolon ne: {"barkod":2,"aciklama":5,…}
     Yereldeki programda tek eşleme saklanıyordu, aynen korundu.
     ÖTP'deki gibi parmak izine göre çoklu eşleme ileride
     eklenebilir — mekanik değişikliği bilerek yapılmadı. */
  kolon_eslemesi jsonb,

  guncelleyen_id uuid references panel.kullanicilar(id) on delete set null,
  olusturuldu   timestamptz not null default now(),
  guncellendi   timestamptz not null default now()
);

comment on table panel.edp_ayarlar is
  'Excel Dosya Yukleme Programi ayarlari. Firma basina tek satir.';

drop trigger if exists t_edp_ayarlar_guncellendi on panel.edp_ayarlar;
create trigger t_edp_ayarlar_guncellendi before update on panel.edp_ayarlar
  for each row execute function panel.guncellendi_yaz();


-- ---------- C. Tedarikçi anlaşma oranları ----------
-- Grup kodu yazılınca KDV oranı kendiliğinden seçilsin diye.
-- Ayrı tablo: liste büyüyor ve tek tek silinip eklenebiliyor.

create table if not exists panel.edp_tedarikciler (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,

  grup_kodu   text not null,
  -- Çarpan biçiminde: 1.10 = %10 KDV, 1.00 = fiyat zaten KDV dahil
  oran        numeric(4,2) not null check (oran >= 1 and oran <= 2),

  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);

create unique index if not exists edp_tedarikciler_kod
  on panel.edp_tedarikciler (firma_id, upper(grup_kodu));

comment on table panel.edp_tedarikciler is
  'Grup kodu -> KDV carpani. Tedarikci anlasmasi.';

drop trigger if exists t_edp_tedarikciler_guncellendi on panel.edp_tedarikciler;
create trigger t_edp_tedarikciler_guncellendi before update on panel.edp_tedarikciler
  for each row execute function panel.guncellendi_yaz();


-- ---------- D. RLS ----------
-- Okuma modüle yetkisi olan herkese; yazma yazma/yönetim
-- seviyesine. Fiyat kuralları iş sırrıdır, firma dışına çıkmaz.

alter table panel.edp_ayarlar enable row level security;
alter table panel.edp_tedarikciler enable row level security;

drop policy if exists edp_ayarlar_okuma on panel.edp_ayarlar;
create policy edp_ayarlar_okuma on panel.edp_ayarlar for select
  using (panel.superadmin_mi() or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') is not null));

drop policy if exists edp_ayarlar_yazma on panel.edp_ayarlar;
create policy edp_ayarlar_yazma on panel.edp_ayarlar for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') in ('yazma','yonetim'))
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') in ('yazma','yonetim'))
  );

drop policy if exists edp_tedarikciler_okuma on panel.edp_tedarikciler;
create policy edp_tedarikciler_okuma on panel.edp_tedarikciler for select
  using (panel.superadmin_mi() or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') is not null));

drop policy if exists edp_tedarikciler_yazma on panel.edp_tedarikciler;
create policy edp_tedarikciler_yazma on panel.edp_tedarikciler for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') in ('yazma','yonetim'))
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('edp') in ('yazma','yonetim'))
  );

grant select, insert, update, delete on panel.edp_ayarlar, panel.edp_tedarikciler
  to authenticated, service_role;
revoke all on panel.edp_ayarlar from anon;
revoke all on panel.edp_tedarikciler from anon;


-- ---------- Doğrulama ----------

-- a) Modül kodu kabul ediliyor mu
select conname, pg_get_constraintdef(oid) as kural
  from pg_constraint
 where conname in ('modul_yetkileri_modul_check','firma_modulleri_modul_check');

-- b) Tablolar ve RLS
select relname, relrowsecurity as rls_acik
  from pg_class
 where relname in ('edp_ayarlar','edp_tedarikciler');

-- c) MODÜLÜ AÇ ve YETKİ VER — kendi firmanın kimliğini yazarak çalıştır.
--    Bu satırlar bilerek yorumda: hangi firmaya açılacağı karardır.
--
-- insert into panel.firma_modulleri (firma_id, modul, aktif)
-- values ('<firma-kimligi>', 'edp', true)
-- on conflict (firma_id, modul) do update set aktif = true;
--
-- insert into panel.modul_yetkileri (kullanici_id, modul, seviye)
-- values ('<kullanici-kimligi>', 'edp', 'yonetim')
-- on conflict (kullanici_id, modul) do update set seviye = 'yonetim';

-- d) Kim hangi modüle yetkili — açtıktan sonra kontrol
select k.ad, my.modul, my.seviye
  from panel.modul_yetkileri my
  join panel.kullanicilar k on k.id = my.kullanici_id
 where my.modul = 'edp';
