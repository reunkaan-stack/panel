-- ============================================================
-- 8_  PRİM SİSTEMİ
--
-- Aylık net ciro hedefe oranlanıyor, oran bir kademeye düşüyor,
-- kademe primi belirliyor.
--
-- Dört karar buraya gömülü:
--
-- 1. Hesap NET ciro üzerinden. KDV işletmenin parası değil; devlet
--    adına toplanıp devlete ödeniyor. Brüt üzerinden hesaplansaydı
--    KDV oranı değiştiğinde prim de değişirdi — personel hiçbir şey
--    yapmadan Maliye kararıyla prim kazanır ya da kaybederdi.
--
-- 2. KDV oranı her ciro satırına O ANKİ değeriyle yazılıyor. Oran
--    yarın değişirse geçmiş aylar eski oranıyla kalır; tek bir ayar
--    alanı tutulsaydı geriye dönük bütün raporlar bozulurdu.
--
-- 3. Üst iki kademe SABİT TUTAR değil MAAŞ KATI. Zam geldiğinde prim
--    kendiliğinden yükseliyor. Sabit yazılsaydı her zamda tablo elle
--    güncellenirdi ve bir gün unutulurdu.
--
-- 4. Maaş TARİHLİ tutuluyor. Aralık primi aralık maaşıyla, ocak primi
--    zamlı maaşla hesaplanır. Tek alan olsaydı ocakta yapılan zam
--    aralık raporunu da değiştirirdi.
-- ============================================================


-- ---------- A. Modül ayarları ----------

/* ptp_ayarlar ZATEN VAR (mağaza adı, Telegram saatleri). Yeni kolonlar
   eklenerek genişletiliyor.

   Not: buraya ilk yazımda `create table if not exists` konmuştu ve
   tablo zaten var olduğu için sessizce hiçbir şey yapmadı — kolonlar
   eklenmedi, betik seed adımında patladı. `if not exists` yalnızca
   tablonun ADI'na bakar, içeriğine değil. */

create table if not exists panel.ptp_ayarlar (
  firma_id    uuid primary key references panel.firmalar(id) on delete cascade,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);

alter table panel.ptp_ayarlar
  -- Yeni ciro satırlarına yazılacak oran. Geçmişi etkilemez.
  add column if not exists kdv_orani numeric(5,2) not null default 20,
  -- Ay için ayrıca hedef girilmediğinde kullanılır
  add column if not exists varsayilan_hedef numeric(14,2) not null default 0;

alter table panel.ptp_ayarlar drop constraint if exists ayar_kdv_araligi;
alter table panel.ptp_ayarlar
  add constraint ayar_kdv_araligi check (kdv_orani >= 0 and kdv_orani < 100);

alter table panel.ptp_ayarlar drop constraint if exists ayar_hedef_eksi_degil;
alter table panel.ptp_ayarlar
  add constraint ayar_hedef_eksi_degil check (varsayilan_hedef >= 0);

drop trigger if exists t_ptp_ayarlar_guncellendi on panel.ptp_ayarlar;
create trigger t_ptp_ayarlar_guncellendi before update on panel.ptp_ayarlar
  for each row execute function panel.guncellendi_yaz();


-- ---------- B. Ciroya KDV oranı ve net tutar ----------

alter table panel.ptp_cirolar
  add column if not exists kdv_orani numeric(5,2) not null default 20
    check (kdv_orani >= 0 and kdv_orani < 100);

/* Net tutar üretilmiş kolon: hesap tek yerde dursun. Uygulamada
   yapılsaydı ekran, rapor ve prim aynı bölmeyi üç ayrı yerde yapar ve
   biri eninde sonunda diğerinden saparadı. */
alter table panel.ptp_cirolar drop column if exists net_tutar;

alter table panel.ptp_cirolar
  add column net_tutar numeric(14,2)
    generated always as (round(tutar / (1 + kdv_orani / 100), 2)) stored;

comment on column panel.ptp_cirolar.net_tutar is
  'KDV haric ciro. Girilen brut tutardan ve satirin kendi KDV oranindan uretilir.';

/* Yeni satıra firmanın güncel oranı yazılıyor. Uygulamanın her ciro
   kaydında ayar tablosunu okumak zorunda kalmaması için burada. */
create or replace function panel.ptp_ciro_kdv_yaz() returns trigger
language plpgsql security definer set search_path = panel, public as $$
begin
  select a.kdv_orani into new.kdv_orani
    from panel.ptp_ayarlar a
   where a.firma_id = new.firma_id;

  if new.kdv_orani is null then
    new.kdv_orani := 20;
  end if;

  return new;
