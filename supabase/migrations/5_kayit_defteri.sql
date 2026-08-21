-- ============================================================
-- 5_  YENİ YAPI: TANIM + KAYIT DEFTERİ
--
-- Eski yapıda her sabah 23 görev satırı üretiliyordu ve bunların
-- çoğu "hiçbir şey olmadı" diyen yer tutucuydu — yılda ~8400 satır.
--
-- Yeni yapı iki tablo:
--   ptp_gorevler  → tanım. Ne yapılacak, ne sıklıkla, kime atandı.
--   ptp_kayitlar  → ne yapıldı. Sadece gerçekten olanlar.
--
-- "Bugün hangi görevler var" okuma anında hesaplanıyor: bugün
-- haftanın kaçıncı günü, hangi tanımlar ona düşüyor. Üretim yok,
-- cron yok, "günü oluştur" yok.
--
-- ⚠️ Bu migration eski görev tablolarını DÜŞÜRÜR. Elde gerçek
-- kullanım verisi olmadığı için güvenli; sonraya kalsaydı veri
-- taşıma da gerekirdi.
-- ============================================================


-- ---------- 1. Eski üretim düzenini kaldır ----------

select cron.unschedule('ptp-gunluk-gorev')
 where exists (select 1 from cron.job where jobname = 'ptp-gunluk-gorev');

drop function if exists panel.ptp_gunluk_is();
drop function if exists panel.ptp_gunumu_olustur(date);
drop function if exists panel.ptp_gunu_uret(uuid, date);

drop view if exists panel.ptp_bolge_yogunlugu;

drop table if exists panel.ptp_gorev_maddeleri;
drop table if exists panel.ptp_gorev_kayitlari;
drop table if exists panel.ptp_gorevler;


-- ---------- 2. Tanım tablosu ----------
-- "Şablon" adı bırakıldı: şablon, örnek üreten şeydir; artık
-- üretmiyoruz. Bu tablo görevin kendisi.

alter table panel.ptp_sablonlar rename to ptp_gorevler;
alter table panel.ptp_sablon_maddeleri rename to ptp_gorev_maddeleri;

alter table panel.ptp_gorev_maddeleri rename column sablon_id to gorev_id;

/* Atama görevin kendisinde ve KALICI. Küçük bir mağazada aynı işi
   genelde aynı kişi yapar; her gün yeniden atamak gereksiz iş olurdu.
   Boşsa görev herkese açıktır. */
alter table panel.ptp_gorevler
  add column if not exists atanan_id uuid
    references panel.kullanicilar(id) on delete set null;

comment on column panel.ptp_gorevler.atanan_id is
  'Görevi yapacak kişi. Boşsa görev herkese görünür ve herkes kapatabilir.';

create index if not exists ptp_gorevler_atanan
  on panel.ptp_gorevler (firma_id, atanan_id);


-- ---------- 3. Kayıt defteri ----------
-- "3 nolu görevi Kaan 14:20'de yaptı, şu bölgeleri temizledi."

create table panel.ptp_kayitlar (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null references panel.firmalar(id) on delete cascade,
  gorev_id      uuid not null references panel.ptp_gorevler(id) on delete cascade,

  tarih         date not null,
  zaman         timestamptz not null default now(),
  yapan_id      uuid references panel.kullanicilar(id) on delete set null,

  durum         text not null default 'yapildi'
                check (durum in ('yapildi','atlandi')),

  /* Görev tanımı sonradan değişirse geçmiş bozulmasın diye başlık
     kaydın içine kopyalanır. Sadece gerçekten olan şeyler için, yani
     tekrar başına bir kopya — 23 boş satır değil. */
  baslik_kopya  text not null,

  /* Çoklu değerler dizi olarak. Ayrı ara tablolar açmak, bir günlük
     kaydı okumak için üç join demek olurdu; bu bir kayıt defteri,
     ilişkisel çözümleme değil. Raporda unnest ile açılıyor. */
  bolge_idler   uuid[] not null default '{}',
  madde_idler   uuid[] not null default '{}',

  deger_metin   text,
  deger_sayi    numeric(14,2),
  not_metni     text not null default '',
  fotograf_yolu text,

  olusturuldu   timestamptz not null default now(),

  /* Atlandıysa sebebi yazılmalı */
  constraint kayit_atlama_tutarli check (
    durum <> 'atlandi' or length(btrim(not_metni)) > 0
  )
);

