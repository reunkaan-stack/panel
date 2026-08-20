-- ============================================================
-- 1_  TEKRARLANABİLİR GÖREV + GERÇEK GÖREV TANIMLARI
--
-- İki iş:
--   A. `tekrarlanabilir` alanı ekleniyor — gün içinde birden çok kez
--      yapılabilen görevler için (zemin ara kontrol, toz alma…)
--   B. Deneme şablonları silinip Squala Home'un GERÇEK 23 görevi
--      yükleniyor
--
-- Önceki kurulumdaki 10 şablon benim uydurduğum örneklerdi; bunlar
-- iki yıllık gerçek kullanımdan geliyor.
-- ============================================================


-- ---------- A. Tekrarlanabilir alanı ----------

alter table panel.ptp_sablonlar
  add column if not exists tekrarlanabilir boolean not null default false;

alter table panel.ptp_gorevler
  add column if not exists tekrarlanabilir boolean not null default false;

comment on column panel.ptp_sablonlar.tekrarlanabilir is
  'Gün içinde birden çok kez yapılabilir. Kapatıldığında görev listeden düşmez, tekrar yapılabilir kalır.';

-- Kaç kez yapıldığı ve her seferinde kim yaptı
create table if not exists panel.ptp_gorev_kayitlari (
  id            uuid primary key default gen_random_uuid(),
  firma_id      uuid not null references panel.firmalar(id) on delete cascade,
  gorev_id      uuid not null references panel.ptp_gorevler(id) on delete cascade,
  yapan_id      uuid references panel.kullanicilar(id) on delete set null,
  zaman         timestamptz not null default now(),
  -- Türe göre dolan değer; tekrarlanabilir görevde her tekrar ayrı kayıt
  deger_bolge_id uuid references panel.ptp_bolumler(id) on delete set null,
  deger_metin   text,
  deger_sayi    numeric(14,2),
  olusturuldu   timestamptz not null default now()
);

create index if not exists ptp_gorev_kayitlari_gorev
  on panel.ptp_gorev_kayitlari (gorev_id, zaman desc);

alter table panel.ptp_gorev_kayitlari enable row level security;

create policy ptp_gorev_kayitlari_okuma on panel.ptp_gorev_kayitlari for select
  using (firma_id = panel.aktif_firma() or panel.superadmin_mi());
create policy ptp_gorev_kayitlari_ekleme on panel.ptp_gorev_kayitlari for insert
  with check (firma_id = panel.aktif_firma() or panel.superadmin_mi());
create policy ptp_gorev_kayitlari_silme on panel.ptp_gorev_kayitlari for delete
  using (panel.superadmin_mi());

grant select, insert, update, delete on all tables in schema panel
  to authenticated, service_role;
revoke all on all tables in schema panel from anon;


-- ---------- B. Deneme şablonlarını temizle ----------
-- Bunlar kurulum sırasında örnek olarak yazılmıştı, gerçek değil.
-- Onlardan üretilmiş görevler de siliniyor.

delete from panel.ptp_gorevler
 where sablon_id in (select id from panel.ptp_sablonlar);

delete from panel.ptp_sablonlar
 where firma_id = (select id from panel.firmalar where kisa_ad = 'squala');


-- ---------- C. Gerçek görev tanımları ----------
-- Gün numaraları: 1=Pzt 2=Sal 3=Çar 4=Per 5=Cum 6=Cmt 7=Paz

insert into panel.ptp_sablonlar
  (firma_id, baslik, tur, grup, sira, zorunlu, tekrarlanabilir, tekrar, tekrar_gunleri, ipucu)