end;
$$;

drop trigger if exists t_ptp_cirolar_kdv on panel.ptp_cirolar;
create trigger t_ptp_cirolar_kdv before insert on panel.ptp_cirolar
  for each row execute function panel.ptp_ciro_kdv_yaz();


-- ---------- C. Aylık hedef ----------

create table if not exists panel.ptp_hedefler (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,
  -- Ayın ilk günü: 2026-09-01 = eylül hedefi
  ay          date not null,
  hedef       numeric(14,2) not null check (hedef >= 0),
  not_metni   text not null default '',
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  constraint hedef_ayin_ilki check (extract(day from ay) = 1)
);

create unique index if not exists ptp_hedefler_ay
  on panel.ptp_hedefler (firma_id, ay);

drop trigger if exists t_ptp_hedefler_guncellendi on panel.ptp_hedefler;
create trigger t_ptp_hedefler_guncellendi before update on panel.ptp_hedefler
  for each row execute function panel.guncellendi_yaz();


-- ---------- D. Prim kademeleri ----------

create table if not exists panel.ptp_prim_kademeleri (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,
  -- Hedefin yüzde kaçı: 40, 45, 50 …
  oran        integer not null check (oran > 0 and oran <= 1000),
  tur         text not null default 'sabit' check (tur in ('sabit','maas_kati')),
  -- tur = sabit iken ödenecek tutar
  tutar       numeric(14,2) check (tutar >= 0),
  -- tur = maas_kati iken maaşın kaç katı: 1, 1.5 …
  kat         numeric(6,2) check (kat >= 0),
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  constraint kademe_degeri_tutarli check (
    (tur = 'sabit' and tutar is not null and kat is null)
    or (tur = 'maas_kati' and kat is not null and tutar is null)
  )
);

create unique index if not exists ptp_prim_kademeleri_oran
  on panel.ptp_prim_kademeleri (firma_id, oran);

drop trigger if exists t_ptp_prim_kademeleri_guncellendi on panel.ptp_prim_kademeleri;
create trigger t_ptp_prim_kademeleri_guncellendi before update on panel.ptp_prim_kademeleri
  for each row execute function panel.guncellendi_yaz();


-- ---------- E. Maaşlar (tarihli) ----------

create table if not exists panel.ptp_maaslar (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  kullanici_id uuid not null references panel.kullanicilar(id) on delete cascade,
  -- Bu tutarın geçerli olmaya başladığı ay (ayın ilk günü)
  gecerli_ay   date not null,
  tutar        numeric(14,2) not null check (tutar >= 0),
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  constraint maas_ayin_ilki check (extract(day from gecerli_ay) = 1)
);

create unique index if not exists ptp_maaslar_kisi_ay
  on panel.ptp_maaslar (firma_id, kullanici_id, gecerli_ay);

drop trigger if exists t_ptp_maaslar_guncellendi on panel.ptp_maaslar;
create trigger t_ptp_maaslar_guncellendi before update on panel.ptp_maaslar
  for each row execute function panel.guncellendi_yaz();

comment on table panel.ptp_maaslar is
  'Tarihli maas kaydi. Zam yeni satir olarak yazilir; gecmis aylarin primi eski maasla hesaplanir.';


-- ---------- F. RLS ----------
-- Ücret verisi. Ayarlar, hedef ve kademeler yalnızca yönetimde.
-- Maaşta kişi kendi satırını görebiliyor: kendi maaşını zaten biliyor,
-- primini de görebilmeli.

alter table panel.ptp_ayarlar         enable row level security;
alter table panel.ptp_hedefler        enable row level security;
alter table panel.ptp_prim_kademeleri enable row level security;
alter table panel.ptp_maaslar         enable row level security;

/* ptp_ayarlar'ın eski kuralları firmadaki HERKESE yazma izni
   veriyordu. Tabloya varsayılan hedef girince bu bir açık oldu:
   personel kendi primini hesaplayan hedefi düşürebilirdi. Yazma
   yönetime kapatılıyor, okuma firmada kalıyor (mağaza adı, Telegram
   saati gibi zararsız alanlar da burada).

   Politikalar PERMISSIVE ve birbiriyle OR'lanır; eskileri silmeden
   yenisini eklemek hiçbir şeyi kısıtlamazdı. */

