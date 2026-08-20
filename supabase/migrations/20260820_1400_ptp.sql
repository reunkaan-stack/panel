-- ============================================================
-- PTP — Personel Takip modülü
--
-- Kaynak: Desktop/Karas Takip Programı/ptp/magaza crm/ (Electron)
-- Orada veri tek bir db.json dosyasındaydı. Yapı olduğu gibi
-- taşınmadı; sorgulanabilir ve raporlanabilir hale getirildi.
--
-- Kurallar: standartlar/01-VERITABANI.md
-- ============================================================


-- ---------- Modül ayarları ----------
-- Her firmanın kendi ayarı. Telegram BOT anahtarı burada DEĞİL,
-- ortam değişkeninde: bot platform düzeyinde tek, chat_id firma bazlı.

create table panel.ptp_ayarlar (
  firma_id                  uuid primary key references panel.firmalar(id) on delete cascade,
  magaza_adi                text not null default '',
  coklu_personel            boolean not null default false,
  telegram_aktif            boolean not null default false,
  telegram_chat_id          text,
  gunluk_ozet_saati         time not null default '22:00',
  kapanis_hatirlatma_saati  time not null default '21:30',
  olusturuldu               timestamptz not null default now(),
  guncellendi               timestamptz not null default now()
);

create trigger t_ptp_ayarlar_guncellendi before update on panel.ptp_ayarlar
  for each row execute function panel.guncellendi_yaz();


-- ---------- Bölümler ----------
-- Eskiden düz metin dizisiydi ("Mutfak", "Kasa"...). Tabloya çevrildi:
-- bölüm adı değişince geçmiş kayıtlar bozulmasın ve bölüm bazlı rapor
-- alınabilsin diye.

create table panel.ptp_bolumler (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  ad           text not null,
  sira         integer not null default 0,
  aktif        boolean not null default true,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz,
  unique (firma_id, ad)
);

create index ptp_bolumler_firma on panel.ptp_bolumler (firma_id, sira);
create trigger t_ptp_bolumler_guncellendi before update on panel.ptp_bolumler
  for each row execute function panel.guncellendi_yaz();


-- ---------- Personeller ----------
-- PIN düz metin TUTULMAZ. Ayrıca PIN bir kimlik doğrulama yöntemi
-- değildir — "bu görevi kim yaptı" işaretidir. Dört haneli bir PIN
-- zaten kaba kuvvete dayanmaz; koruma, ekrana ancak firma oturumu
-- açılmış bir cihazdan ulaşılabilmesinden gelir.

create table panel.ptp_personeller (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  ad           text not null,
  pin_hash     text not null,
  aktif        boolean not null default true,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz
);

create index ptp_personeller_firma on panel.ptp_personeller (firma_id);
create trigger t_ptp_personeller_guncellendi before update on panel.ptp_personeller
  for each row execute function panel.guncellendi_yaz();


-- ---------- Görev şablonları ----------
-- Günlük görevlerin kalıbı. Her gün bunlardan ptp_gorevler üretilir.

create table panel.ptp_sablonlar (
  id              uuid primary key default gen_random_uuid(),
  firma_id        uuid not null references panel.firmalar(id) on delete cascade,
  baslik          text not null,
  -- Eski adlar İngilizceydi (check/region/text/number); Türkçeleştirildi
  tur             text not null default 'onay'
                  check (tur in ('onay','bolge','metin','sayi')),
  grup            text not null
                  check (grup in ('acilis','teshir','gunici','depo','musteri','kapanis')),
  sira            integer not null default 0,
  zorunlu         boolean not null default true,
  fotograf_ister  boolean not null default false,
  ipucu           text not null default '',
  aktif           boolean not null default true,

  tekrar          text not null default 'gunluk'
                  check (tekrar in ('gunluk','haftalik')),
  -- Haftalık tekrarda hangi günler: 1=Pazartesi … 7=Pazar
  tekrar_gunleri  smallint[] not null default '{}',
  -- Gün içinde belirli saatlerde tekrarlanan görevler için
  saatler         time[] not null default '{}',

  olusturuldu     timestamptz not null default now(),
  guncellendi     timestamptz not null default now(),
  silindi         timestamptz,

  -- Haftalıksa gün belirtilmeli; günlükse gün listesi anlamsız
  constraint sablon_tekrar_tutarli check (
    (tekrar = 'gunluk'   and cardinality(tekrar_gunleri) = 0) or
    (tekrar = 'haftalik' and cardinality(tekrar_gunleri) > 0)
  )
);

