-- ============================================================
-- TEMEL KURULUM — firma, kullanıcı, yetki, denetim
--
-- Modüle özel tablolar ayrı migration'larda gelir ve hepsi bu
-- dosyadaki `firmalar` tablosuna bağlanır.
--
-- Kurallar: standartlar/01-VERITABANI.md
-- ============================================================

-- ---------- Ortak tetikleyici ----------

create or replace function guncellendi_yaz() returns trigger
language plpgsql as $$
begin
  new.guncellendi = now();
  return new;
end $$;


-- ---------- Firmalar ----------
-- Platformun müşterileri. Süperadmin bu tabloyu yönetir.

create table firmalar (
  id           uuid primary key default gen_random_uuid(),
  ad           text not null,
  kisa_ad      text not null unique,          -- adreslerde ve kayıtlarda
  aktif        boolean not null default true,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz
);

create trigger t_firmalar_guncellendi before update on firmalar
  for each row execute function guncellendi_yaz();


-- ---------- Kullanıcılar ----------
-- auth.users kimliği doğrular; rol, firma ve yetki BURADA durur.
-- Kimlik sağlayıcısı değişse bile yetki modeli yerinde kalır.

create table kullanicilar (
  id           uuid primary key default gen_random_uuid(),
  auth_id      uuid not null unique references auth.users(id) on delete cascade,
  -- superadmin bir firmaya ait değildir; firmaların üstündedir
  firma_id     uuid references firmalar(id) on delete cascade,
  ad           text not null,
  eposta       text not null,
  rol          text not null default 'kullanici'
               check (rol in ('superadmin','firma_yoneticisi','kullanici')),
  aktif        boolean not null default true,
  son_giris    timestamptz,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz,

  -- Süperadminin firması olmaz, diğerlerinin olmak zorunda
  constraint kullanici_firma_tutarli check (
    (rol = 'superadmin' and firma_id is null) or
    (rol <> 'superadmin' and firma_id is not null)
  )
);

create index kullanicilar_firma on kullanicilar (firma_id);
create trigger t_kullanicilar_guncellendi before update on kullanicilar
  for each row execute function guncellendi_yaz();


-- ---------- Firma modülleri ----------
-- Firma hangi modülleri satın aldı. Kullanıcı yetkisi ancak bundan
-- sonra anlam kazanır.

create table firma_modulleri (
  firma_id     uuid not null references firmalar(id) on delete cascade,
  modul        text not null check (modul in ('ptp','otp','ttp','mtp')),
  aktif        boolean not null default true,
  baslangic    date not null default current_date,
  bitis        date,
  olusturuldu  timestamptz not null default now(),
  primary key (firma_id, modul)
);


-- ---------- Modül yetkileri ----------

create table modul_yetkileri (
  kullanici_id uuid not null references kullanicilar(id) on delete cascade,
  modul        text not null check (modul in ('ptp','otp','ttp','mtp')),
  seviye       text not null check (seviye in ('okuma','yazma','yonetim')),
  olusturuldu  timestamptz not null default now(),
  primary key (kullanici_id, modul)
);


-- ---------- Denetim kayıtları ----------
-- Güncellenmez ve silinmez: update/delete politikası TANIMLANMAZ.

create table denetim_kayitlari (
  id            uuid primary key default gen_random_uuid(),
  kullanici_id  uuid references kullanicilar(id),
  firma_id      uuid references firmalar(id),
  eylem         text not null,
  hedef_tablo   text,
  hedef_id      uuid,
  ayrinti       jsonb,
  ip            inet,
  olusturuldu   timestamptz not null default now()
);

create index denetim_firma_tarih on denetim_kayitlari (firma_id, olusturuldu desc);
create index denetim_kullanici on denetim_kayitlari (kullanici_id);


-- ============================================================
-- YARDIMCI FONKSİYONLAR
--
-- `security definer` ile `set search_path` BİRLİKTE yazılır.
-- search_path verilmezse bu fonksiyonlar yetki yükseltme aracına döner.
-- ============================================================

