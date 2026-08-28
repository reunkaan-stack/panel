-- ============================================================
-- 12_  TEKLİF ŞABLONU
--
-- Karas Teknoloji'nin kendi satış aracı: müşteri adayına fiyat
-- teklifi hazırlanır, yazdırılır, PDF olarak gönderilir.
--
-- Firma bazlı DEĞİL. Diğer tablolar bir müşterinin verisini tutuyor;
-- bu tablo Karas'ın kendi işini tutuyor. firma_id koymak, teklifi
-- "hangi müşterinin panelinde görünecek" sorusuna bağlardı — oysa
-- teklif henüz müşteri olmayan birine gidiyor.
--
-- Erişim yalnızca süperadminde.
-- ============================================================


-- ---------- A. Teklif ----------

create table if not exists panel.teklifler (
  id            uuid primary key default gen_random_uuid(),

  -- Görünen numara: 2026-001. Yıl başında sıfırlanır.
  no            text not null,

  -- Alıcı
  musteri_ad    text not null default '',
  musteri_firma text not null default '',
  musteri_eposta text not null default '',
  musteri_telefon text not null default '',

  baslik        text not null default '',
  -- Teklifin üstündeki giriş paragrafı
  giris         text not null default '',
  -- Altındaki şartlar: teslim süresi, ödeme, kapsam dışı
  kosullar      text not null default '',

  tarih         date not null default current_date,
  gecerlilik    date,

  -- Satır toplamları üzerinden düşülen indirim (tutar olarak)
  indirim       numeric(14,2) not null default 0 check (indirim >= 0),
  kdv_orani     numeric(5,2) not null default 20
                check (kdv_orani >= 0 and kdv_orani < 100),

  durum         text not null default 'taslak'
                check (durum in ('taslak','gonderildi','kabul','red')),

  olusturan_id  uuid references panel.kullanicilar(id) on delete set null,
  olusturuldu   timestamptz not null default now(),
  guncellendi   timestamptz not null default now(),
  silindi       timestamptz
);

create unique index if not exists teklifler_no
  on panel.teklifler (no) where silindi is null;

create index if not exists teklifler_tarih
  on panel.teklifler (tarih desc) where silindi is null;

drop trigger if exists t_teklifler_guncellendi on panel.teklifler;
create trigger t_teklifler_guncellendi before update on panel.teklifler
  for each row execute function panel.guncellendi_yaz();


-- ---------- B. Kalemler ----------

create table if not exists panel.teklif_kalemleri (
  id          uuid primary key default gen_random_uuid(),
  teklif_id   uuid not null references panel.teklifler(id) on delete cascade,

  sira        integer not null default 0,
  baslik      text not null default '',
  -- Kalemin altındaki açıklama satırı; ne kapsadığını anlatır
  aciklama    text not null default '',
  miktar      numeric(12,2) not null default 1 check (miktar >= 0),
  birim       text not null default 'adet',
  birim_fiyat numeric(14,2) not null default 0 check (birim_fiyat >= 0),

  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);

/* Satır toplamı üretilmiş kolon: hesap tek yerde dursun. Ekranda ve
   yazdırmada ayrı ayrı çarpılsaydı biri diğerinden sapabilirdi. */
alter table panel.teklif_kalemleri drop column if exists toplam;
alter table panel.teklif_kalemleri
  add column toplam numeric(14,2)
    generated always as (round(miktar * birim_fiyat, 2)) stored;

create index if not exists teklif_kalemleri_sira
  on panel.teklif_kalemleri (teklif_id, sira);

drop trigger if exists t_teklif_kalemleri_guncellendi on panel.teklif_kalemleri;
create trigger t_teklif_kalemleri_guncellendi before update on panel.teklif_kalemleri
  for each row execute function panel.guncellendi_yaz();


-- ---------- C. Sıradaki teklif numarası ----------

create or replace function panel.teklif_yeni_no() returns text
language sql stable security definer set search_path = panel, public as $$
  select to_char(current_date, 'YYYY') || '-' ||
         lpad((
           coalesce(max(split_part(no, '-', 2)::int), 0) + 1
         )::text, 3, '0')
    from panel.teklifler
   where no like to_char(current_date, 'YYYY') || '-%'
     and split_part(no, '-', 2) ~ '^[0-9]+$'
$$;

comment on function panel.teklif_yeni_no is
  'Bu yilin siradaki teklif numarasi: 2026-001, 2026-002 …';


-- ---------- D. RLS ----------

alter table panel.teklifler        enable row level security;
alter table panel.teklif_kalemleri enable row level security;

drop policy if exists teklifler_superadmin on panel.teklifler;
create policy teklifler_superadmin on panel.teklifler for all
  using (panel.superadmin_mi()) with check (panel.superadmin_mi());

drop policy if exists teklif_kalemleri_superadmin on panel.teklif_kalemleri;
create policy teklif_kalemleri_superadmin on panel.teklif_kalemleri for all
  using (panel.superadmin_mi()) with check (panel.superadmin_mi());

grant select, insert, update, delete
  on panel.teklifler, panel.teklif_kalemleri
  to authenticated, service_role;

revoke all on panel.teklifler, panel.teklif_kalemleri from anon;


-- ---------- Doğrulama ----------

select panel.teklif_yeni_no() as siradaki_no,
       (select count(*) from panel.teklifler where silindi is null) as teklif;