create index ptp_sablonlar_firma on panel.ptp_sablonlar (firma_id, grup, sira);
create trigger t_ptp_sablonlar_guncellendi before update on panel.ptp_sablonlar
  for each row execute function panel.guncellendi_yaz();


-- ---------- Görevler ----------
-- Güne özel üretilen iş emirleri.
--
-- KARAR: dört görev türünün değeri jsonb yerine AYRI SÜTUNLARDA
-- tutuluyor. jsonb yazması kolay ama "geçen ay ortalama kaç oldu",
-- "hangi bölümde en çok atlandı" gibi soruları pahalı hale getirir ve
-- tür güvenliği vermez. Bu modülün varlık sebebi raporlama olduğu için
-- doğru taraf bu. Bedeli: yeni bir tür eklenirse sütun eklenir.

create table panel.ptp_gorevler (
  id                 uuid primary key default gen_random_uuid(),
  firma_id           uuid not null references panel.firmalar(id) on delete cascade,
  -- Şablon silinse bile geçmiş görev kaybolmaz
  sablon_id          uuid references panel.ptp_sablonlar(id) on delete set null,

  tarih              date not null,
  grup               text not null
                     check (grup in ('acilis','teshir','gunici','depo','musteri','kapanis')),
  -- Başlık kopyalanır: şablon sonradan değişse bile o günkü metin durur
  baslik             text not null,
  tur                text not null
                     check (tur in ('onay','bolge','metin','sayi')),
  zorunlu            boolean not null default true,
  fotograf_ister     boolean not null default false,
  ipucu              text not null default '',
  slot               time,

  durum              text not null default 'bekliyor'
                     check (durum in ('bekliyor','tamamlandi','atlandi')),

  -- Türe göre yalnızca biri dolar
  deger_onay         boolean,
  deger_bolge_id     uuid references panel.ptp_bolumler(id) on delete set null,
  deger_metin        text,
  deger_sayi         numeric(14,2),

  fotograf_yolu      text,
  tamamlayan_id      uuid references panel.ptp_personeller(id) on delete set null,
  tamamlanma_zamani  timestamptz,
  atlama_sebebi      text,

  kaynak             text not null default 'sablon'
                     check (kaynak in ('sablon','elle','telegram')),

  olusturuldu        timestamptz not null default now(),
  guncellendi        timestamptz not null default now(),
  silindi            timestamptz,

  -- Değer, görevin türüyle uyumlu olmalı
  constraint gorev_deger_turu check (
    case tur
      when 'onay'  then deger_bolge_id is null and deger_metin is null and deger_sayi is null
      when 'bolge' then deger_onay is null and deger_metin is null and deger_sayi is null
      when 'metin' then deger_onay is null and deger_bolge_id is null and deger_sayi is null
      when 'sayi'  then deger_onay is null and deger_bolge_id is null and deger_metin is null
    end
  ),
  -- Tamamlandıysa kim ve ne zaman belli olmalı
  constraint gorev_tamamlanma_tutarli check (
    durum <> 'tamamlandi' or (tamamlayan_id is not null and tamamlanma_zamani is not null)
  ),
  -- Atlandıysa sebebi yazılmalı
  constraint gorev_atlama_tutarli check (
    durum <> 'atlandi' or (atlama_sebebi is not null and length(btrim(atlama_sebebi)) > 0)
  )
);

