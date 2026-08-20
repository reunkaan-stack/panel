# 01 — Veri tabanı kuralları

> **Tablo veya sorgu yazmadan önce her seferinde okunur.**
> Buradaki kuralların çoğu sonradan uygulanamaz; ilk tablodan itibaren
> geçerlidir.

Varsayılan yığın: **Postgres (Supabase)**. Başka bir veri tabanı
kullanılacaksa bu belge önce uyarlanır.

---

## 1. Adlandırma

| Kural | Örnek |
|---|---|
| Türkçe, `snake_case`, Türkçe karaktersiz | `odeme_planlari` |
| Tablo çoğul, sütun tekil | `gorevler` tablosunda `baslik` |
| Modüle özel tablolar modül önekiyle | `ptp_gorevler`, `otp_cekler` |
| Ortak tablolar öneksiz | `firmalar`, `kullanicilar` |
| Yabancı anahtar: hedef tablonun tekili + `_id` | `firma_id`, `sablon_id` |
| Boolean sütunlar sıfat gibi | `aktif`, `silindi`, `zorunlu` |
| Tarih sütunları geçmiş zaman | `olusturuldu`, `tamamlandi` |

---

## 2. Her tabloda bulunan sütunlar

```sql
id           uuid primary key default gen_random_uuid()
firma_id     uuid not null references firmalar(id) on delete cascade
olusturuldu  timestamptz not null default now()
guncellendi  timestamptz not null default now()
olusturan    uuid references kullanicilar(id)
silindi      timestamptz            -- yumuşak silme
```

**`id` neden `uuid`:** sıralı sayı kullanılırsa adres çubuğundaki `42`'yi
`43` yapan biri başka kaydın varlığını öğrenir. Çok firmalı bir sistemde
bu, rakip firmanın kaç kaydı olduğunu saymak demektir.

**`timestamptz`, asla `timestamp`:** saat dilimi bilgisi olmayan zaman
damgası, sunucu bölgesi değiştiğinde sessizce kayar.

**`guncellendi` tetikleyiciyle güncellenir**, uygulama koduna bırakılmaz:

```sql
create or replace function guncellendi_yaz() returns trigger
language plpgsql as $$
begin
  new.guncellendi = now();
  return new;
end $$;

create trigger t_guncellendi before update on <tablo>
  for each row execute function guncellendi_yaz();
```

---

## 3. Çok firmalılık — değişmez kural

> **Firma verisi taşıyan her tablonun `firma_id` sütunu ve RLS
> politikası vardır. İstisna yoktur.**

Bunu üç modül yazıldıktan sonra eklemek pratikte imkânsızdır: her sorgu,
her ekran ve her migration yeniden gözden geçirilir. İlk tablodan
itibaren uygulanır.

### Rol modeli

| Rol | Görür |
|---|---|
| `superadmin` | Bütün firmalar. Firma açar, kapatır, modül yetkisi verir. |
| `firma_yoneticisi` | Yalnızca kendi firması. Kendi kullanıcılarını yönetir. |
| `kullanici` | Kendi firmasında, yalnızca yetkili modüller. |

Süperadmin bir firma değildir; firmaların üstünde duran platform
katmanıdır.

### RLS yardımcı fonksiyonları

Politikalar elle yazılmaz, iki fonksiyon üzerinden kurulur:

```sql
create or replace function aktif_firma() returns uuid
language sql stable security definer set search_path = public as $$
  select firma_id from kullanicilar where auth_id = auth.uid()
$$;

create or replace function superadmin_mi() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'superadmin' from kullanicilar where auth_id = auth.uid()),
    false)
$$;
```

`security definer` **ve** `set search_path = public` birlikte yazılır.
`search_path` verilmezse bu fonksiyonlar yetki yükseltme aracına dönüşür.

### Standart politika seti

Her tablo için dört politika yazılır. Eksik bırakılan işlem Postgres
tarafından reddedilir — bu bize yarar, ama bilerek yapılmalıdır.

```sql
alter table ptp_gorevler enable row level security;

create policy "gorevler_okuma" on ptp_gorevler for select
  using (firma_id = aktif_firma() or superadmin_mi());

create policy "gorevler_ekleme" on ptp_gorevler for insert
  with check (firma_id = aktif_firma() or superadmin_mi());

create policy "gorevler_guncelleme" on ptp_gorevler for update
  using (firma_id = aktif_firma() or superadmin_mi())
  with check (firma_id = aktif_firma() or superadmin_mi());

create policy "gorevler_silme" on ptp_gorevler for delete
  using (superadmin_mi());   -- normal kullanıcı gerçekten silemez
```

