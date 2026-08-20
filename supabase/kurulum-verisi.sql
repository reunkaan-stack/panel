-- ============================================================
-- KURULUM VERİSİ — bir kez çalıştırılır
--
-- Bu bir migration DEĞİLDİR: şema değiştirmez, ilk kayıtları açar.
-- Migration'lar her ortamda çalışır; bu dosya yalnızca gerçek kurulumda.
--
-- Dosya birden çok kez çalıştırılabilir: her ekleme "on conflict" ile
-- korunuyor, tekrar çalıştırmak veriyi ikiye katlamaz.
--
-- ⚠️ Çalıştırmadan ÖNCE: Supabase → Authentication → Users → Add user
-- ile aşağıdaki e-postalar için hesap açılmış olmalı ("Auto confirm
-- user" işaretli). Bu betik o hesapları panel kullanıcısına bağlar.
-- ============================================================


-- ---------- 1. Süperadmin (Karas Teknoloji) ----------
-- Firması yoktur; firmaların üstündedir.

insert into panel.kullanicilar (auth_id, firma_id, ad, eposta, rol)
select u.id, null, 'Kaan Karabıyık', u.email, 'superadmin'
  from auth.users u
 where u.email = 'kaannkarabiyik@gmail.com'
on conflict (auth_id) do update
   set rol = 'superadmin', firma_id = null;


-- ---------- 2. İlk firma ----------

insert into panel.firmalar (ad, kisa_ad)
values ('Squala Home', 'squala')
on conflict (kisa_ad) do nothing;


-- ---------- 3. Firmaya PTP modülü tanımla ----------
-- Kullanıcı yetkisi ancak bundan sonra anlam kazanır.

insert into panel.firma_modulleri (firma_id, modul, aktif)
select f.id, 'ptp', true
  from panel.firmalar f
 where f.kisa_ad = 'squala'
on conflict (firma_id, modul) do update set aktif = true;


-- ---------- 4. Mağaza bölümleri ----------

insert into panel.ptp_bolumler (firma_id, ad, sira)
select f.id, b.ad, b.sira
  from panel.firmalar f
 cross join (values
   ('Mutfak', 1), ('Ön masa', 2), ('Halı standı', 3),
   ('Kahve fincanları masası', 4), ('Su bardakları masası', 5),
   ('Kasa', 6), ('Orta alan', 7), ('Arka alan', 8),
   ('Arka raflar', 9), ('Depo', 10)
 ) as b(ad, sira)
 where f.kisa_ad = 'squala'
on conflict (firma_id, ad) do nothing;


-- ---------- 5. Modül ayarları ----------

insert into panel.ptp_ayarlar (firma_id, magaza_adi)
select f.id, 'Squala Home' from panel.firmalar f where f.kisa_ad = 'squala'
on conflict (firma_id) do nothing;


-- ============================================================
-- 6. PERSONEL EKLEME — her kişi için tekrarlanır
--
-- Önce Authentication → Users → Add user ile hesap açılır, sonra
-- aşağıdaki iki blok o kişi için çalıştırılır.
--
-- ⚠️ Aşağısı ÖRNEKTİR; e-posta ve adı değiştirip çalıştırın.
--    Seviye seçenekleri:
--      'yazma'   → personel (kendine atanan görevleri kapatır)
--      'yonetim' → müdür (görev atar, rapor görür)
-- ============================================================

/*
-- 6a. Kişiyi firmaya bağla
insert into panel.kullanicilar (auth_id, firma_id, ad, eposta, rol)
select u.id, f.id, 'Ayşe Yılmaz', u.email, 'kullanici'
  from auth.users u
 cross join panel.firmalar f
 where u.email = 'ayse@ornek.com' and f.kisa_ad = 'squala'
on conflict (auth_id) do nothing;

-- 6b. PTP yetkisi ver
insert into panel.modul_yetkileri (kullanici_id, modul, seviye)
select k.id, 'ptp', 'yazma'
  from panel.kullanicilar k
 where k.eposta = 'ayse@ornek.com'
on conflict (kullanici_id, modul) do update set seviye = excluded.seviye;
*/


-- ============================================================
-- 7. ÖRNEK GÖREV ŞABLONLARI
--
-- Eski programdaki 27 şablonun bir kısmı. Temiz başlangıç kararı
-- gereği geçmiş görev kayıtları taşınmadı; şablonlar sistemin
-- denenebilmesi için yeniden yazıldı. Panelden düzenlenebilir.
-- ============================================================

insert into panel.ptp_sablonlar (firma_id, baslik, tur, grup, sira, zorunlu, ipucu)
select f.id, s.baslik, s.tur, s.grup, s.sira, s.zorunlu, s.ipucu
  from panel.firmalar f
 cross join (values
   ('Zemin kontrolü (süpürüldü / silindi mi?)', 'onay',  'acilis',  1, true,  ''),
   ('Aydınlatmalar açıldı mı?',                 'onay',  'acilis',  2, true,  ''),
   ('Kasa açılış sayımı',                       'sayi',  'acilis',  3, true,  'Kasadaki tutarı yazın'),
   ('Vitrin düzeni kontrol edildi mi?',         'onay',  'teshir',  1, true,  ''),
   ('Eksilen ürünler tamamlandı mı?',           'onay',  'teshir',  2, true,  ''),
   ('Hangi bölüm bugün düzenlendi?',            'bolge', 'teshir',  3, false, 'Bugün elden geçirilen bölümü seçin'),
   ('Müşteri şikâyeti / talebi var mı?',        'metin', 'musteri', 1, false, 'Yoksa "yok" yazın'),
   ('Depo düzeni kontrol edildi mi?',           'onay',  'depo',    1, false, ''),
   ('Gün sonu kasa sayımı',                     'sayi',  'kapanis', 1, true,  'Gün sonu kasadaki tutar'),
   ('Kapanış temizliği yapıldı mı?',            'onay',  'kapanis', 2, true,  '')
 ) as s(baslik, tur, grup, sira, zorunlu, ipucu)
 where f.kisa_ad = 'squala'
on conflict (firma_id, grup, baslik) where silindi is null do nothing;


-- ============================================================
-- 8. DOĞRULAMA — çalıştırdıktan sonra kontrol
-- ============================================================

select 'firmalar'        as tablo, count(*) from panel.firmalar
union all select 'kullanicilar',    count(*) from panel.kullanicilar
union all select 'firma_modulleri', count(*) from panel.firma_modulleri
union all select 'modul_yetkileri', count(*) from panel.modul_yetkileri
union all select 'ptp_bolumler',    count(*) from panel.ptp_bolumler
union all select 'ptp_sablonlar',   count(*) from panel.ptp_sablonlar;
