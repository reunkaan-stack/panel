-- ============================================================
-- 6_  EKSİK BESLEYEN GÖREV + EKSİK KATEGORİLERİ
--
-- İki iş:
--   A. Eksikler ikiye ayrılıyor: ürün (fuardan toplanır) ve temel
--      ihtiyaç (marketten alınır). Tedarik yolları farklı olduğu için
--      liste de ayrı okunmalı.
--   B. Yeni görev türü: `eksik`. Personel görev içinde ürünleri TEK TEK
--      ekliyor; her biri ayrı eksik kaydı oluyor.
--
-- Önceki hâlde "eksik ürün tespiti" serbest metindi: personel
-- "bardak takımı, kahve fincanı, supla" yazıyor ve üçü tek kayıt
-- oluyordu. Tek tek işaretlenemiyor, sayılamıyordu.
-- ============================================================


-- ---------- A. Eksik kategorileri ----------

alter table panel.ptp_eksikler
  add column if not exists kategori text not null default 'urun';

alter table panel.ptp_eksikler
  drop constraint if exists ptp_eksikler_kategori_check;

alter table panel.ptp_eksikler
  add constraint ptp_eksikler_kategori_check
  check (kategori in ('urun','temel'));

comment on column panel.ptp_eksikler.kategori is
  'urun = fuardan toplanır, temel = marketten alınır. Tedarik yolu farklı.';

/* Eksik bir görevden geldiyse izi kalsın: "bu ürün hangi gün, hangi
   görevde bildirildi" sorusu sonradan sorulur. */
alter table panel.ptp_eksikler
  add column if not exists gorev_id uuid
    references panel.ptp_gorevler(id) on delete set null,
  add column if not exists kayit_id uuid
    references panel.ptp_kayitlar(id) on delete set null;

create index if not exists ptp_eksikler_kategori
  on panel.ptp_eksikler (firma_id, kategori, durum, olusturuldu desc);


-- ---------- B. Yeni görev türü ----------

alter table panel.ptp_gorevler drop constraint if exists ptp_sablonlar_tur_check;
alter table panel.ptp_gorevler drop constraint if exists ptp_gorevler_tur_check;

alter table panel.ptp_gorevler
  add constraint ptp_gorevler_tur_check
  check (tur in ('onay','kontrol','bolge','metin','sayi','eksik'));

/* Görev hangi kategoriye eksik yazacak. Yalnızca tur = 'eksik' iken
   anlamlı; diğerlerinde boş kalır. */
alter table panel.ptp_gorevler
  add column if not exists eksik_kategori text;

alter table panel.ptp_gorevler
  drop constraint if exists gorev_eksik_kategori_tutarli;

alter table panel.ptp_gorevler
  add constraint gorev_eksik_kategori_tutarli check (
    (tur = 'eksik' and eksik_kategori in ('urun','temel'))
    or (tur <> 'eksik' and eksik_kategori is null)
  );


-- ---------- C. Mevcut görevi yeni türe çevir ----------
-- "Eksik urun tespiti" serbest metindi; artık eksik listesini besliyor.

update panel.ptp_gorevler
   set tur = 'eksik', eksik_kategori = 'urun'
 where baslik like 'Eksik urun tespiti%'
   and silindi is null;

/* Paketleme malzemesi temel ihtiyaç; sayı yerine liste daha kullanışlı
   ama mevcut tanım bozulmasın diye DOKUNULMUYOR. Yönetici isterse
   panelden türünü değiştirir. */


-- ---------- Doğrulama ----------

select tur, eksik_kategori, count(*)
  from panel.ptp_gorevler
 where silindi is null
 group by tur, eksik_kategori
 order by tur;
