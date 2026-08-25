-- ============================================================
-- 9_  KİŞİ YÖNETİMİ + YETKİ YÜKSELTME AÇIĞININ KAPATILMASI
--
-- Süperadmin panelden hesap açıp kapatacak. Tablolar zaten var;
-- burada eksik olan iki şey tamamlanıyor.
--
-- ⚠️ AÇIK: kullanicilar_guncelleme politikası `auth_id = auth.uid()`
-- diyerek herkesin KENDİ satırını güncellemesine izin veriyordu. Amaç
-- kişinin kendi adını düzeltebilmesiydi ama politika kolon ayrımı
-- yapmıyor: sıradan bir kullanıcı kendi satırında rol = 'superadmin'
-- ve firma_id = null yazarak bütün firmalara erişebilirdi. Kısıt bunu
-- engellemiyordu, çünkü o hâl kısıta uygun.
--
-- RLS politikaları kolon bazında yazılamadığı için denetim
-- tetikleyiciye alınıyor.
-- ============================================================


-- ---------- A. Yetki yükseltme engeli ----------

create or replace function panel.kullanici_degisimi_denetle() returns trigger
language plpgsql security definer set search_path = panel, public as $$
declare
  kendi boolean;
begin
  /* auth.uid() boşsa çağıran service_role'dur (hesap açma/kapatma
     işleri). RLS zaten atlanmış durumda; tetikleyicinin ayrıca
     engellemesi, yönetim işlerini anlaşılmaz biçimde kilitlerdi. */
  if auth.uid() is null then
    return new;
  end if;

  kendi := old.auth_id = auth.uid();

  /* Kimse kendi rolünü, firmasını ya da aktifliğini değiştiremez.
     Süperadmin dahil: kendini yanlışlıkla düşürmek geri dönüşü zor
     bir hata ve süperadminin böyle bir ihtiyacı yok. */
  if kendi then
    if new.rol is distinct from old.rol
       or new.firma_id is distinct from old.firma_id
       or new.aktif is distinct from old.aktif then
      raise exception 'Kendi rolunuzu, firmanizi veya durumunuzu degistiremezsiniz';
    end if;
    return new;
  end if;

  /* Başkasının satırı: süperadmin her şeyi yapabilir. */
  if panel.superadmin_mi() then
    return new;
  end if;

  /* Firma yöneticisi kendi firmasında değişiklik yapabilir ama
     kimseyi süperadmin yapamaz — o yetki firmanın üstünde. */
  if panel.firma_yoneticisi_mi() then
    if new.rol = 'superadmin' or old.rol = 'superadmin' then
      raise exception 'Superadmin yetkisi verilemez veya alinamaz';
    end if;
    return new;
  end if;

  raise exception 'Bu kaydi degistirme yetkiniz yok';
end;
$$;

drop trigger if exists t_kullanicilar_denetim on panel.kullanicilar;
create trigger t_kullanicilar_denetim before update on panel.kullanicilar
  for each row execute function panel.kullanici_degisimi_denetle();

comment on function panel.kullanici_degisimi_denetle is
  'Yetki yukseltmeyi engeller: kimse kendi rolunu/firmasini/aktifligini degistiremez.';


-- ---------- B. Modül yetkisi verme sınırı ----------
-- modul_yetkileri_yazma politikası firma yöneticisine kendi firmasında
-- yetki verme izni veriyor. Kişi kendine yetki YAZAMAMALI; yoksa
-- okuma yetkisi olan biri kendine yonetim yazabilir.

create or replace function panel.yetki_degisimi_denetle() returns trigger
language plpgsql security definer set search_path = panel, public as $$
declare
  hedef_auth uuid;
  hedef_id   uuid;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  hedef_id := case when tg_op = 'DELETE' then old.kullanici_id
                   else new.kullanici_id end;

  select k.auth_id into hedef_auth
    from panel.kullanicilar k
   where k.id = hedef_id;

  if hedef_auth = auth.uid() and not panel.superadmin_mi() then
    raise exception 'Kendi modul yetkinizi degistiremezsiniz';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists t_modul_yetkileri_denetim on panel.modul_yetkileri;
create trigger t_modul_yetkileri_denetim
  before insert or update or delete on panel.modul_yetkileri
  for each row execute function panel.yetki_degisimi_denetle();


-- ---------- C. Silme politikası ----------
-- kullanicilar tablosunda silme politikası hiç yoktu; RLS açık olduğu
-- için delete zaten reddediliyordu ama açıkça yazılıyor: süperadmin
-- yanlışlıkla açılmış bir hesabı kaldırabilmeli.

drop policy if exists kullanicilar_silme on panel.kullanicilar;
create policy kullanicilar_silme on panel.kullanicilar for delete
  using (panel.superadmin_mi());


-- ---------- D. E-posta benzersizliği ----------
-- auth tarafı zaten benzersiz tutuyor ama panel kaydında iki aynı
-- e-posta görünürse hangisinin gerçek olduğu belirsizleşir.

create unique index if not exists kullanicilar_eposta_benzersiz
  on panel.kullanicilar (lower(eposta))
  where silindi is null;


-- ---------- Doğrulama ----------

select k.ad, k.eposta, k.rol, k.aktif,
       coalesce(f.kisa_ad, '—') as firma,
       (select string_agg(my.modul || ':' || my.seviye, ', ')
          from panel.modul_yetkileri my
         where my.kullanici_id = k.id) as yetkiler
  from panel.kullanicilar k
  left join panel.firmalar f on f.id = k.firma_id
 where k.silindi is null
 order by k.rol, k.ad;