**`update` politikasında hem `using` hem `with check` yazılır.** Yalnızca
`using` yazılırsa kullanıcı kendi kaydının `firma_id`'sini başka firmaya
çevirebilir.

---

## 4. Görünümler — yaşanmış tuzak

> **Yeni bir `view` eklenirken iki adım zorunludur:**

```sql
create view firma_ozeti with (security_invoker = on) as ...;
revoke all on firma_ozeti from anon;
```

Postgres'te görünümler varsayılan olarak *oluşturanın* yetkisiyle çalışır
ve altındaki tablonun RLS kurallarını **atlar**. Kardeş projede bu bir kez
yaşandı: anon anahtarıyla müşteri adı, firma ve telefon numarası
okunabiliyordu. Çok firmalı bir sistemde aynı hata, bir müşterinin bütün
diğer müşterileri görmesi demektir.

Aynı kural `security definer` fonksiyonlar için de geçerlidir.

---

## 5. Silme

**Kayıt silinmez, işaretlenir.** `silindi timestamptz` doldurulur ve
sorgular `where silindi is null` ile filtreler.

Sebep: müşteri "yanlış sildim" dediğinde geri dönüş olsun. Gerçek silme
yalnızca KVKK talebiyle yapılır ve `denetim_kayitlari`'na yazılır.

Kolaylık için görünüm tanımlanabilir — yukarıdaki `security_invoker`
kuralıyla birlikte.

---

## 6. Veri türleri

| İhtiyaç | Tür | Neden |
|---|---|---|
| Para | `numeric(14,2)` | `float`/`real` **asla** — 0.1 + 0.2 ≠ 0.3, kuruş kaybolur |
| Yüzde, oran | `numeric(6,3)` | Aynı sebep |
| Zaman damgası | `timestamptz` | Saat dilimi kayması olmasın |
| Yalnızca tarih | `date` | Günlük kayıt, vardiya, rapor günü |
| Saat (günden bağımsız) | `time` | "Her gün 21:30" gibi ayarlar |
| Kısa metin | `text` | Postgres'te `varchar(n)` performans getirmez; sınır gerekiyorsa `check` yaz |
| Sabit liste | `text` + `check` | `enum` türü değiştirmesi zordur; `check` migration ile kolay genişler |
| Yapısal esnek veri | `jsonb` | Yalnızca gerçekten şemasızsa; sorgulanacak alan sütun olur |

### Sabit liste deseni

```sql
durum text not null default 'bekliyor'
  check (durum in ('bekliyor','tamamlandi','atlandi','iptal'))
```

`enum` kullanılmaz: değer eklemek `alter type` gerektirir ve geri alması
zordur. `check` kısıtı migration ile bir satırda güncellenir.

---

## 7. İndeksler

Şu üç durumda indeks açılır, fazlası açılmaz:

1. **Her yabancı anahtar** — `firma_id` dahil. Postgres bunu otomatik
   yapmaz ve indekssiz `join` büyüdükçe çöker.
2. **Sık filtrelenen sütun bileşimi** — `(firma_id, tarih)` gibi.
3. **Benzersizlik gereken yer** — `unique` kısıtı zaten indeks açar.

```sql
create index ptp_gorevler_firma_tarih on ptp_gorevler (firma_id, tarih);
```

Çok firmalı sistemde **`firma_id` neredeyse her indeksin ilk sütunudur**,
çünkü her sorgu onunla filtrelenir.

İndeks bedavaya gelmez: her yazma işlemini yavaşlatır. "Belki lazım olur"
diye açılmaz.

---

## 8. Şema değişikliği

**Şema panelden elle değiştirilmez.** `supabase/migrations/` altına
tarihli SQL dosyası yazılır ve depoya işlenir.

```
supabase/migrations/
  20260820_1200_ilk_kurulum.sql
  20260821_0930_ptp_gorevler.sql
```

Sebep: yerel, önizleme ve canlının aynı şemada olduğundan emin olmanın
başka yolu yok. Panelden yapılan bir değişiklik hiçbir yerde kayıtlı
değildir ve altı ay sonra kimse neden orada olduğunu bilmez.

