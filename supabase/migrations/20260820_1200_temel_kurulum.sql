-- ============================================================
-- TEMEL KURULUM — firma, kullanıcı, yetki, denetim
--
-- ⚠️ Bu şema, kurumsal sitenin Supabase projesinde çalışır.
-- Site tabloları (public.talepler, public.sohbet_kayitlari) `public`
-- şemasında; panel tabloları `panel` şemasında durur.
--
-- Ayrımın sebebi düzen değil güvenlik: sitenin anon anahtarı herkese
-- açık bir web sayfasının içinde. `anon` rolüne `panel` şeması
-- kapatıldığı için o anahtar panel verisine ULAŞAMAZ. RLS'e ek,
-- ondan bağımsız ikinci kilit.
--
-- Giriş işlemi Auth API'sine gider, şemaya dokunmaz — bu yüzden
-- `anon` rolünün `panel` şemasına hiç ihtiyacı yoktur.
--
-- Kurallar: standartlar/01-VERITABANI.md
-- ============================================================

create schema if not exists panel;

-- Erişim: anon KAPALI, oturum açmış kullanıcı ve sunucu açık.
revoke all on schema panel from anon;
grant usage on schema panel to authenticated, service_role;


-- ---------- Ortak tetikleyici ----------

create or replace function panel.guncellendi_yaz() returns trigger
language plpgsql as $$
begin
  new.guncellendi = now();
  return new;
end $$;


-- ---------- Firmalar ----------
-- Platformun müşterileri. Süperadmin bu tabloyu yönetir.

create table panel.firmalar (
  id           uuid primary key default gen_random_uuid(),
  ad           text not null,
  kisa_ad      text not null unique,
  aktif        boolean not null default true,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz
);

create trigger t_firmalar_guncellendi before update on panel.firmalar
  for each row execute function panel.guncellendi_yaz();


-- ---------- Kullanıcılar ----------
-- auth.users kimliği doğrular; rol, firma ve yetki BURADA durur.

create table panel.kullanicilar (
  id           uuid primary key default gen_random_uuid(),
  auth_id      uuid not null unique references auth.users(id) on delete cascade,
  -- superadmin bir firmaya ait değildir; firmaların üstündedir
  firma_id     uuid references panel.firmalar(id) on delete cascade,
  ad           text not null,
  eposta       text not null,
  rol          text not null default 'kullanici'
               check (rol in ('superadmin','firma_yoneticisi','kullanici')),
  aktif        boolean not null default true,
  son_giris    timestamptz,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz,

  constraint kullanici_firma_tutarli check (
    (rol = 'superadmin' and firma_id is null) or
    (rol <> 'superadmin' and firma_id is not null)
  )
);

create index kullanicilar_firma on panel.kullanicilar (firma_id);
create trigger t_kullanicilar_guncellendi before update on panel.kullanicilar
  for each row execute function panel.guncellendi_yaz();


-- ---------- Firma modülleri ----------
-- Firma hangi modülleri satın aldı. Kullanıcı yetkisi ancak bundan
-- sonra anlam kazanır.

create table panel.firma_modulleri (
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  modul        text not null check (modul in ('ptp','otp','ttp','mtp')),
  aktif        boolean not null default true,
  baslangic    date not null default current_date,
  bitis        date,
  olusturuldu  timestamptz not null default now(),
  primary key (firma_id, modul)
);


-- ---------- Modül yetkileri ----------

create table panel.modul_yetkileri (
  kullanici_id uuid not null references panel.kullanicilar(id) on delete cascade,
  modul        text not null check (modul in ('ptp','otp','ttp','mtp')),
  seviye       text not null check (seviye in ('okuma','yazma','yonetim')),
  olusturuldu  timestamptz not null default now(),
  primary key (kullanici_id, modul)
);


-- ---------- Denetim kayıtları ----------
-- Güncellenmez ve silinmez: update/delete politikası TANIMLANMAZ.

create table panel.denetim_kayitlari (
  id            uuid primary key default gen_random_uuid(),
  kullanici_id  uuid references panel.kullanicilar(id),
  firma_id      uuid references panel.firmalar(id),
  eylem         text not null,
  hedef_tablo   text,
  hedef_id      uuid,
  ayrinti       jsonb,
  ip            inet,
  olusturuldu   timestamptz not null default now()
);

create index denetim_firma_tarih on panel.denetim_kayitlari (firma_id, olusturuldu desc);
create index denetim_kullanici on panel.denetim_kayitlari (kullanici_id);