-- Her sorgu firma + tarih ile filtreleniyor
create index ptp_gorevler_firma_tarih on panel.ptp_gorevler (firma_id, tarih desc);
create index ptp_gorevler_durum on panel.ptp_gorevler (firma_id, tarih, durum);
create index ptp_gorevler_sablon on panel.ptp_gorevler (sablon_id);
create trigger t_ptp_gorevler_guncellendi before update on panel.ptp_gorevler
  for each row execute function panel.guncellendi_yaz();


-- ---------- Günlük satış (Z raporu) ----------

create table panel.ptp_gunluk_satis (
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  tarih        date not null,
  tutar        numeric(14,2) not null default 0,   -- para asla float değil
  fis_adedi    integer not null default 0,
  not_metni    text not null default '',
  giren_id     uuid references panel.ptp_personeller(id) on delete set null,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  primary key (firma_id, tarih)
);

create trigger t_ptp_gunluk_satis_guncellendi before update on panel.ptp_gunluk_satis
  for each row execute function panel.guncellendi_yaz();


-- ---------- Günlük yemek sayısı ----------

create table panel.ptp_gunluk_yemek (
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  tarih        date not null,
  adet         integer not null default 0,
  not_metni    text not null default '',
  giren_id     uuid references panel.ptp_personeller(id) on delete set null,
  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  primary key (firma_id, tarih)
);

create trigger t_ptp_gunluk_yemek_guncellendi before update on panel.ptp_gunluk_yemek
  for each row execute function panel.guncellendi_yaz();


-- ---------- Günlük giriş kayıtları ----------
-- Personelin o gün ilk kez ekranı açması. Puantaj değildir.

create table panel.ptp_giris_kayitlari (
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,
  tarih        date not null,
  personel_id  uuid not null references panel.ptp_personeller(id) on delete cascade,
  zaman        timestamptz not null default now(),
  primary key (firma_id, tarih, personel_id)
);


-- ============================================================
-- RLS — her tabloda aynı desen
-- ============================================================

alter table panel.ptp_ayarlar          enable row level security;
alter table panel.ptp_bolumler         enable row level security;
alter table panel.ptp_personeller      enable row level security;
alter table panel.ptp_sablonlar        enable row level security;
alter table panel.ptp_gorevler         enable row level security;
alter table panel.ptp_gunluk_satis     enable row level security;
alter table panel.ptp_gunluk_yemek     enable row level security;
alter table panel.ptp_giris_kayitlari  enable row level security;

/* Politikaları tek tek yazmak yerine üretiyoruz: sekiz tablo için
   otuz iki politika elle yazılırsa biri eninde sonunda atlanır ya da
   `with check` unutulur. Desen tek yerde durursa hepsi aynı olur. */
do $$
declare t text;
begin
  foreach t in array array[
    'ptp_ayarlar','ptp_bolumler','ptp_personeller','ptp_sablonlar',
    'ptp_gorevler','ptp_gunluk_satis','ptp_gunluk_yemek','ptp_giris_kayitlari'
  ] loop
    execute format($f$
      create policy %1$s_okuma on panel.%1$s for select
        using (firma_id = panel.aktif_firma() or panel.superadmin_mi());

      create policy %1$s_ekleme on panel.%1$s for insert
        with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());

      create policy %1$s_guncelleme on panel.%1$s for update
        using (firma_id = panel.aktif_firma() or panel.superadmin_mi())
        with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());

      create policy %1$s_silme on panel.%1$s for delete
        using (panel.superadmin_mi());
    $f$, t);
  end loop;
end $$;


-- ---------- İzinler ----------
-- Yeni tablolar için de anon KAPALI kalır.

grant select, insert, update, delete on all tables in schema panel
  to authenticated, service_role;
revoke all on all tables in schema panel from anon;
