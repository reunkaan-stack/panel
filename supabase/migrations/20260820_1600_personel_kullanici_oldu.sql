-- ============================================================
-- PERSONEL ARTIK GERÇEK KULLANICI
--
-- Önceki tasarımda personel ortak bir cihazdan PIN girip kendini
-- işaretliyordu (eski Electron programından devralınan yapı).
--
-- Karar değişti: her personelin kendi kullanıcı adı ve şifresi olacak,
-- panele kendi hesabıyla girecek. Sistem kim olduğuna bakıp ekranları
-- ona göre açacak.
--
-- Sonuç: `ptp_personeller` tablosu gereksiz — personel zaten
-- `panel.kullanicilar`. PIN kavramı tamamen kalkıyor.
--
-- ⚠️ Bu migration tabloları DÜŞÜRÜP yeniden kuruyor. Yalnızca temiz
-- başlangıçta güvenlidir; tablolar henüz boş. Veri girdikten sonra
-- aynı işlem `alter table` ile ve iki adımda yapılırdı.
-- ============================================================


-- ---------- Artık gereksiz: PIN'li personel tablosu ----------
-- Ona bağlı yabancı anahtarlar da düşüyor.

drop table if exists panel.ptp_giris_kayitlari;
drop table if exists panel.ptp_personeller cascade;


-- ---------- Görevler: kim yaptı, kime atandı ----------

alter table panel.ptp_gorevler
  drop column if exists tamamlayan_id;

alter table panel.ptp_gorevler
  add column atanan_id uuid references panel.kullanicilar(id) on delete set null,
  add column tamamlayan_id uuid references panel.kullanicilar(id) on delete set null;

comment on column panel.ptp_gorevler.atanan_id is
  'Görevi yapması beklenen kişi. Boşsa görev herkese açıktır.';
comment on column panel.ptp_gorevler.tamamlayan_id is
  'Görevi fiilen kapatan kişi. Atanandan farklı olabilir.';

create index ptp_gorevler_atanan on panel.ptp_gorevler (firma_id, atanan_id, tarih desc);


-- ---------- Günlük kayıtlarda giren kişi ----------

alter table panel.ptp_gunluk_satis drop column if exists giren_id;
alter table panel.ptp_gunluk_satis
  add column giren_id uuid references panel.kullanicilar(id) on delete set null;

alter table panel.ptp_gunluk_yemek drop column if exists giren_id;
alter table panel.ptp_gunluk_yemek
  add column giren_id uuid references panel.kullanicilar(id) on delete set null;


-- ---------- Ayarlar ----------
-- Çoklu personel artık seçenek değil, sistemin kendisi.

alter table panel.ptp_ayarlar drop column if exists coklu_personel;


-- ============================================================
-- PTP ROL EŞLEMESİ
--
-- Panel rolleri (superadmin / firma_yoneticisi / kullanici) sistemin
-- geneli için. PTP içindeki "personel mi müdür mü" ayrımı
-- `modul_yetkileri.seviye` ile kuruluyor — yeni bir rol alanı
-- açılmıyor, var olan yapı yetiyor:
--
--   okuma   → görevleri görür, kapatamaz (denetçi, muhasebe)
--   yazma   → PERSONEL: kendine atanan görevleri kapatır
--   yonetim → MÜDÜR: görev atar, şablon düzenler, raporları görür
--
-- firma_yoneticisi ve superadmin, ayrı kayda gerek olmadan `yonetim`
-- sayılır; bunu uygulama katmanındaki yetkiDenetle() çözer.
-- ============================================================

-- Kullanıcının bir modüldeki etkin seviyesi.
-- Firma o modülü almadıysa yetki yok sayılır — iki katman birden.
create or replace function panel.modul_seviyesi(p_modul text)
returns text
language sql stable security definer set search_path = panel, public as $$
  select case
    -- Süperadmin her modülde yönetimdir
    when panel.superadmin_mi() then 'yonetim'
    -- Firma o modülü almamışsa yetki yoktur
    when not exists (
      select 1 from panel.firma_modulleri fm
       where fm.firma_id = panel.aktif_firma()
         and fm.modul = p_modul
         and fm.aktif
         and (fm.bitis is null or fm.bitis >= current_date)
    ) then null
    -- Firma yöneticisi kendi firmasında yönetimdir
    when panel.firma_yoneticisi_mi() then 'yonetim'
    else (
      select my.seviye
        from panel.modul_yetkileri my
        join panel.kullanicilar k on k.id = my.kullanici_id
       where k.auth_id = auth.uid() and my.modul = p_modul
    )
  end
$$;

comment on function panel.modul_seviyesi is
  'Oturumdaki kullanıcının verilen moduldeki etkin seviyesi: okuma, yazma, yonetim ya da null.';