select f.id, s.baslik, s.tur, s.grup, s.sira, s.zorunlu, s.tekrarlanabilir,
       s.tekrar, s.gunler::smallint[], s.ipucu
  from panel.firmalar f
 cross join (values
   -- ===== AÇILIŞ RUTİNLERİ =====
   ('Zemin kontrolu (supuruldu / silindi mi?)',
    'onay',  'acilis',  1, true,  false, 'gunluk',   '{}',            ''),
   ('Aydinlatma kontrolu (tum isiklar acik mi?)',
    'onay',  'acilis',  2, false, false, 'gunluk',   '{}',            ''),
   ('Toz alma (raflar, cam objeler, aynalar, abajurlar)',
    'bolge', 'acilis',  3, true,  true,  'gunluk',   '{}',            'Temizlik alani secilir'),
   ('Vitrin ve giris cami temizligi (el izleri)',
    'onay',  'acilis',  4, false, false, 'gunluk',   '{}',            ''),
   ('Muzik sistemi acildi mi, ses seviyesi ideal mi?',
    'onay',  'acilis',  5, false, false, 'gunluk',   '{}',            ''),
   ('HAFTALIK DERIN TEMIZLIK (raf arkalari, koseler, tavandaki orumcek aglari)',
    'bolge', 'acilis',  6, false, false, 'haftalik', '{1,4}',         ''),
   ('Trendyol kargo hazirlanmasi',
    'onay',  'acilis',  7, true,  false, 'haftalik', '{1,2,3,4,5,6}', ''),
   ('Tum magaza orumcek agi kontrolu',
    'bolge', 'acilis',  8, true,  true,  'gunluk',   '{}',            ''),

   -- ===== TEŞHİR VE REYON DÜZENİ =====
   ('Etiket ve fiyat kontrolu (eksik / yipranmis etiket var mi?)',
    'onay',  'teshir',  1, true,  true,  'gunluk',   '{}',            ''),
   ('Tum raflar kontrol edilip duzenlendi mi?',
    'onay',  'teshir',  2, false, true,  'gunluk',   '{}',            ''),
   ('Kombin / konsept kontrolu (dagilan sunumlar duzeltildi mi?)',
    'onay',  'teshir',  3, false, false, 'gunluk',   '{}',            ''),

   -- ===== GÜN İÇİ DEVAM EDEN KONTROLLER =====
   ('Zemin ara kontrol',
    'bolge', 'gunici',  1, false, true,  'gunluk',   '{}',            ''),
   ('Dagilan kombinleri duzelt',
    'onay',  'gunici',  2, false, true,  'gunluk',   '{}',            ''),
   ('Eksik urun tespiti (reyonda 1 adede dusen / tukenenleri yaz)',
    'metin', 'gunici',  3, false, true,  'gunluk',   '{}',            ''),
   ('Musteri talepleri notu (bulunamayan / istenen urunler)',
    'metin', 'gunici',  4, false, true,  'gunluk',   '{}',            ''),
   ('Depo icindeki mutfak temizligi',
    'onay',  'gunici',  5, true,  false, 'haftalik', '{4}',           ''),

   -- ===== DEPO VE STOK YÖNETİMİ =====
   ('Depodan reyona transfer (eksikler getirildi mi?)',
    'onay',  'depo',    1, false, true,  'gunluk',   '{}',            ''),
   ('Depo duzenli mi?',
    'onay',  'depo',    2, false, false, 'gunluk',   '{}',            ''),
   ('DERIN DEPO SAYIMI (haftalik)',
    'metin', 'depo',    3, false, false, 'haftalik', '{2}',           ''),

   -- ===== MÜŞTERİ DENEYİMİ VE KASA =====
   ('Paketleme malzemeleri yeterli mi? (kagit/poset/kurdele/ip/fatura rulosu)',
    'sayi',  'musteri', 1, true,  false, 'haftalik', '{1,5}',         'Kalan adedi yazin'),
   ('Kasa cevresi duzeni (kisisel esyalar gorunuyor mu?)',
    'onay',  'musteri', 2, false, true,  'gunluk',   '{}',            ''),

   -- ===== KAPANIŞ VE GÜVENLİK =====
   ('Elektrik / cihaz kapatma (isiklar, klima, kasa, kahve makinesi)',
    'onay',  'kapanis', 1, true,  false, 'gunluk',   '{}',            ''),
   ('Copler atildi mi?',
    'onay',  'kapanis', 2, true,  false, 'gunluk',   '{}',            '')
 ) as s(baslik, tur, grup, sira, zorunlu, tekrarlanabilir, tekrar, gunler, ipucu)
 where f.kisa_ad = 'squala'
on conflict (firma_id, grup, baslik) where silindi is null do nothing;


-- ---------- Doğrulama ----------
-- 23 satır beklenir.

select grup,
       count(*)                                        as adet,
       count(*) filter (where zorunlu)                 as zorunlu,
       count(*) filter (where tekrarlanabilir)         as tekrarlanabilir,
       count(*) filter (where tekrar = 'haftalik')     as haftalik
  from panel.ptp_sablonlar
 where silindi is null
 group by grup
 union all
select 'TOPLAM', count(*),
       count(*) filter (where zorunlu),
       count(*) filter (where tekrarlanabilir),
       count(*) filter (where tekrar = 'haftalik')
  from panel.ptp_sablonlar where silindi is null;
