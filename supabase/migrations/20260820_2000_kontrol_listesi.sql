-- ============================================================
-- KONTROL LİSTESİ, TEK SEFERLİK GÖREV VE FOTOĞRAF
--
-- İki aylık gerçek kullanımdan gelen eksikler:
--   1. Bir görevin içinde madde madde işaretleme (checklist)
--   2. Şablona bağlı olmayan, yalnızca o güne ait görev
--   3. Fotoğraf yükleme için depolama kovası
--
-- Haftada bir / haftada iki tekrar zaten çalışıyordu:
-- tekrar_gunleri = {2} salı, {2,5} salı ve cuma.
-- ============================================================


-- ---------- 1. Yeni görev türü: kontrol listesi ----------
-- Fotoğraf AYRI bir tür değil, her türle birlikte istenebilen bir
-- bayrak (fotograf_ister). "Onay + fotoğraf" geçerli bir görevdir.

alter table panel.ptp_sablonlar drop constraint if exists ptp_sablonlar_tur_check;
alter table panel.ptp_sablonlar
  add constraint ptp_sablonlar_tur_check
  check (tur in ('onay','kontrol','bolge','metin','sayi'));

alter table panel.ptp_gorevler drop constraint if exists ptp_gorevler_tur_check;
alter table panel.ptp_gorevler
  add constraint ptp_gorevler_tur_check
  check (tur in ('onay','kontrol','bolge','metin','sayi'));


-- ---------- 2. Tek seferlik tekrar ----------
-- Şablondan üretilmeyen, elle eklenen günlük görevler için.

alter table panel.ptp_sablonlar drop constraint if exists sablon_tekrar_tutarli;
alter table panel.ptp_sablonlar drop constraint if exists ptp_sablonlar_tekrar_check;

alter table panel.ptp_sablonlar
  add constraint ptp_sablonlar_tekrar_check
  check (tekrar in ('gunluk','haftalik','tek_seferlik'));

alter table panel.ptp_sablonlar
  add constraint sablon_tekrar_tutarli check (
    (tekrar = 'haftalik' and cardinality(tekrar_gunleri) > 0) or
    (tekrar <> 'haftalik' and cardinality(tekrar_gunleri) = 0)
  );

-- Tek seferlik şablon hangi güne ait
alter table panel.ptp_sablonlar
  add column if not exists tek_tarih date;

comment on column panel.ptp_sablonlar.tek_tarih is
  'tekrar = tek_seferlik ise görevin üretileceği gün.';


-- ---------- 3. Kontrol listesi maddeleri — şablon tarafı ----------

create table if not exists panel.ptp_sablon_maddeleri (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  sablon_id    uuid not null references panel.ptp_sablonlar(id) on delete cascade,
  metin        text not null,
  sira         integer not null default 0,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz
);

create index if not exists ptp_sablon_maddeleri_sablon
  on panel.ptp_sablon_maddeleri (sablon_id, sira);

create trigger t_ptp_sablon_maddeleri_guncellendi
  before update on panel.ptp_sablon_maddeleri
  for each row execute function panel.guncellendi_yaz();


-- ---------- 4. Kontrol listesi maddeleri — görev tarafı ----------
-- Görev üretilirken şablon maddeleri buraya KOPYALANIR. Sebep: şablon
-- sonradan değişse bile o günkü liste olduğu gibi kalmalı. Geçmişe
-- bakan müdür, o gün gerçekte ne işaretlendiğini görür.

create table if not exists panel.ptp_gorev_maddeleri (
  id                uuid primary key default gen_random_uuid(),
  firma_id          uuid not null references panel.firmalar(id) on delete cascade,
  gorev_id          uuid not null references panel.ptp_gorevler(id) on delete cascade,
  metin             text not null,
  sira              integer not null default 0,
  isaretli          boolean not null default false,
  isaretleyen_id    uuid references panel.kullanicilar(id) on delete set null,
  isaretlenme_zamani timestamptz,
  olusturuldu       timestamptz not null default now(),
  guncellendi       timestamptz not null default now(),

  constraint madde_isaret_tutarli check (
    (isaretli = false) or (isaretleyen_id is not null and isaretlenme_zamani is not null)
  )
);

create index if not exists ptp_gorev_maddeleri_gorev
  on panel.ptp_gorev_maddeleri (gorev_id, sira);

create trigger t_ptp_gorev_maddeleri_guncellendi
  before update on panel.ptp_gorev_maddeleri
  for each row execute function panel.guncellendi_yaz();


-- ---------- 5. RLS ----------

alter table panel.ptp_sablon_maddeleri enable row level security;
alter table panel.ptp_gorev_maddeleri  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['ptp_sablon_maddeleri','ptp_gorev_maddeleri'] loop
    execute format($f$
      create policy %1$s_okuma on panel.%1$s for select
        using (firma_id = panel.aktif_firma() or panel.superadmin_mi());
      create policy %1$s_ekleme on panel.%1$s for insert
        with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());
      create policy %1$s_guncelleme on panel.%1$s for update
        using (firma_id = panel.aktif_firma() or panel.superadmin_mi())
        with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());
      create policy %1$s_silme on panel.%1$s for delete
        using (firma_id = panel.aktif_firma() or panel.superadmin_mi());
    $f$, t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema panel
  to authenticated, service_role;
revoke all on all tables in schema panel from anon;


-- ---------- 6. Fotoğraf kovası ----------
-- Dosyalar sunucu diskine DEĞİL nesne depolamaya gider; sunucusuz
-- ortamda disk kalıcı değildir. Kova gizli: erişim imzalı adresle.

insert into storage.buckets (id, name, public)
values ('ptp-fotograf', 'ptp-fotograf', false)
on conflict (id) do nothing;

/* Dosya yolu deseni: <firma_id>/<gorev_id>/<dosya>
   Politikalar yolun ilk parçasına bakarak firma ayrımını yapıyor —
   böylece bir firmanın kullanıcısı diğerinin fotoğrafını göremiyor. */

drop policy if exists ptp_fotograf_okuma on storage.objects;
create policy ptp_fotograf_okuma on storage.objects for select
  to authenticated
  using (
    bucket_id = 'ptp-fotograf'
    and (
      (storage.foldername(name))[1] = panel.aktif_firma()::text
      or panel.superadmin_mi()
    )
  );

drop policy if exists ptp_fotograf_yazma on storage.objects;
create policy ptp_fotograf_yazma on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'ptp-fotograf'
    and (
      (storage.foldername(name))[1] = panel.aktif_firma()::text
      or panel.superadmin_mi()
    )
  );


-- ---------- Doğrulama ----------

select 'sablon_maddeleri' as tablo, count(*) from panel.ptp_sablon_maddeleri
union all select 'gorev_maddeleri', count(*) from panel.ptp_gorev_maddeleri
union all select 'kova', count(*) from storage.buckets where id = 'ptp-fotograf';
