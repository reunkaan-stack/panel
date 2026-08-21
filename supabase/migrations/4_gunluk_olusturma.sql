-- ============================================================
-- 4_  GÜNLÜK GÖREV ÜRETİMİ — OTOMATİK
--
-- "Günü oluştur" düğmesine her sabah basılmamalı. Üretim her gün
-- 06:00'da (İstanbul) kendiliğinden çalışır.
--
-- İş mantığı SQL'e taşındı. Sebep: zamanlanmış iş kendi başına iş
-- mantığı yazmaz, var olan bir fonksiyonu çağırır. Aksi halde iki
-- ayrı üretim kodu olur ve biri diğerinden sapar.
-- ============================================================


-- ---------- Çekirdek: bir firma, bir gün ----------
-- SECURITY DEFINER: cron'un oturumu yoktur, RLS onu engellerdi.
-- Bu yüzden authenticated rolüne AÇILMIYOR; dışarıya açık olan
-- aşağıdaki sarmalayıcı.

create or replace function panel.ptp_gunu_uret(
  p_firma_id uuid,
  p_tarih date
)
returns integer
language plpgsql
security definer
set search_path = panel, public
as $$
declare
  v_gun     smallint;
  v_eklenen integer := 0;
begin
  /* Postgres'te isodow: 1 = Pazartesi … 7 = Pazar */
  v_gun := extract(isodow from p_tarih);

  with uygun as (
    select s.*
      from panel.ptp_sablonlar s
     where s.firma_id = p_firma_id
       and s.aktif
       and s.silindi is null
       and (
         s.tekrar = 'gunluk'
         or (s.tekrar = 'haftalik' and v_gun = any(s.tekrar_gunleri))
         or (s.tekrar = 'tek_seferlik' and s.tek_tarih = p_tarih)
       )
       /* Zaten üretilmişse atla — gün içinde tekrar çalışsa da
          görev ikiye katlanmaz. */
       and not exists (
         select 1 from panel.ptp_gorevler g
          where g.firma_id = p_firma_id
            and g.tarih = p_tarih
            and g.sablon_id = s.id
            and g.silindi is null
       )
  ),
  eklenen as (
    insert into panel.ptp_gorevler
      (firma_id, sablon_id, tarih, grup, baslik, tur,
       zorunlu, tekrarlanabilir, fotograf_ister, ipucu, kaynak)
    select p_firma_id, u.id, p_tarih, u.grup, u.baslik, u.tur,
           u.zorunlu, u.tekrarlanabilir, u.fotograf_ister, u.ipucu, 'sablon'
      from uygun u
    returning id, sablon_id
  ),
  /* Kontrol listesi maddeleri KOPYALANIR, referansla bağlanmaz:
     şablon sonradan değişse bile o günkü liste olduğu gibi kalsın.
     Geçmişe bakan yönetici o gün gerçekte ne işaretlendiğini görür. */
  maddeler as (
    insert into panel.ptp_gorev_maddeleri (firma_id, gorev_id, metin, sira)
    select p_firma_id, e.id, m.metin, m.sira
      from eklenen e
      join panel.ptp_sablon_maddeleri m on m.sablon_id = e.sablon_id
     where m.silindi is null
    returning 1
  )
  select count(*) into v_eklenen from eklenen;

  return v_eklenen;
end $$;


-- ---------- Panelden çağrılan sarmalayıcı ----------
-- SECURITY INVOKER: RLS geçerli, kullanıcı yalnızca kendi firması
-- için üretebilir. Yetki de burada denetleniyor.

create or replace function panel.ptp_gunumu_olustur(p_tarih date)
returns integer
language plpgsql
as $$
declare
  v_firma uuid;
begin
  if panel.modul_seviyesi('ptp') is distinct from 'yonetim' then
    raise exception 'Bu işlem için yetkiniz yok';
  end if;

  v_firma := panel.aktif_firma();

  /* Süperadminin firması yoktur; tek firma varsa o kullanılır. */
  if v_firma is null and panel.superadmin_mi() then
    select id into v_firma
      from panel.firmalar
     where aktif and silindi is null
     limit 2;

    if (select count(*) from panel.firmalar where aktif and silindi is null) <> 1 then
      raise exception 'Hangi firma adına çalışacağınız belirsiz';
    end if;
  end if;

  if v_firma is null then
    raise exception 'Firma bulunamadı';
  end if;

  return panel.ptp_gunu_uret(v_firma, p_tarih);
end $$;

grant execute on function panel.ptp_gunumu_olustur(date) to authenticated;


-- ---------- Cron: her firma için her gün ----------

create or replace function panel.ptp_gunluk_is()
returns void
language plpgsql
security definer
set search_path = panel, public
as $$
declare
  v_firma  record;
  v_tarih  date := (now() at time zone 'Europe/Istanbul')::date;
begin
  for v_firma in
    select f.id
      from panel.firmalar f
      join panel.firma_modulleri fm
        on fm.firma_id = f.id and fm.modul = 'ptp' and fm.aktif
     where f.aktif and f.silindi is null
       and (fm.bitis is null or fm.bitis >= v_tarih)
  loop
    perform panel.ptp_gunu_uret(v_firma.id, v_tarih);
  end loop;
end $$;


-- ---------- Zamanlama ----------
-- ⚠️ pg_cron UTC ile çalışır. 03:00 UTC = 06:00 İstanbul (yaz/kış
-- farkı Türkiye'de yok, kalıcı UTC+3). Mağaza açılmadan önce.

create extension if not exists pg_cron;

-- Aynı ad varsa önce kaldır: bu dosya tekrar çalıştırılabilir olsun.
select cron.unschedule('ptp-gunluk-gorev')
 where exists (select 1 from cron.job where jobname = 'ptp-gunluk-gorev');

select cron.schedule(
  'ptp-gunluk-gorev',
  '0 3 * * *',
  $$ select panel.ptp_gunluk_is(); $$
);


-- ---------- Doğrulama ----------

select jobname, schedule, active from cron.job where jobname = 'ptp-gunluk-gorev';