/* Her sorgu firma + tarih ile filtreleniyor */
create index ptp_kayitlar_firma_tarih on panel.ptp_kayitlar (firma_id, tarih desc);
create index ptp_kayitlar_gorev on panel.ptp_kayitlar (gorev_id, tarih desc);
create index ptp_kayitlar_yapan on panel.ptp_kayitlar (yapan_id, tarih desc);
/* Bölge raporu dizinin içinde arıyor; GIN olmadan tarama yapardı */
create index ptp_kayitlar_bolge on panel.ptp_kayitlar using gin (bolge_idler);


-- ---------- 4. RLS ----------

alter table panel.ptp_kayitlar enable row level security;

create policy ptp_kayitlar_okuma on panel.ptp_kayitlar for select
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy ptp_kayitlar_ekleme on panel.ptp_kayitlar for insert
  with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy ptp_kayitlar_guncelleme on panel.ptp_kayitlar for update
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi())
  with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());

create policy ptp_kayitlar_silme on panel.ptp_kayitlar for delete
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi());

grant select, insert, update, delete on all tables in schema panel
  to authenticated, service_role;
revoke all on all tables in schema panel from anon;


-- ============================================================
-- 5. RAPORLAR — iki tabloyu birleştirerek
-- ============================================================

drop function if exists panel.ptp_kisi_performansi(date, date);
drop function if exists panel.ptp_gorev_performansi(date, date);
drop function if exists panel.ptp_gun_ozeti(date, date);
drop function if exists panel.ptp_atlananlar(date, date);


/* Bir günde hangi görevler geçerli — tek doğru kaynak.
   Hem ekran hem raporlar bunu kullanır; iki ayrı yerde
   "bugün hangi görev" hesaplanırsa biri diğerinden sapar. */
create or replace function panel.ptp_gunun_gorevleri(
  p_firma_id uuid,
  p_tarih date
)
returns setof panel.ptp_gorevler
language sql stable as $$
  select g.*
    from panel.ptp_gorevler g
   where g.firma_id = p_firma_id
     and g.aktif
     and g.silindi is null
     and (
       g.tekrar = 'gunluk'
       or (g.tekrar = 'haftalik'
           and extract(isodow from p_tarih)::smallint = any(g.tekrar_gunleri))
       or (g.tekrar = 'tek_seferlik' and g.tek_tarih = p_tarih)
     );
$$;


create or replace function panel.ptp_kisi_performansi(
  p_firma_id uuid, p_baslangic date, p_bitis date
)
returns table (
  kullanici_id uuid, ad text,
  atanan bigint, yapilan bigint, atlanan bigint, ort_saat numeric
)
language sql stable as $$
  select k.id,
         k.ad,
         (select count(*) from panel.ptp_gorevler g
           where g.atanan_id = k.id and g.firma_id = p_firma_id
             and g.aktif and g.silindi is null),
         count(*) filter (where kay.durum = 'yapildi'),
         count(*) filter (where kay.durum = 'atlandi'),
         round(avg(
           extract(hour   from kay.zaman at time zone 'Europe/Istanbul')
         + extract(minute from kay.zaman at time zone 'Europe/Istanbul') / 60.0
         ) filter (where kay.durum = 'yapildi'), 2)
    from panel.kullanicilar k
    left join panel.ptp_kayitlar kay
      on kay.yapan_id = k.id
     and kay.firma_id = p_firma_id
     and kay.tarih between p_baslangic and p_bitis
   where k.silindi is null
   group by k.id, k.ad
  having count(kay.id) > 0
      or (select count(*) from panel.ptp_gorevler g
           where g.atanan_id = k.id and g.firma_id = p_firma_id
             and g.aktif and g.silindi is null) > 0
   order by 4 desc, k.ad;
$$;


/* Görev başına: kaç gün geçerliydi, kaç kez yapıldı, kaç kez atlandı.
   "Geçerli gün sayısı" tanımdan hesaplanıyor — üretilmiş satır yok. */
