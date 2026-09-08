-- ============================================================
-- 15_  TELEGRAM ZAMANLAYICI
--
-- ⚠️ ÇALIŞTIRMADAN ÖNCE İKİ SATIRI DÜZENLE (aşağıda işaretli).
--
-- Bu iş panelin /api/telegram/zamanli ucunu beş dakikada bir çağırır.
-- Uç, saati gelen firmalara hatırlatma ve günlük özet gönderir.
--
-- Neden Vercel'in zamanlayıcısı değil: ücretsiz planda sık çalışan
-- zamanlanmış iş yok. Tetiği veri tabanı çekiyor.
--
-- Neden beş dakika: özet saati 22:00 yazıldığında mesajın 22:00 ile
-- 22:05 arasında gitmesi yeterli. Uç kendisi "bugün gönderildi mi"
-- damgasına bakıyor, sık çağrılması tekrar üretmiyor.
-- ============================================================


-- ---------- Düzenlenecek değerler ----------
-- 1. PANEL_ADRESI : panelin kendi adresi
-- 2. GIZLI_ANAHTAR: Vercel'deki CRON_GIZLI_ANAHTAR ile AYNI değer
--
-- Anahtar Vercel'de tanımlı değilse uç 503 döner ve hiçbir şey
-- gönderilmez — sessizce çalışıyor sanılmasın.

do $kur$
declare
  panel_adresi text := 'https://panel.karasteknoloji.com';
  gizli_anahtar text := 'BURAYA_CRON_GIZLI_ANAHTAR_YAZ';
begin
  if gizli_anahtar = 'BURAYA_CRON_GIZLI_ANAHTAR_YAZ' then
    raise exception 'Once gizli_anahtar degerini Vercel''deki CRON_GIZLI_ANAHTAR ile ayni yap';
  end if;

  /* Varsa eski iş kaldırılıyor: betik tekrar çalıştırılabilir olmalı. */
  begin
    perform cron.unschedule('ptp_telegram_zamanli');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'ptp_telegram_zamanli',
    '*/5 * * * *',
    format(
      $govde$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-anahtar', %L
        ),
        body := '{}'::jsonb
      );
      $govde$,
      panel_adresi || '/api/telegram/zamanli',
      gizli_anahtar
    )
  );

  raise notice 'ptp_telegram_zamanli kuruldu: 5 dakikada bir %', panel_adresi;
end
$kur$;


-- ---------- Doğrulama ----------

select jobid, schedule, jobname, active
  from cron.job
 where jobname = 'ptp_telegram_zamanli';

/* Son çalışmaları görmek için (birkaç dakika sonra):

   select status, return_message, start_time
     from cron.job_run_details
    where jobid = (select jobid from cron.job where jobname = 'ptp_telegram_zamanli')
    order by start_time desc
    limit 5;
*/