create or replace function aktif_firma() returns uuid
language sql stable security definer set search_path = public as $$
  select firma_id from kullanicilar
   where auth_id = auth.uid() and aktif and silindi is null
$$;

create or replace function superadmin_mi() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'superadmin' from kullanicilar
      where auth_id = auth.uid() and aktif and silindi is null),
    false)
$$;

create or replace function firma_yoneticisi_mi() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol in ('firma_yoneticisi','superadmin') from kullanicilar
      where auth_id = auth.uid() and aktif and silindi is null),
    false)
$$;


-- ============================================================
-- RLS
-- ============================================================

alter table firmalar          enable row level security;
alter table kullanicilar      enable row level security;
alter table firma_modulleri   enable row level security;
alter table modul_yetkileri   enable row level security;
alter table denetim_kayitlari enable row level security;

-- ---------- firmalar ----------
-- Kullanıcı yalnızca kendi firmasını görür; süperadmin hepsini.

create policy firmalar_okuma on firmalar for select
  using (id = aktif_firma() or superadmin_mi());

create policy firmalar_ekleme on firmalar for insert
  with check (superadmin_mi());

create policy firmalar_guncelleme on firmalar for update
  using (superadmin_mi()) with check (superadmin_mi());

-- delete politikası yok: firma silinmez, `silindi` ile işaretlenir

-- ---------- kullanicilar ----------

create policy kullanicilar_okuma on kullanicilar for select
  using (
    auth_id = auth.uid()                       -- herkes kendini görür
    or (firma_id = aktif_firma() and firma_yoneticisi_mi())
    or superadmin_mi()
  );

create policy kullanicilar_ekleme on kullanicilar for insert
  with check (
    (firma_id = aktif_firma() and firma_yoneticisi_mi())
    or superadmin_mi()
  );

-- `with check` şart: yoksa yönetici kendi kaydının firma_id'sini
-- başka firmaya çevirebilir.
create policy kullanicilar_guncelleme on kullanicilar for update
  using (
    auth_id = auth.uid()
    or (firma_id = aktif_firma() and firma_yoneticisi_mi())
    or superadmin_mi()
  )
  with check (
    auth_id = auth.uid()
    or (firma_id = aktif_firma() and firma_yoneticisi_mi())
    or superadmin_mi()
  );

-- ---------- firma_modulleri ----------
-- Firma ne aldığını görür ama değiştiremez; satış kararı platformundur.

create policy firma_modulleri_okuma on firma_modulleri for select
  using (firma_id = aktif_firma() or superadmin_mi());

create policy firma_modulleri_yazma on firma_modulleri for all
  using (superadmin_mi()) with check (superadmin_mi());

-- ---------- modul_yetkileri ----------

create policy modul_yetkileri_okuma on modul_yetkileri for select
  using (
    exists (
      select 1 from kullanicilar k
       where k.id = modul_yetkileri.kullanici_id
         and (k.auth_id = auth.uid()
              or (k.firma_id = aktif_firma() and firma_yoneticisi_mi())
              or superadmin_mi())
    )
  );

create policy modul_yetkileri_yazma on modul_yetkileri for all
  using (
    exists (
      select 1 from kullanicilar k
       where k.id = modul_yetkileri.kullanici_id
         and ((k.firma_id = aktif_firma() and firma_yoneticisi_mi())
              or superadmin_mi())
    )
  )
  with check (
    exists (
      select 1 from kullanicilar k
       where k.id = modul_yetkileri.kullanici_id
         and ((k.firma_id = aktif_firma() and firma_yoneticisi_mi())
              or superadmin_mi())
    )
  );

-- ---------- denetim_kayitlari ----------
-- Okuma var, yazma yalnızca sunucu tarafından (service_role).
-- update/delete politikası BİLEREK tanımlanmadı.

create policy denetim_okuma on denetim_kayitlari for select
  using (
    (firma_id = aktif_firma() and firma_yoneticisi_mi())
    or superadmin_mi()
  );
