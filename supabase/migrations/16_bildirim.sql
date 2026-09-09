-- ============================================================
-- 16_  BİLDİRİM ALTYAPISI
--
-- Telegram artık PTP'nin bir özelliği değil, PANELİN ALTYAPISI.
-- Her modül kendi olaylarını bildirebilir; yeni modül geldiğinde
-- şema değişmez, yalnızca koda olay kodu eklenir.
--
-- İKİ TABLO:
--
--   telegram_ayarlari    → bot bağlantısı, firma başına bir satır
--   bildirim_tercihleri  → hangi olay açık, zamanlı olanlar kaçta
--
-- Olay listesi TABLODA DEĞİL KODDA (lib/bildirim/katalog.ts). Sebep:
-- olayın adı, açıklaması ve nasıl üretildiği koda ait bilgi. Tabloda
-- tutulsaydı kod ile tablo ayrışır ve "bu olay ne yapıyordu"
-- sorusunun cevabı iki yere bölünürdü. Tabloda yalnızca KULLANICININ
-- kararı duruyor: açık mı, kaçta.
--
-- PTP'nin telegram kolonları buraya taşınıp KALDIRILIYOR. İki yerde
-- ayar tutmak, hangisinin geçerli olduğunu belirsizleştirir.
-- ============================================================


-- ---------- A. Bot bağlantısı ----------

create table if not exists panel.telegram_ayarlari (
  firma_id    uuid primary key references panel.firmalar(id) on delete cascade,
  aktif       boolean not null default false,
  -- Mesajların gideceği sohbet. Jeton BURADA DEĞİL: ortam
  -- değişkeninde. Veri tabanına yazılsaydı yedeklerde ve ekran
  -- görüntülerinde dolaşırdı.
  chat_id     text,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now()
);

create index if not exists telegram_ayarlari_chat
  on panel.telegram_ayarlari (chat_id)
  where chat_id is not null;

drop trigger if exists t_telegram_ayarlari_guncellendi on panel.telegram_ayarlari;
create trigger t_telegram_ayarlari_guncellendi before update on panel.telegram_ayarlari
  for each row execute function panel.guncellendi_yaz();


-- ---------- B. Olay tercihleri ----------

create table if not exists panel.bildirim_tercihleri (
  firma_id      uuid not null references panel.firmalar(id) on delete cascade,
  -- Modül önekli olay kodu: 'ptp.gunluk_ozet', 'otp.vade_ozeti'
  olay          text not null,
  acik          boolean not null default true,
  -- Zamanlı olaylarda gönderim saati; anlık olaylarda boş
  saat          time,
  -- Zamanlı olaylarda aynı gün ikinci kez gönderilmesini engeller
  son_gonderim  date,
  olusturuldu   timestamptz not null default now(),
  guncellendi   timestamptz not null default now(),
  primary key (firma_id, olay),
  constraint olay_kodu_bicimi check (olay ~ '^[a-z]+\.[a-z_]+$')
);

comment on table panel.bildirim_tercihleri is
  'Hangi olayda bildirim gonderilecek. Olay listesi kodda (lib/bildirim/katalog.ts); burada yalnizca kullanicinin karari durur.';

drop trigger if exists t_bildirim_tercihleri_guncellendi on panel.bildirim_tercihleri;
create trigger t_bildirim_tercihleri_guncellendi before update on panel.bildirim_tercihleri
  for each row execute function panel.guncellendi_yaz();


-- ---------- C. PTP ayarlarını taşı ----------

insert into panel.telegram_ayarlari (firma_id, aktif, chat_id)
select firma_id, telegram_aktif, telegram_chat_id
  from panel.ptp_ayarlar
 where telegram_chat_id is not null
on conflict (firma_id) do update
  set aktif = excluded.aktif,
      chat_id = coalesce(excluded.chat_id, panel.telegram_ayarlari.chat_id);

/* Anlık olay: görev kapanışı. Eski ayar korunuyor. */
insert into panel.bildirim_tercihleri (firma_id, olay, acik)
select firma_id, 'ptp.gorev_yapildi', coalesce(telegram_gorev_bildir, true)
  from panel.ptp_ayarlar
on conflict (firma_id, olay) do nothing;

/* Zamanlı olaylar: saatler korunuyor. */
insert into panel.bildirim_tercihleri (firma_id, olay, acik, saat, son_gonderim)
select firma_id, 'ptp.gunluk_ozet', true, gunluk_ozet_saati, ozet_gonderilen_gun
  from panel.ptp_ayarlar
on conflict (firma_id, olay) do nothing;

insert into panel.bildirim_tercihleri (firma_id, olay, acik, saat, son_gonderim)
select firma_id, 'ptp.kapanis_hatirlatma', true,
       kapanis_hatirlatma_saati, hatirlatma_gonderilen_gun
  from panel.ptp_ayarlar
on conflict (firma_id, olay) do nothing;

/* Yeni olaylar varsayılanlarıyla açılıyor. */
insert into panel.bildirim_tercihleri (firma_id, olay, acik, saat)
select f.id, o.olay, o.acik, o.saat
  from panel.firmalar f
 cross join (values
    ('ptp.gun_kapandi',      true,  null::time),
    ('ptp.eksik_bildirildi', true,  null),
    ('sistem.oturum_acildi', false, null),
    ('otp.vade_ozeti',       true,  '09:00'::time)
 ) as o(olay, acik, saat)
 where f.silindi is null
on conflict (firma_id, olay) do nothing;


-- ---------- D. PTP'deki eski kolonları kaldır ----------
-- Taşındılar. İki yerde ayar tutmak, hangisinin geçerli olduğunu
-- belirsizleştirir.

alter table panel.ptp_ayarlar
  drop column if exists telegram_aktif,
  drop column if exists telegram_chat_id,
  drop column if exists telegram_gorev_bildir,
  drop column if exists gunluk_ozet_saati,
  drop column if exists kapanis_hatirlatma_saati,
  drop column if exists ozet_gonderilen_gun,
  drop column if exists hatirlatma_gonderilen_gun;


-- ---------- E. RLS ----------
-- Bildirim ayarı yönetim işi. Okuma da yönetimde: chat id ve saatler
-- personeli ilgilendirmiyor.

alter table panel.telegram_ayarlari   enable row level security;
alter table panel.bildirim_tercihleri enable row level security;

do $kur$
declare t text;
begin
  foreach t in array array['telegram_ayarlari','bildirim_tercihleri']
  loop
    execute format('drop policy if exists %1$s_yonetim on panel.%1$s', t);
    execute format($p$
      create policy %1$s_yonetim on panel.%1$s for all
        using (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
        )
        with check (
          panel.superadmin_mi()
          or (firma_id = panel.aktif_firma() and panel.firma_yoneticisi_mi())
        )
    $p$, t);
  end loop;
end
$kur$;

grant select, insert, update, delete
  on panel.telegram_ayarlari, panel.bildirim_tercihleri
  to authenticated, service_role;

revoke all on panel.telegram_ayarlari, panel.bildirim_tercihleri from anon;


-- ---------- Doğrulama ----------

select f.kisa_ad, t.aktif, t.chat_id
  from panel.firmalar f
  left join panel.telegram_ayarlari t on t.firma_id = f.id
 where f.silindi is null;

select f.kisa_ad, b.olay, b.acik, b.saat
  from panel.bildirim_tercihleri b
  join panel.firmalar f on f.id = b.firma_id
 order by f.kisa_ad, b.olay;
