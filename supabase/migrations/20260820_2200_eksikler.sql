-- ============================================================
-- EKSİK LİSTESİ
--
-- Personel eksik gördüğü şeyi yazar (bitti, kalmadı, bozuldu).
-- Yönetici listeyi görür ve giderdikçe işaretler.
--
-- Görevden AYRI bir kavram: görev "yapılması gereken iş", eksik
-- "temin edilmesi gereken şey". İkisini aynı tabloda tutmak, ikisini
-- de bulanıklaştırırdı — eksiğin atananı yok, tekrarı yok, günü yok.
-- ============================================================

create table panel.ptp_eksikler (
  id                uuid primary key default gen_random_uuid(),
  firma_id          uuid not null references panel.firmalar(id) on delete cascade,

  metin             text not null,
  aciklama          text not null default '',
  -- Aciliyet: personel işaretler, yönetici sıralamada kullanır
  acil              boolean not null default false,

  durum             text not null default 'bekliyor'
                    check (durum in ('bekliyor','giderildi','iptal')),

  bildiren_id       uuid references panel.kullanicilar(id) on delete set null,
  -- Kim kapattı ve ne zaman: yöneticinin kendini kontrol etmesi için
  kapatan_id        uuid references panel.kullanicilar(id) on delete set null,
  kapanma_zamani    timestamptz,
  kapanma_notu      text not null default '',

  olusturuldu       timestamptz not null default now(),
  guncellendi       timestamptz not null default now(),
  silindi           timestamptz,

  -- Kapatıldıysa kim ve ne zaman belli olmalı
  constraint eksik_kapanma_tutarli check (
    durum = 'bekliyor' or (kapatan_id is not null and kapanma_zamani is not null)
  ),
  constraint eksik_metin_dolu check (length(btrim(metin)) > 0)
);

/* Bekleyenler her açılışta okunuyor; acil olanlar üstte. */
create index ptp_eksikler_firma_durum
  on panel.ptp_eksikler (firma_id, durum, acil desc, olusturuldu desc);

create trigger t_ptp_eksikler_guncellendi before update on panel.ptp_eksikler
  for each row execute function panel.guncellendi_yaz();


-- ---------- RLS ----------

alter table panel.ptp_eksikler enable row level security;

create policy ptp_eksikler_okuma on panel.ptp_eksikler for select
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy ptp_eksikler_ekleme on panel.ptp_eksikler for insert
  with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy ptp_eksikler_guncelleme on panel.ptp_eksikler for update
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi())
  with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy ptp_eksikler_silme on panel.ptp_eksikler for delete
  using (panel.superadmin_mi());

grant select, insert, update, delete on all tables in schema panel
  to authenticated, service_role;
revoke all on all tables in schema panel from anon;


select 'ptp_eksikler' as tablo, count(*) from panel.ptp_eksikler;