-- ============================================================
-- YARDIMCI FONKSİYONLAR
--
-- `security definer` ile `set search_path` BİRLİKTE yazılır.
-- search_path verilmezse bu fonksiyonlar yetki yükseltme aracına döner.
-- ============================================================

create or replace function panel.aktif_firma() returns uuid
language sql stable security definer set search_path = panel, public as $$
  select firma_id from panel.kullanicilar
   where auth_id = auth.uid() and aktif and silindi is null
$$;

create or replace function panel.superadmin_mi() returns boolean
language sql stable security definer set search_path = panel, public as $$
  select coalesce(
    (select rol = 'superadmin' from panel.kullanicilar
      where auth_id = auth.uid() and aktif and silindi is null),
    false)
$$;

create or replace function panel.firma_yoneticisi_mi() returns boolean
language sql stable security definer set search_path = panel, public as $$
  select coalesce(
    (select rol in ('firma_yoneticisi','superadmin') from panel.kullanicilar
      where auth_id = auth.uid() and aktif and silindi is null),
    false)
$$;


-- ============================================================
-- RLS
-- ============================================================

alter table panel.firmalar          enable row level security;
alter table panel.kullanicilar      enable row level security;
alter table panel.firma_modulleri   enable row level security;
alter table panel.modul_yetkileri   enable row level security;
alter table panel.denetim_kayitlari enable row level security;

-- ---------- firmalar ----------

create policy firmalar_okuma on panel.firmalar for select
  using (id = panel.aktif_firma() or panel.superadmin_mi());

create policy firmalar_ekleme on panel.firmalar for insert
  with check (panel.superadmin_mi());

create policy firmalar_guncelleme on panel.firmalar for update
  using (panel.superadmin_mi()) with check (panel.superadmin_mi());

-- delete politikası yok: firma silinmez, `silindi` ile işaretlenir

-- ---------- kullanicilar ----------

create policy kullanicilar_okuma on panel.kullanicilar for select
  using (
    auth_id = auth.uid()
    or (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
    or panel.superadmin_mi()
  );

create policy kullanicilar_ekleme on panel.kullanicilar for insert
  with check (
    (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
    or panel.superadmin_mi()
  );

-- `with check` şart: yoksa yönetici kendi kaydının firma_id'sini
-- başka firmaya çevirebilir.
create policy kullanicilar_guncelleme on panel.kullanicilar for update
  using (
    auth_id = auth.uid()
    or (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
    or panel.superadmin_mi()
  )
  with check (
    auth_id = auth.uid()
    or (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
    or panel.superadmin_mi()
  );

-- ---------- firma_modulleri ----------
-- Firma ne aldığını görür ama değiştiremez; satış kararı platformundur.

create policy firma_modulleri_okuma on panel.firma_modulleri for select
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy firma_modulleri_yazma on panel.firma_modulleri for all
  using (panel.superadmin_mi()) with check (panel.superadmin_mi());

-- ---------- modul_yetkileri ----------

create policy modul_yetkileri_okuma on panel.modul_yetkileri for select
  using (
    exists (
      select 1 from panel.kullanicilar k
       where k.id = modul_yetkileri.kullanici_id
         and (k.auth_id = auth.uid()
              or (k.firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
              or panel.superadmin_mi())
    )
  );

create policy modul_yetkileri_yazma on panel.modul_yetkileri for all
  using (
    exists (
      select 1 from panel.kullanicilar k
       where k.id = modul_yetkileri.kullanici_id
         and ((k.firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
              or panel.superadmin_mi())
    )
  )
  with check (
    exists (
      select 1 from panel.kullanicilar k
       where k.id = modul_yetkileri.kullanici_id
         and ((k.firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
              or panel.superadmin_mi())
    )
  );

-- ---------- denetim_kayitlari ----------
-- Okuma var, yazma yalnızca sunucu tarafından (service_role).
-- update/delete politikası BİLEREK tanımlanmadı.

create policy denetim_okuma on panel.denetim_kayitlari for select
  using (
    (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
    or panel.superadmin_mi()
  );


-- ============================================================
-- TABLO İZİNLERİ
--
-- PostgREST'in tabloları görebilmesi için rol izni gerekir; asıl
-- kapı RLS'tir. `anon` hiçbir izin ALMAZ.
-- ============================================================

grant select, insert, update, delete on all tables in schema panel
  to authenticated, service_role;
grant usage, select on all sequences in schema panel
  to authenticated, service_role;

-- Sonradan eklenen tablolar için de aynısı geçerli olsun
alter default privileges in schema panel
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema panel
  grant usage, select on sequences to authenticated, service_role;
