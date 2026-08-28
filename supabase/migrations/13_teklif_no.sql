-- ============================================================
-- 13_  TEKLİF NUMARASI 173'TEN BAŞLASIN
--
-- İki değişiklik:
--
-- 1. BAŞLANGIÇ. Numaranın 001'den başlaması yeni kurulmuş bir firma
--    izlenimi veriyor. Sayaç 173'ten başlıyor.
--
-- 2. YIL BAŞINDA SIFIRLANMIYOR. Önceki hâlde sayaç yıla göre
--    hesaplanıyordu; 1 Ocak'ta tekrar 001'e düşerdi ve aynı sorun
--    geri gelirdi. Artık en büyük numara YILDAN BAĞIMSIZ okunuyor:
--    2026-180'den sonra 2027-181 gelir.
--
-- Silinen teklifin numarası da sayılıyor — numara tekrar kullanılmaz.
-- İki müşteride aynı teklif numarası görünmesi, sonradan hangisinin
-- hangisi olduğunu belirsizleştirir.
-- ============================================================


-- ---------- A. Sayaç ----------

create or replace function panel.teklif_yeni_no() returns text
language sql stable security definer set search_path = panel, public as $$
  select to_char(current_date, 'YYYY') || '-' ||
         lpad((greatest(coalesce(max(sira), 0), 172) + 1)::text, 3, '0')
    from (
      select split_part(no, '-', 2)::int as sira
        from panel.teklifler
       where split_part(no, '-', 2) ~ '^[0-9]+$'
    ) mevcut
$$;

comment on function panel.teklif_yeni_no is
  'Siradaki teklif numarasi. 173ten baslar, yil basinda sifirlanmaz.';


-- ---------- B. Var olan teklifleri yeniden numarala ----------
-- Şimdiye kadar açılmış teklifler 001, 002 diye numaralanmıştı.
-- Onlar da 173'ten başlayacak şekilde, açılış sırasına göre yeniden
-- yazılıyor.

do $yeniden$
declare
  k record;
  sayac int := 172;
begin
  for k in
    select id, no, olusturuldu
      from panel.teklifler
     where split_part(no, '-', 2) ~ '^[0-9]+$'
       and split_part(no, '-', 2)::int <= 172
     order by olusturuldu
  loop
    sayac := sayac + 1;
    update panel.teklifler
       set no = split_part(k.no, '-', 1) || '-' || lpad(sayac::text, 3, '0')
     where id = k.id;
  end loop;

  if sayac > 172 then
    raise notice '% teklif yeniden numaralandi (173ten itibaren)', sayac - 172;
  end if;
end
$yeniden$;


-- ---------- Doğrulama ----------

select panel.teklif_yeni_no() as siradaki_no;

select no, musteri_firma, musteri_ad, olusturuldu::date as tarih
  from panel.teklifler
 where silindi is null
 order by no;
