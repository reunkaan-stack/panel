-- ============================================================
-- 22_  DENETİM KAYITLARI ÇALIŞIR HALE GELİYOR + SİSTEM HATASI
--
-- ⚠️ BULGU: denetim_kayitlari tablosu BOŞ.
--
-- Tabloda RLS açık ve yalnızca bir SELECT politikası var. INSERT
-- politikası hiç yazılmamış; yorumda "yazma yalnızca service_role"
-- deniyor ama koddaki 11 yazma yerinin hepsi normal oturum
-- istemcisini kullanıyor. RLS bunları sessizce reddediyor —
-- Postgres hata döndürmüyor, sadece satır yazılmıyor. Kodda da
-- hiçbiri dönen hatayı kontrol etmiyor.
--
-- Yani aylardır "kim neyi değiştirdi" kaydı hiç tutulmadı.
-- Bugünkü son_giris hatasının aynısı: RLS sessizce sıfır satır.
--
-- ÇÖZÜM: yazma bir SECURITY DEFINER işlevine alınıyor.
--
--   · Yazma her zaman başarılı olur (RLS atlanır).
--   · Kim yazdığı İSTEMCİDEN ALINMAZ, auth.uid() üzerinden türetilir
--     — kullanıcı başkasının adına kayıt düşemez.
--   · Tek yazma noktası: biçim bir yerde durur.
--
-- INSERT politikası açmak da olurdu ama o zaman kullanıcı kendi
-- adına istediği metni yazabilirdi; denetim kaydının değeri tam da
-- yazanın seçemediği alanlardan geliyor.
-- ============================================================


-- ---------- A. Yazma işlevi ----------

create or replace function panel.denetim_yaz(
  p_eylem       text,
  p_hedef_tablo text default null,
  p_hedef_id    uuid default null,
  p_ayrinti     jsonb default null,
  -- Süperadmin başka firma adına işlem yapabiliyor; o durumda hangi
  -- firmanın kaydı olduğu dışarıdan gelir. Süperadmin değilse yok
  -- sayılır ve oturumun firması yazılır.
  p_firma_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = panel, public
as $$
declare
  v_kullanici uuid;
  v_firma     uuid;
  v_id        uuid;
begin
  v_kullanici := panel.aktif_kullanici_id();

  if p_firma_id is not null and panel.superadmin_mi() then
    v_firma := p_firma_id;
  else
    v_firma := panel.aktif_firma();
  end if;

  insert into panel.denetim_kayitlari
    (kullanici_id, firma_id, eylem, hedef_tablo, hedef_id, ayrinti)
  values
    (v_kullanici, v_firma, p_eylem, p_hedef_tablo, p_hedef_id, p_ayrinti)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function panel.denetim_yaz(text, text, uuid, jsonb, uuid) is
  'Denetim kaydi yazar. Kim yazdigi auth.uid() uzerinden turetilir, istemciden alinmaz.';

revoke execute on function panel.denetim_yaz(text, text, uuid, jsonb, uuid) from public;
grant execute on function panel.denetim_yaz(text, text, uuid, jsonb, uuid)
  to authenticated, service_role;


-- ---------- B. Sistem hatası da bir denetim kaydıdır ----------
-- Ayrı tablo açılmadı: "ne oldu" sorusunun cevabı tek yerde dursun.
-- Hata kayıtları eylem = 'sistem_hatasi' ile ayrılıyor.
--
-- Oturumsuz bağlamda da (cron, webhook) yazılabilmeli; o durumda
-- aktif_kullanici_id() null döner ve kayıt kullanıcısız düşer.

create index if not exists denetim_eylem_tarih
  on panel.denetim_kayitlari (eylem, olusturuldu desc);


-- ---------- C. Okuma politikası genişletiliyor ----------
-- Mevcut politika firma yöneticisine kendi firmasının kayıtlarını
-- açıyor. Sistem hatalarının firma_id'si çoğu zaman null olacak
-- (cron, webhook, oturumsuz iş); bunlar yalnızca süperadminde
-- görünsün — firma yöneticisinin altyapı hatasıyla işi yok.

drop policy if exists denetim_okuma on panel.denetim_kayitlari;

create policy denetim_okuma on panel.denetim_kayitlari for select
  using (
    panel.superadmin_mi()
    or (
      firma_id is not null
      and firma_id = panel.aktif_firma()
      and panel.firma_yoneticisi_mi()
      and eylem <> 'sistem_hatasi'
    )
  );


-- ---------- D. Bildirim olayı ----------
-- YAPILACAK BİR ŞEY YOK. bildirim_tercihleri üzerindeki
-- olay_kodu_bicimi kısıtı olay LİSTESİ tutmuyor, yalnızca biçim
-- denetliyor: '^[a-z]+.[a-z_]+$'. 'sistem.hata' bu biçime zaten
-- uyuyor. Olay listesinin tek kaynağı kod: lib/bildirim/katalog.ts


-- ---------- Doğrulama ----------

-- a) İşlev yerinde ve çağrılabilir mi
select has_function_privilege('authenticated',
         'panel.denetim_yaz(text,text,uuid,jsonb,uuid)', 'execute') as authenticated,
       has_function_privilege('public',
         'panel.denetim_yaz(text,text,uuid,jsonb,uuid)', 'execute') as public_rolu;

-- b) Şu anki kayıt sayısı — düzeltmeden ÖNCE büyük ihtimalle 0
select count(*) as mevcut_denetim_kaydi from panel.denetim_kayitlari;

-- c) Eylem dağılımı; kod yayına çıkıp birkaç işlem yapıldıktan sonra
--    burada satır görünmeye başlamalı
select eylem, count(*) as adet, max(olusturuldu) as son
  from panel.denetim_kayitlari
 group by eylem
 order by son desc nulls last;
