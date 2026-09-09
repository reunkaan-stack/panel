-- ============================================================
-- 17_  DIA KOLON EŞLEMELERİ
--
-- Yüklenen raporun başlıkları tanınıyorsa doğrudan aktarılıyor;
-- tanınmıyorsa kullanıcıya "şu alan hangi kolonda" diye soruluyor ve
-- verdiği cevap BURAYA yazılıyor. Aynı biçim bir daha geldiğinde
-- sorulmuyor.
--
-- Neden gerekli: DIA'da rapor kolonları özelleştirilebiliyor. Yerel
-- program kolonları sabit harflerle okuyordu (B, E, F…); bir kolon
-- eklenip çıktığında bütün alanlar kayar ve YANLIŞ VERİ SESSİZCE
-- girerdi. Artık başlık adına bakılıyor, bulunamazsa iş duruyor.
--
-- Parmak izi başlık satırının kendisi: kolon adları ve sırası. Aynı
-- raporu veren her dosya aynı izi taşır.
-- ============================================================

create table if not exists panel.otp_dia_eslemeleri (
  id          uuid primary key default gen_random_uuid(),
  firma_id    uuid not null references panel.firmalar(id) on delete cascade,

  -- Başlık satırından üretilen iz
  parmak_izi  text not null,
  tur         text not null check (tur in ('cek','kredi')),
  -- Alan kodu → kolon sırası: {"tur": 1, "vade": 5, …}
  esleme      jsonb not null,

  -- Kim onayladı; yanlış eşleme sonradan aranırsa
  olusturan_id uuid references panel.kullanicilar(id) on delete set null,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now()
);

create unique index if not exists otp_dia_eslemeleri_iz
  on panel.otp_dia_eslemeleri (firma_id, parmak_izi);

comment on table panel.otp_dia_eslemeleri is
  'Ogrenilmis DIA kolon eslemeleri. Ayni bicimde rapor tekrar geldiginde kullaniciya sorulmaz.';

drop trigger if exists t_otp_dia_eslemeleri_guncellendi on panel.otp_dia_eslemeleri;
create trigger t_otp_dia_eslemeleri_guncellendi before update on panel.otp_dia_eslemeleri
  for each row execute function panel.guncellendi_yaz();


-- ---------- RLS ----------
-- İçe aktarma yalnızca yöneticide: tek dosya yüzlerce kaydı
-- değiştirebiliyor, personelin eline verilecek bir düğme değil.

alter table panel.otp_dia_eslemeleri enable row level security;

drop policy if exists otp_dia_eslemeleri_yonetim on panel.otp_dia_eslemeleri;
create policy otp_dia_eslemeleri_yonetim on panel.otp_dia_eslemeleri for all
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('otp') = 'yonetim')
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('otp') = 'yonetim')
  );

grant select, insert, update, delete on panel.otp_dia_eslemeleri
  to authenticated, service_role;
revoke all on panel.otp_dia_eslemeleri from anon;


-- ---------- Doğrulama ----------

select f.kisa_ad, e.tur, e.parmak_izi
  from panel.otp_dia_eslemeleri e
  join panel.firmalar f on f.id = e.firma_id;
