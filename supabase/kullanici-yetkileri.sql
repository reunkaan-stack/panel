-- ============================================================
-- KULLANICI YETKİLENDİRME
--
-- Üç kişi tanımlanıyor:
--   kaannkarabiyik@gmail.com   → superadmin  (Karas Teknoloji)
--   admin@karasteknoloji.com   → firma yöneticisi (Squala Home)
--   kasa@karasteknoloji.com    → personel (Squala Home, PTP yazma)
--
-- ⚠️ Üçünün de Supabase → Authentication → Users altında hesabı
-- açılmış olmalı. Bu dosya o hesapları panel kullanıcısına bağlar.
--
-- Dosya birden çok kez çalıştırılabilir.
-- ============================================================


-- ============================================================
-- 0. ÖNCE BAK — çalıştırmadan önce mevcut durumu gör
-- ============================================================

select u.email                       as auth_hesabi,
       k.ad, k.rol, f.ad             as firma,
       coalesce(my.modul || ':' || my.seviye, '—') as ptp_yetkisi
  from auth.users u
  left join panel.kullanicilar k   on k.auth_id = u.id
  left join panel.firmalar f       on f.id = k.firma_id
  left join panel.modul_yetkileri my on my.kullanici_id = k.id and my.modul = 'ptp'
 order by u.email;


-- ============================================================
-- 1. SÜPERADMİN
-- ============================================================

insert into panel.kullanicilar (auth_id, firma_id, ad, eposta, rol)
select u.id, null, 'Kaan Karabıyık', u.email, 'superadmin'
  from auth.users u
 where u.email = 'kaannkarabiyik@gmail.com'
on conflict (auth_id) do update
   set rol = 'superadmin',
       firma_id = null,
       ad = excluded.ad,
       aktif = true,
       silindi = null;


-- ============================================================
-- 2. FİRMA YÖNETİCİSİ — Squala Home
--
-- firma_yoneticisi ayrıca modul_yetkileri kaydı GEREKTİRMEZ:
-- panel.modul_seviyesi() onu kendi firmasında doğrudan 'yonetim'
-- sayar. Firmanın o modülü almış olması yeterli.
-- ============================================================

insert into panel.kullanicilar (auth_id, firma_id, ad, eposta, rol)
select u.id, f.id, 'Yönetici', u.email, 'firma_yoneticisi'
  from auth.users u
 cross join panel.firmalar f
 where u.email = 'admin@karasteknoloji.com'
   and f.kisa_ad = 'squala'
on conflict (auth_id) do update
   set rol = 'firma_yoneticisi',
       firma_id = excluded.firma_id,
       aktif = true,
       silindi = null;


-- ============================================================
-- 3. PERSONEL — Squala Home, kasa
-- ============================================================

insert into panel.kullanicilar (auth_id, firma_id, ad, eposta, rol)
select u.id, f.id, 'Kasa', u.email, 'kullanici'
  from auth.users u
 cross join panel.firmalar f
 where u.email = 'kasa@karasteknoloji.com'
   and f.kisa_ad = 'squala'
on conflict (auth_id) do update
   set rol = 'kullanici',
       firma_id = excluded.firma_id,
       aktif = true,
       silindi = null;

-- Personelin PTP yetkisi: 'yazma' = kendine atanan görevleri kapatır
insert into panel.modul_yetkileri (kullanici_id, modul, seviye)
select k.id, 'ptp', 'yazma'
  from panel.kullanicilar k
 where k.eposta = 'kasa@karasteknoloji.com'
on conflict (kullanici_id, modul) do update
   set seviye = excluded.seviye;


-- ============================================================
-- 4. DOĞRULAMA — üç satır görmelisin
-- ============================================================

select k.eposta,
       k.ad,
       k.rol,
       coalesce(f.ad, '(firma yok — süperadmin)') as firma,
       coalesce(my.seviye, case when k.rol in ('superadmin','firma_yoneticisi')
                                then 'yonetim (rolden)' else '— yetki yok' end) as ptp,
       k.aktif
  from panel.kullanicilar k
  left join panel.firmalar f on f.id = k.firma_id
  left join panel.modul_yetkileri my on my.kullanici_id = k.id and my.modul = 'ptp'
 where k.silindi is null
 order by case k.rol when 'superadmin' then 1
                     when 'firma_yoneticisi' then 2 else 3 end, k.eposta;


-- ============================================================
-- 5. İSTEĞE BAĞLI TEMİZLİK
--
-- Kurulum dosyasında süperadmin olarak reunkaan@gmail.com yazılıydı.
-- Yukarıdaki 0. sorguda o adrese ait bir kayıt görüyorsan ve
-- KULLANMIYORSAN, aşağıdaki satırı yorumdan çıkarıp çalıştır.
--
-- ⚠️ Şu an giriş yaptığın hesabı silme — kendini kilitlersin.
-- Önce yeni süperadminle giriş yapabildiğini doğrula.
-- ============================================================

-- update panel.kullanicilar set silindi = now(), aktif = false
--  where eposta = 'reunkaan@gmail.com';
