-- ============================================================
-- 3_  PERFORMANS RAPORLARI
--
-- Toplama işi veri tabanında yapılıyor, uygulamada değil. Sebep:
-- Supabase istek başına 1000 satır döndürüyor; 90 günlük ham görev
-- verisi (günde ~23 görev) bunu aşar ve rapor sessizce eksik çıkar.
--
-- Fonksiyonlar SECURITY INVOKER (varsayılan) — RLS geçerli kalır,
-- yani bir firma diğerinin verisini toplayamaz. Bu yüzden bilinçli
-- olarak `security definer` YAZILMADI.
-- ============================================================


-- ---------- Kişi performansı ----------
-- Kime kaç görev atandı, kaçını yaptı, kaçını atladı.
-- Tekrarlanabilir görevlerin tekrarları ayrıca sayılıyor.

create or replace function panel.ptp_kisi_performansi(
  p_baslangic date,
  p_bitis date
)
returns table (
  kullanici_id   uuid,
  ad             text,
  atanan         bigint,
  tamamlanan     bigint,
  atlanan        bigint,
  bekleyen       bigint,
  tekrar_sayisi  bigint,
  ort_saat       numeric
)
language sql stable as $$
  with gorev as (
    select g.*
      from panel.ptp_gorevler g
     where g.tarih between p_baslangic and p_bitis
       and g.silindi is null
  )
  select k.id,
         k.ad,
         count(*) filter (where a.atanan_id = k.id)                    as atanan,
         count(*) filter (where t.tamamlayan_id = k.id
                            and t.durum = 'tamamlandi')                as tamamlanan,
         count(*) filter (where t.tamamlayan_id = k.id
                            and t.durum = 'atlandi')                   as atlanan,
         count(*) filter (where a.atanan_id = k.id
                            and a.durum = 'bekliyor')                  as bekleyen,
         coalesce((
           select count(*) from panel.ptp_gorev_kayitlari kay
            join panel.ptp_gorevler g2 on g2.id = kay.gorev_id
           where kay.yapan_id = k.id
             and g2.tarih between p_baslangic and p_bitis
         ), 0)                                                          as tekrar_sayisi,
         round(avg(
           extract(hour from t.tamamlanma_zamani at time zone 'Europe/Istanbul')
           + extract(minute from t.tamamlanma_zamani at time zone 'Europe/Istanbul') / 60.0
         ) filter (where t.tamamlayan_id = k.id and t.durum = 'tamamlandi'), 2)
                                                                        as ort_saat
    from panel.kullanicilar k
    left join gorev a on a.atanan_id = k.id
    left join gorev t on t.tamamlayan_id = k.id
   where k.silindi is null
   group by k.id, k.ad
  having count(*) filter (where a.atanan_id = k.id) > 0
      or count(*) filter (where t.tamamlayan_id = k.id) > 0
   order by tamamlanan desc, k.ad;
$$;


-- ---------- Görev performansı ----------
-- Hangi görev ne sıklıkla yapılıyor, ne sıklıkla atlanıyor.
-- "En çok atlanan" listesi yöneticinin ilk bakacağı yer.

create or replace function panel.ptp_gorev_performansi(
  p_baslangic date,
  p_bitis date
)
returns table (
  baslik       text,
  grup         text,
  zorunlu      boolean,
  toplam       bigint,
  tamamlanan   bigint,
  atlanan      bigint,
  bekleyen     bigint,
  oran         numeric
)
language sql stable as $$
  select g.baslik,
         g.grup,
         bool_or(g.zorunlu)                                  as zorunlu,
         count(*)                                            as toplam,
         count(*) filter (where g.durum = 'tamamlandi')       as tamamlanan,
         count(*) filter (where g.durum = 'atlandi')          as atlanan,
         count(*) filter (where g.durum = 'bekliyor')         as bekleyen,
         round(
           100.0 * count(*) filter (where g.durum = 'tamamlandi')
           / nullif(count(*), 0), 0
         )                                                    as oran
    from panel.ptp_gorevler g
   where g.tarih between p_baslangic and p_bitis
     and g.silindi is null
   group by g.baslik, g.grup
   order by atlanan desc, oran asc, g.baslik;
$$;


-- ---------- Gün özeti ----------
-- Günlük tamamlanma yüzdesi; eğilimi görmek için.

create or replace function panel.ptp_gun_ozeti(
  p_baslangic date,
  p_bitis date
)
returns table (
  tarih       date,
  toplam      bigint,
  tamamlanan  bigint,
  atlanan     bigint,
  oran        numeric
)
language sql stable as $$
  select g.tarih,
         count(*)                                       as toplam,
         count(*) filter (where g.durum = 'tamamlandi')  as tamamlanan,
         count(*) filter (where g.durum = 'atlandi')     as atlanan,
         round(
           100.0 * count(*) filter (where g.durum = 'tamamlandi')
           / nullif(count(*), 0), 0
         )                                               as oran
    from panel.ptp_gorevler g
   where g.tarih between p_baslangic and p_bitis
     and g.silindi is null
   group by g.tarih
   order by g.tarih desc;
$$;


-- ---------- Atlanan görevler ve sebepleri ----------
-- Sayı değil, ne yazıldığı önemli: "malzeme yoktu", "vakit olmadı".

create or replace function panel.ptp_atlananlar(
  p_baslangic date,
  p_bitis date
)
returns table (
  tarih          date,
  baslik         text,
  sebep          text,
  kisi           text,
  zaman          timestamptz
)
language sql stable as $$
  select g.tarih,
         g.baslik,
         g.atlama_sebebi,
         k.ad,
         g.tamamlanma_zamani
    from panel.ptp_gorevler g
    left join panel.kullanicilar k on k.id = g.tamamlayan_id
   where g.tarih between p_baslangic and p_bitis
     and g.durum = 'atlandi'
     and g.silindi is null
   order by g.tarih desc, g.baslik;
$$;


grant execute on function
  panel.ptp_kisi_performansi(date, date),
  panel.ptp_gorev_performansi(date, date),
  panel.ptp_gun_ozeti(date, date),
  panel.ptp_atlananlar(date, date)
  to authenticated, service_role;


-- ---------- Doğrulama ----------

select * from panel.ptp_gun_ozeti(current_date - 30, current_date);