### Migration kuralları

- **Geri alınabilir yaz.** Sütun eklerken varsayılan ver, `not null`
  ikinci adımda gelsin.
- **Veri taşıyan migration ayrı dosyada olur.** Şema değişikliği ve veri
  dönüşümü aynı dosyada olursa biri patladığında diğeri yarım kalır.
- **Sütun silme ertelenir.** Önce kullanımdan kaldır, bir sürüm bekle,
  sonra sil. Böylece eski sürüm hâlâ çalışırken yayın yapılabilir.

---

## 9. Veri ekleyen betikler

> **Veri ekleyen her betik birden çok kez çalıştırılabilir olmalıdır.**

Betiği çalıştıran kişi ilk seferde işe yarayıp yaramadığını göremez ve
tekrar dener. Bu bir ihtimal değil, olağan davranıştır.

Her `insert` bir `on conflict` ile korunur:

```sql
insert into panel.ptp_sablonlar (...) values (...)
on conflict (firma_id, grup, baslik) where silindi is null do nothing;
```

Bunun için önce **benzersizlik kısıtı** gerekir; kısıt yoksa
`on conflict` yazılamaz. Yani soru şu: "bu tabloda neyin tekrarı hata
sayılır?" Cevabı yazmak, hem kısıtı hem betiği doğru kurar.

Yumuşak silme kullanılan tablolarda indeks **kısmi** olur
(`where silindi is null`); yoksa silinen bir kayıt aynı adla yeniden
açılamaz.

**Yaşanmış:** kurulum betiğindeki yedi eklemenin altısında
`on conflict` vardı, birinde unutulmuştu. Betik ikinci kez
çalıştırılınca yalnızca o tablo ikiye katlandı ve ondan üretilen
kayıtlar da tekrarlandı.

---

## 10. Sorgu yazarken

- **`select *` yazma.** Sütun eklendiğinde ağa gereksiz veri çıkar ve
  hangi alanın kullanıldığı okunmaz olur.
- **N+1 sorgudan kaçın.** Listede her satır için ayrı sorgu atılıyorsa
  tek sorguya çevrilir (`in` veya `join`).
- **Sayfalama zorunlu.** Sınırsız liste dönen uç nokta yazılmaz; veri
  büyüdüğünde çöker. Varsayılan sayfa boyutu 50.
- **Sıralama belirtilmeden liste dönme.** `order by` yoksa sıra
  garantisizdir ve sayfalama bozulur.

---

## 11. Denetim kaydı

Aşağıdakiler `denetim_kayitlari` tablosuna yazılır:

- Süperadminin bir firmanın verisine erişmesi
- Rol veya yetki değişikliği
- Kullanıcı açma, kapatma, şifre sıfırlama
- Gerçek silme
- Firma açma, kapatma, modül yetkisi değişikliği

```sql
create table denetim_kayitlari (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid references kullanicilar(id),
  firma_id uuid references firmalar(id),
  eylem text not null,
  hedef_tablo text,
  hedef_id uuid,
  ayrinti jsonb,
  ip inet,
  olusturuldu timestamptz not null default now()
);
```

**Denetim kaydı güncellenmez ve silinmez.** `update`/`delete` politikası
tanımlanmaz — kimse için.

---

## 12. Yedekleme

- Günlük otomatik yedek açık olmalı (Supabase'de plana bağlı).
- **Yedeğin geri yüklenebildiği en az bir kez denenir.** Denenmemiş yedek
  yedek değildir.
- Yayın öncesi ve şema değişikliği öncesi elle yedek alınır.

---

## 13. Yapma

- `firma_id` ve RLS olmadan firma verisi tablosu oluşturma
- `security_invoker` olmadan görünüm oluşturma
- `security definer` fonksiyonu `set search_path` olmadan yazma
- `update` politikasını `with check` olmadan yazma
- Parayı `float` ile tutma
- `timestamp` kullanma (hep `timestamptz`)
- Şemayı panelden elle değiştirme
- `select *` yazma
- Sayfalamasız liste uç noktası yazma
- Veri ekleyen betiği `on conflict` olmadan yazma
- Yabancı anahtarı indekssiz bırakma
- Kaydı gerçekten silme (KVKK talebi hariç)
- Denetim kaydını güncellenebilir bırakma
