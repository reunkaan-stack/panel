-- ============================================================
-- 10_  ÖDEME TAKİP (OTP) — TABLOLAR
--
-- Yerelde çalışan Python programının veri modeli, olduğu gibi
-- taşınıyor. Alan adları ve değerleri BİREBİR aynı: yon, tur, durum,
-- seriNo… Tasarım da mekanik de değişmiyor, yalnızca veri JSON
-- dosyasından tabloya geçiyor (Vercel'de kalıcı disk yok).
--
-- Taşınacak: 214 ödeme, 62 kredi, 1270 taksit.
--
-- İKİ KARAR:
--
-- 1. Ödeme kimliği METİN ve eskisi korunuyor. Program 12 haneli
--    onaltılık kimlik üretiyor (uuid4().hex[:12]) ve arayüz bunları
--    /api/payments/<id> diye çağırıyor. uuid'ye çevirseydik hem
--    arayüzü değiştirmek hem eski kayıtların izini kaybetmek
--    gerekirdi. 214 kimliğin hepsi zaten benzersiz.
--
-- 2. Şirket ayrımı panelin firmalar tablosuna bağlanıyor. Programda
--    şirketler koda gömülüydü (SIRKETLER sözlüğü) ve kullanıcının
--    hangi şirketi göreceği de koddaydı — o yüzden wellmop kullanıcısı
--    Squala verisini de görebiliyordu. Artık yetki panelden geliyor,
--    RLS zorluyor.
-- ============================================================


-- ---------- A. Wellmop firması ----------
-- Squala zaten var. İkinci şirket panele tanıtılıyor.

insert into panel.firmalar (ad, kisa_ad)
select 'Wellmop Tekstil', 'wellmop'
 where not exists (
   select 1 from panel.firmalar where kisa_ad = 'wellmop'
 );

/* Her iki firmaya da otp modülü açılıyor. Modül kapalıysa yetki de
   geçmez — iki katman birden. */
insert into panel.firma_modulleri (firma_id, modul, aktif)
select f.id, 'otp', true
  from panel.firmalar f
 where f.kisa_ad in ('squala', 'wellmop')
on conflict (firma_id, modul) do update set aktif = true;


-- ---------- B. Ödemeler ----------

create table if not exists panel.otp_odemeler (
  -- Programdaki 12 haneli kimlik. Arayüz bu değerle çağırıyor.
  id          text primary key,
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,

  -- VERILEN = bizim ödememiz · ALINAN = bize gelen çek/senet
  yon         text not null check (yon in ('VERILEN','ALINAN')),
  tur         text not null,
  durum       text not null check (durum in (
                'BEKLIYOR','ODENDI','PORTFOYDE','TAHSILDE',
                'TEMINATTA','CIROLANDI','TAHSIL','KARSILIKSIZ','IPTAL')),

  tarih       date not null,
  firma       text not null default '',
  borclu      text not null default '',
  banka       text not null default '',
  hedef       text not null default '',
  tutar       numeric(14,2) not null default 0,
  seri_no     text not null default '',
  not_metni   text not null default '',

  -- Programdaki `odendi` / `odenen` alanları
  odendi      boolean not null default false,
  odenen      numeric(14,2) not null default 0,

  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  silindi     timestamptz
);

comment on table panel.otp_odemeler is
  'Cek/senet/odeme kayitlari. Alanlar yerel programla birebir ayni.';
comment on column panel.otp_odemeler.id is
  'Programin urettigi 12 haneli onaltilik kimlik; arayuz bu degerle cagiriyor.';

/* Vade listesi en sık okunan görünüm: firma + tarih. */
create index if not exists otp_odemeler_vade
  on panel.otp_odemeler (firma_id, tarih)
  where silindi is null;

create index if not exists otp_odemeler_durum
  on panel.otp_odemeler (firma_id, durum, tarih)
  where silindi is null;

drop trigger if exists t_otp_odemeler_guncellendi on panel.otp_odemeler;
create trigger t_otp_odemeler_guncellendi before update on panel.otp_odemeler
  for each row execute function panel.guncellendi_yaz();


-- ---------- C. Krediler ----------

create table if not exists panel.otp_krediler (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,

  -- Bankanın kredi kodu: K9001404
  kod         text not null,
  ad          text not null default '',
  banka       text not null default '',

  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  silindi     timestamptz
);

create unique index if not exists otp_krediler_kod
  on panel.otp_krediler (firma_id, kod)
  where silindi is null;

drop trigger if exists t_otp_krediler_guncellendi on panel.otp_krediler;
create trigger t_otp_krediler_guncellendi before update on panel.otp_krediler
  for each row execute function panel.guncellendi_yaz();


-- ---------- D. Taksitler ----------
-- Programda kredinin içinde dizi olarak duruyordu. Ayrı tabloya
-- alınıyor: "önümüzdeki 30 günde ne ödeyeceğim" sorusu ancak böyle
-- sorulabiliyor. Alanlar aynen korundu.

create table if not exists panel.otp_taksitler (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,
  kredi_id    uuid not null references panel.otp_krediler(id) on delete cascade,

  no          integer not null,
  vade        date not null,
  tutar       numeric(14,2) not null default 0,
  odenen      numeric(14,2) not null default 0,
  kalan       numeric(14,2) not null default 0,
  anapara     numeric(14,2) not null default 0,
  faiz        numeric(14,2) not null default 0,
  bsmv        numeric(14,2) not null default 0,

  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);

create unique index if not exists otp_taksitler_sira
  on panel.otp_taksitler (kredi_id, no);

create index if not exists otp_taksitler_vade
  on panel.otp_taksitler (firma_id, vade);

drop trigger if exists t_otp_taksitler_guncellendi on panel.otp_taksitler;
create trigger t_otp_taksitler_guncellendi before update on panel.otp_taksitler
  for each row execute function panel.guncellendi_yaz();


-- ---------- E. İşlem günlüğü ----------
-- Programda islem_gunlugu.json vardı; kim ne değiştirdi kaydı.

create table if not exists panel.otp_gunluk (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  kullanici_id uuid references panel.kullanicilar(id) on delete set null,
  eylem        text not null,
  hedef_id     text,
  ayrinti      jsonb,
  olusturuldu  timestamptz not null default now()
);

create index if not exists otp_gunluk_zaman
  on panel.otp_gunluk (firma_id, olusturuldu desc);


-- ---------- F. RLS ----------
-- Ödeme bilgisi ticari sır. Firma ayrımı RLS'te zorlanıyor: artık
-- wellmop yetkisi olan biri Squala verisini göremez, uygulama hata
-- yapsa bile.

alter table panel.otp_odemeler  enable row level security;
alter table panel.otp_krediler  enable row level security;
alter table panel.otp_taksitler enable row level security;
alter table panel.otp_gunluk    enable row level security;

do $kur$
declare t text;
begin
  foreach t in array array['otp_odemeler','otp_krediler','otp_taksitler','otp_gunluk']
  loop
    execute format('drop policy if exists %1$s_okuma on panel.%1$s', t);
    execute format($p$
      create policy %1$s_okuma on panel.%1$s for select
        using (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('otp') is not null)
        )
    $p$, t);

    execute format('drop policy if exists %1$s_yazma on panel.%1$s', t);
    execute format($p$
      create policy %1$s_yazma on panel.%1$s for insert
        with check (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma()
              and panel.modul_seviyesi('otp') in ('yazma','yonetim'))
        )
    $p$, t);

    execute format('drop policy if exists %1$s_duzeltme on panel.%1$s', t);
    execute format($p$
      create policy %1$s_duzeltme on panel.%1$s for update
        using (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma()
              and panel.modul_seviyesi('otp') in ('yazma','yonetim'))
        )
        with check (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma()
              and panel.modul_seviyesi('otp') in ('yazma','yonetim'))
        )
    $p$, t);

    execute format('drop policy if exists %1$s_silme on panel.%1$s', t);
    execute format($p$
      create policy %1$s_silme on panel.%1$s for delete
        using (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma()
              and panel.modul_seviyesi('otp') = 'yonetim')
        )
    $p$, t);
  end loop;
end
$kur$;

grant select, insert, update, delete on
  panel.otp_odemeler, panel.otp_krediler,
  panel.otp_taksitler, panel.otp_gunluk
  to authenticated, service_role;

revoke all on
  panel.otp_odemeler, panel.otp_krediler,
  panel.otp_taksitler, panel.otp_gunluk
  from anon;


-- ---------- Doğrulama ----------
-- Taşımadan ÖNCE boş, sonra 214 / 62 / 1270 beklenir.

select f.kisa_ad,
       (select count(*) from panel.otp_odemeler o where o.firma_id = f.id) as odeme,
       (select count(*) from panel.otp_krediler k where k.firma_id = f.id) as kredi,
       (select count(*) from panel.otp_taksitler t where t.firma_id = f.id) as taksit
  from panel.firmalar f
 where f.kisa_ad in ('squala','wellmop')
 order by f.kisa_ad;
