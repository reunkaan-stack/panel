-- ============================================================
-- 7_  GÜNLÜK CİRO
--
-- Personel akşam mağazanın gün sonu cirosunu yazar; yönetici takip
-- eder. Bir sonraki aşama prim: ciroya bağlı prim hesabı bu tablonun
-- üzerine kurulacak.
--
-- Neden ayrı tablo, neden kayıt defteri yetmiyor:
--   Ciro para. Aylık toplam, günlük ortalama, geçen ayla karşılaştırma
--   sorulacak sorular. Bunlar ptp_kayitlar.deger_sayi üzerinden de
--   çekilebilirdi ama o kolon her sayı görevinin ortak çöplüğü —
--   "paketleme malzemesi 12" ile "ciro 12500" aynı kolonda durur ve
--   raporun her sorgusu görev türüne göre süzmek zorunda kalırdı.
--
--   Ayrı tablo ayrıca GÜNDE BİR kısıtını veri tabanına yazdırıyor:
--   aynı güne iki ciro girilemez. Kayıt defterinde böyle bir kısıt
--   kurulamazdı, çünkü orada tekrarlı kayıt meşru.
-- ============================================================


-- ---------- A. Tablo ----------

create table if not exists panel.ptp_cirolar (
  id           uuid primary key default gen_random_uuid(),
  firma_id     uuid not null references panel.firmalar(id) on delete cascade,

  tarih        date not null,
  tutar        numeric(14,2) not null check (tutar >= 0),
  -- Fiş sayısı isteğe bağlı; girilirse sepet ortalaması hesaplanabilir
  fis_sayisi   integer check (fis_sayisi >= 0),
  not_metni    text not null default '',

  giren_id     uuid references panel.kullanicilar(id) on delete set null,
  -- Görevden geldiyse izi kalsın (eksiklerdeki mantığın aynısı)
  gorev_id     uuid references panel.ptp_gorevler(id) on delete set null,
  kayit_id     uuid references panel.ptp_kayitlar(id) on delete set null,

  olusturuldu  timestamptz not null default now(),
  guncellendi  timestamptz not null default now(),
  silindi      timestamptz
);

/* Bir güne bir ciro. Kısmi indeks: yumuşak silinen satır yer tutmasın,
   yanlış girilen bir gün silinip yeniden girilebilsin. */
create unique index if not exists ptp_cirolar_gun_benzersiz
  on panel.ptp_cirolar (firma_id, tarih)
  where silindi is null;

comment on table panel.ptp_cirolar is
  'Mağazanın gün sonu cirosu. Günde bir satır. Prim hesabı buna dayanır.';

drop trigger if exists t_ptp_cirolar_guncellendi on panel.ptp_cirolar;
create trigger t_ptp_cirolar_guncellendi before update on panel.ptp_cirolar
  for each row execute function panel.guncellendi_yaz();


-- ---------- B. Oturumdaki kullanıcının kimliği ----------
-- RLS içinde "bu satırı ben mi girdim" sorusu için gerekiyor.
-- Şimdiye kadar her yerde auth_id ile alt sorgu yazılıyordu; tek yere
-- alındı ki ileride değişirse tek yer değişsin.

create or replace function panel.aktif_kullanici_id() returns uuid
language sql stable security definer set search_path = panel, public as $$
  select id from panel.kullanicilar
   where auth_id = auth.uid() and aktif and silindi is null
$$;

comment on function panel.aktif_kullanici_id is
  'Oturumdaki kullanicinin panel.kullanicilar.id degeri.';


-- ---------- C. RLS ----------
-- Ciro para; personelin bütün ayı görmesi gerekmiyor. Personel
-- yalnızca KENDİ girdiği satırı okur — yazdığını görebilsin diye.
-- Aylık tablo ve karşılaştırmalar yöneticiye açık.

alter table panel.ptp_cirolar enable row level security;

drop policy if exists ptp_cirolar_okuma on panel.ptp_cirolar;
create policy ptp_cirolar_okuma on panel.ptp_cirolar for select
  using (
    panel.superadmin_mi()
    or (
      firma_id = panel.aktif_firma()
      and (
        panel.modul_seviyesi('ptp') = 'yonetim'
        or giren_id = panel.aktif_kullanici_id()
      )
    )
  );

drop policy if exists ptp_cirolar_ekleme on panel.ptp_cirolar;
create policy ptp_cirolar_ekleme on panel.ptp_cirolar for insert
  with check (
    panel.superadmin_mi()
    or (
      firma_id = panel.aktif_firma()
      and panel.modul_seviyesi('ptp') in ('yazma','yonetim')
    )
  );

/* Düzeltme yalnızca yöneticide. Personel yanlış yazdıysa kendisi
   değiştiremez — para rakamının sessizce değişmemesi gerekiyor,
   değişiklik denetim kaydına düşüyor. */
drop policy if exists ptp_cirolar_guncelleme on panel.ptp_cirolar;
create policy ptp_cirolar_guncelleme on panel.ptp_cirolar for update
  using (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  )
  with check (
    panel.superadmin_mi()
    or (firma_id = panel.aktif_firma() and panel.modul_seviyesi('ptp') = 'yonetim')
  );

drop policy if exists ptp_cirolar_silme on panel.ptp_cirolar;
create policy ptp_cirolar_silme on panel.ptp_cirolar for delete
  using (panel.superadmin_mi());

grant select, insert, update, delete on panel.ptp_cirolar
  to authenticated, service_role;
revoke all on panel.ptp_cirolar from anon;


-- ---------- D. Yeni görev türü: ciro ----------

alter table panel.ptp_gorevler drop constraint if exists ptp_gorevler_tur_check;

alter table panel.ptp_gorevler
  add constraint ptp_gorevler_tur_check
  check (tur in ('onay','kontrol','bolge','metin','sayi','eksik','ciro'));

/* Ciro günde bir kez girilir; tekrarlanabilir işaretlenirse ikinci
   kayıt benzersizlik indeksine çarpar ve anlaşılmaz bir hata verirdi.
   Kısıt bunu baştan engelliyor. */
alter table panel.ptp_gorevler drop constraint if exists gorev_ciro_tekrarsiz;
alter table panel.ptp_gorevler
  add constraint gorev_ciro_tekrarsiz
  check (tur <> 'ciro' or tekrarlanabilir = false);


-- ---------- E. Squala Home'a akşam ciro görevi ----------

insert into panel.ptp_gorevler
  (firma_id, baslik, tur, grup, sira, zorunlu, tekrarlanabilir,
   tekrar, tekrar_gunleri, ipucu, aktif)
select f.id, 'Gün sonu cirosu', 'ciro', 'kapanis', 3, true, false,
       'gunluk', '{}', 'Kasa raporundaki gün sonu toplamını yazın.', true
  from panel.firmalar f
 where f.kisa_ad = 'squala'
on conflict (firma_id, grup, baslik) where silindi is null do nothing;


-- ---------- Doğrulama ----------

select 'gorev' as ne, tur, count(*)
  from panel.ptp_gorevler
 where silindi is null
 group by tur
union all
select 'ciro kaydi', '', count(*) from panel.ptp_cirolar;