drop policy if exists ptp_ayarlar_ekleme on panel.ptp_ayarlar;
drop policy if exists ptp_ayarlar_guncelleme on panel.ptp_ayarlar;

drop policy if exists ptp_ayarlar_yazma on panel.ptp_ayarlar;
create policy ptp_ayarlar_yazma on panel.ptp_ayarlar for insert
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  );

drop policy if exists ptp_ayarlar_duzeltme on panel.ptp_ayarlar;
create policy ptp_ayarlar_duzeltme on panel.ptp_ayarlar for update
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  );

drop policy if exists ptp_hedefler_yonetim on panel.ptp_hedefler;
create policy ptp_hedefler_yonetim on panel.ptp_hedefler for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  );

drop policy if exists ptp_kademe_yonetim on panel.ptp_prim_kademeleri;
create policy ptp_kademe_yonetim on panel.ptp_prim_kademeleri for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  );

drop policy if exists ptp_maaslar_okuma on panel.ptp_maaslar;
create policy ptp_maaslar_okuma on panel.ptp_maaslar for select
  using (
    panel.superadmin_mi()
    or (
      firma_id = panel.aktif_firma()
      and (
        panel.modul_seviyesi('ptp') = 'yonetim'
        or kullanici_id = panel.aktif_kullanici_id()
      )
    )
  );

drop policy if exists ptp_maaslar_yazma on panel.ptp_maaslar;
create policy ptp_maaslar_yazma on panel.ptp_maaslar for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  );

grant select, insert, update, delete on
  panel.ptp_ayarlar, panel.ptp_hedefler,
  panel.ptp_prim_kademeleri, panel.ptp_maaslar
  to authenticated, service_role;

revoke all on
  panel.ptp_ayarlar, panel.ptp_hedefler,
  panel.ptp_prim_kademeleri, panel.ptp_maaslar
  from anon;


-- ---------- G. Squala Home kurulumu ----------

insert into panel.ptp_ayarlar (firma_id, kdv_orani, varsayilan_hedef)
select f.id, 20, 800000
  from panel.firmalar f
 where f.kisa_ad = 'squala'
on conflict (firma_id) do update
  set kdv_orani = excluded.kdv_orani,
      varsayilan_hedef = excluded.varsayilan_hedef;

/* Kademeler. Üst ikisi maaş katı: %90 bir maaş, %100 bir buçuk maaş.
   Bugünkü 30.000 TL maaşla 30.000 ve 45.000 ediyor; zam gelince
   kendiliğinden yükseliyor. */
insert into panel.ptp_prim_kademeleri (firma_id, oran, tur, tutar, kat)
select f.id, k.oran, k.tur, k.tutar, k.kat
  from panel.firmalar f
 cross join (values
    ( 40, 'sabit',      1000::numeric, null::numeric),
    ( 45, 'sabit',      1500,          null),
    ( 50, 'sabit',      3000,          null),
    ( 60, 'sabit',      8000,          null),
    ( 70, 'sabit',     16000,          null),
    ( 80, 'sabit',     20000,          null),
    ( 90, 'maas_kati',  null,          1.0),
    (100, 'maas_kati',  null,          1.5)
 ) as k(oran, tur, tutar, kat)
 where f.kisa_ad = 'squala'
on conflict (firma_id, oran) do update
  set tur = excluded.tur,
      tutar = excluded.tutar,
      kat = excluded.kat;

/* Mevcut maaş. Ocakta zam gelince YENİ satır yazılacak; bu satır
   silinmeyecek, aralık primi bununla hesaplanmaya devam edecek. */
insert into panel.ptp_maaslar (firma_id, kullanici_id, gecerli_ay, tutar)
select k.firma_id, k.id, date_trunc('month', current_date)::date, 30000
  from panel.kullanicilar k
  join panel.firmalar f on f.id = k.firma_id
 where f.kisa_ad = 'squala'
   and k.rol = 'kullanici'
   and k.aktif
   and k.silindi is null
on conflict (firma_id, kullanici_id, gecerli_ay) do nothing;


-- ---------- Doğrulama ----------

select 'ayar' as ne, kdv_orani::text as a, varsayilan_hedef::text as b
  from panel.ptp_ayarlar
union all
select 'kademe', oran::text, coalesce(tutar::text, kat::text || ' maas')
  from panel.ptp_prim_kademeleri
union all
select 'maas', gecerli_ay::text, tutar::text
  from panel.ptp_maaslar
 order by 1, 2;
