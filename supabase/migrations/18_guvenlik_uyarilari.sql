-- ============================================================
-- 18_  SUPABASE GÜVENLİK LİNTER'I (splinter) UYARILARI
--
-- Supabase panelindeki "Security Advisor" 33 uyarı veriyordu.
-- Hata (error) yok; hepsi uyarı. Bu dosya ikisini kapatıyor:
--
--   1. Function Search Path Mutable
--      search_path sabitlenmemiş fonksiyonlar. Sabitlenmezse,
--      arama yolunda önce gelen bir şemaya nesne yaratabilen biri
--      fonksiyonun kullandığı tabloyu gölgeleyebilir. Bizde bu
--      kişi yok (authenticated rolünün CREATE yetkisi yok) ama
--      düzeltmesi bedava, bırakılmaz.
--
--   2. Public Can Execute SECURITY DEFINER Function
--      PostgreSQL'de fonksiyonlarda EXECUTE yetkisi VARSAYILAN
--      OLARAK public rolüne verilir. Yani hiçbir grant yazmasak
--      bile anon çağırabilir görünür.
--
--      Bizde erişilemiyor: `revoke all on schema panel from anon`
--      yüzünden anon şemanın kapısından giremiyor. Ayrıca bütün
--      bu fonksiyonlar auth.uid() üzerinden çalışıyor; oturumsuz
--      çağrıda null/false dönerler. Yine de tek savunmaya
--      güvenilmez — yetki de kapatılıyor.
--
-- KAPSAM DIŞI BIRAKILANLAR (bilerek):
--
--   · public.pg_net → "Extension in Public". Bu eklentiyi oraya
--     Supabase kuruyor ve zamanlanmış Telegram işleri onu
--     kullanıyor. Taşımak cron'u kırar, kazancı yok.
--
--   · kaan.* şemasındaki fonksiyonlar (guncellendi_yaz,
--     yonetici_mi). Bu şema NE panelde NE sitede tanımlı — iki
--     depoda da izi yok, elle ya da eski bir projeden kalmış.
--     Sahibi bilinmeyen nesne körlemesine değiştirilmez.
--     Dosyanın sonundaki sorgu ne olduğunu gösteriyor.
-- ============================================================


-- ---------- 1. search_path sabitleme ----------
-- Tek tek yazmak yerine dönülüyor: imzayı elle yazarken bir
-- parametre tipini kaçırmak sessizce yanlış fonksiyonu bırakır.
-- Zaten sabitlenmiş olanlara dokunulmuyor.

do $$
declare
  f record;
  sayac int := 0;
begin
  for f in
    select p.oid::regprocedure as imza
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'panel'
       and not exists (
         select 1
           from unnest(coalesce(p.proconfig, '{}')) c
          where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = panel, public', f.imza);
    sayac := sayac + 1;
  end loop;

  raise notice 'search_path sabitlenen fonksiyon: %', sayac;
end $$;


-- ---------- 2. public rolünden EXECUTE alınması ----------
-- DİKKAT: önce revoke, sonra grant. Sırf revoke yapılırsa panelin
-- tamamı çöker — RLS kuralları bu fonksiyonları sorguyu çalıştıran
-- kullanıcının hakkıyla çağırıyor, yani authenticated'ın EXECUTE
-- yetkisi ŞART.

do $$
declare
  f record;
  sayac int := 0;
begin
  for f in
    select p.oid::regprocedure as imza
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'panel'
       and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public', f.imza);
    execute format('grant execute on function %s to authenticated, service_role', f.imza);
    sayac := sayac + 1;
  end loop;

  raise notice 'EXECUTE yetkisi daraltilan fonksiyon: %', sayac;
end $$;

-- Bundan sonra yaratılacak fonksiyonlar da aynı davransın:
-- varsayılan yetkiden public çıkarılıyor.
alter default privileges in schema panel
  revoke execute on functions from public;


-- ---------- Doğrulama ----------

-- a) search_path'i hâlâ sabitlenmemiş panel fonksiyonu kalmamalı
select 'search_path eksik' as sorun, p.oid::regprocedure as fonksiyon
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'panel'
   and not exists (
     select 1 from unnest(coalesce(p.proconfig, '{}')) c
      where c like 'search_path=%'
   );

-- b) public rolünde EXECUTE kalan panel fonksiyonu olmamalı
select 'public execute' as sorun, p.oid::regprocedure as fonksiyon
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'panel'
   and has_function_privilege('public', p.oid, 'execute');

-- c) authenticated hepsini çağırabilmeli — burası BOŞ ÇIKMAMALI,
--    tam tersine bütün fonksiyonları listelemeli
select count(*) as authenticated_cagirabildigi
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'panel'
   and has_function_privilege('authenticated', p.oid, 'execute');

-- d) kaan şeması nedir: hangi nesneler var, kim erişebiliyor
select n.nspname as sema,
       p.proname as fonksiyon,
       p.prosecdef as security_definer,
       has_function_privilege('anon', p.oid, 'execute') as anon_cagirabilir
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'kaan';

select has_schema_privilege('anon', 'kaan', 'usage') as anon_kaan_semasina_girebilir;