create or replace function panel.ptp_gorev_performansi(
  p_firma_id uuid, p_baslangic date, p_bitis date
)
returns table (
  gorev_id uuid, baslik text, grup text, zorunlu boolean,
  gecerli_gun bigint, yapilan bigint, atlanan bigint, oran numeric
)
language sql stable as $$
  with gunler as (
    select generate_series(p_baslangic, p_bitis, interval '1 day')::date as tarih
  ),
  gecerli as (
    select g.id, count(*) as gun
      from panel.ptp_gorevler g
      join gunler d on (
        g.tekrar = 'gunluk'
        or (g.tekrar = 'haftalik'
            and extract(isodow from d.tarih)::smallint = any(g.tekrar_gunleri))
        or (g.tekrar = 'tek_seferlik' and g.tek_tarih = d.tarih)
      )
     where g.firma_id = p_firma_id and g.aktif and g.silindi is null
     group by g.id
  )
  select g.id, g.baslik, g.grup, g.zorunlu,
         coalesce(ge.gun, 0),
         count(k.id) filter (where k.durum = 'yapildi'),
         count(k.id) filter (where k.durum = 'atlandi'),
         round(100.0 * count(distinct k.tarih) filter (where k.durum = 'yapildi')
               / nullif(ge.gun, 0), 0)
    from panel.ptp_gorevler g
    left join gecerli ge on ge.id = g.id
    left join panel.ptp_kayitlar k
      on k.gorev_id = g.id and k.tarih between p_baslangic and p_bitis
   where g.firma_id = p_firma_id and g.aktif and g.silindi is null
   group by g.id, g.baslik, g.grup, g.zorunlu, ge.gun
   order by 7 desc, 8 asc nulls last, g.baslik;
$$;


create or replace function panel.ptp_gun_ozeti(
  p_firma_id uuid, p_baslangic date, p_bitis date
)
returns table (
  tarih date, toplam bigint, yapilan bigint, atlanan bigint, oran numeric
)
language sql stable as $$
  with gunler as (
    select d::date as tarih
      from generate_series(p_baslangic, p_bitis, interval '1 day') d
  ),
  /* O gün geçerli görev sayısı tanımdan hesaplanıyor */
  gecerli as (
    select gu.tarih, count(*) as adet
      from gunler gu
      join panel.ptp_gorevler g on (
        g.firma_id = p_firma_id and g.aktif and g.silindi is null
        and (
          g.tekrar = 'gunluk'
          or (g.tekrar = 'haftalik'
              and extract(isodow from gu.tarih)::smallint = any(g.tekrar_gunleri))
          or (g.tekrar = 'tek_seferlik' and g.tek_tarih = gu.tarih)
        )
      )
     group by gu.tarih
  )
  select gu.tarih,
         coalesce(ge.adet, 0),
         count(k.id) filter (where k.durum = 'yapildi'),
         count(k.id) filter (where k.durum = 'atlandi'),
         round(100.0 * count(distinct k.gorev_id) filter (where k.durum = 'yapildi')
               / nullif(ge.adet, 0), 0)
    from gunler gu
    left join gecerli ge on ge.tarih = gu.tarih
    left join panel.ptp_kayitlar k
      on k.tarih = gu.tarih and k.firma_id = p_firma_id
   group by gu.tarih, ge.adet
   order by gu.tarih desc;
$$;


create or replace function panel.ptp_atlananlar(
  p_firma_id uuid, p_baslangic date, p_bitis date
)
returns table (
  tarih date, baslik text, sebep text, kisi text, zaman timestamptz
)
language sql stable as $$
  select k.tarih, k.baslik_kopya, k.not_metni, u.ad, k.zaman
    from panel.ptp_kayitlar k
    left join panel.kullanicilar u on u.id = k.yapan_id
   where k.firma_id = p_firma_id
     and k.tarih between p_baslangic and p_bitis
     and k.durum = 'atlandi'
   order by k.tarih desc, k.zaman desc;
$$;


/* Bölge yoğunluğu: kayıtlardaki dizi açılarak sayılıyor. */
create or replace function panel.ptp_bolge_yogunlugu(
  p_firma_id uuid, p_baslangic date, p_bitis date
)
returns table (bolge_id uuid, adet bigint)
language sql stable as $$
  select b.bolge_id, count(*)
    from panel.ptp_kayitlar k
    cross join lateral unnest(k.bolge_idler) as b(bolge_id)
   where k.firma_id = p_firma_id
     and k.tarih between p_baslangic and p_bitis
     and k.durum = 'yapildi'
   group by b.bolge_id;
$$;


grant execute on function
  panel.ptp_gunun_gorevleri(uuid, date),
  panel.ptp_kisi_performansi(uuid, date, date),
  panel.ptp_gorev_performansi(uuid, date, date),
  panel.ptp_gun_ozeti(uuid, date, date),
  panel.ptp_atlananlar(uuid, date, date),
  panel.ptp_bolge_yogunlugu(uuid, date, date)
  to authenticated, service_role;


-- ---------- Doğrulama ----------

select 'gorev' as tablo, count(*) from panel.ptp_gorevler where silindi is null
union all
select 'kayit', count(*) from panel.ptp_kayitlar
union all
select 'cron', count(*) from cron.job where jobname = 'ptp-gunluk-gorev';
