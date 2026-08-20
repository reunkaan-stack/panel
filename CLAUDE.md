# Karas Panel — kurallar

Bu dosya, panele yeni modül veya özellik eklenirken uyulacak kuralları
tanımlar. **Yeni bir şey üretmeden önce bu dosyayı oku.** Amaç, dördüncü
modül eklendiğinde sistemin hâlâ tek bir programmış gibi görünmesi.

> Kardeş proje: `Desktop/karas site` — kurumsal site. O ayrı bir ürün,
> ayrı depo. Tasarım dili ve Türkçe adlandırma geleneği oradan gelir,
> gerisi bağımsızdır.

---

## 1. Sistem nedir

**Karas Panel**, işletme yazılımlarını tek girişte, tek ekranda, yetki
bazlı toplayan çok firmalı web platformudur. Adres:
`panel.karasteknoloji.com`.

Modüller tek tek satılır ama tek panelde çalışır. Bir müşteri yalnızca
Personel Takip alsa da aynı panele girer; sonradan Ödeme Takip eklenirse
yeni bir program öğrenmez, sekme açılır.

| Modül | Kısaltma | Ne yapar | Durum |
|---|---|---|---|
| Personel Takip | `ptp` | Günlük iş emri, checklist, personel takibi | **İlk kurulan** |
| Ödeme Takip | `otp` | Çek, kredi, ödeme planı | Sonra |
| Tahsilat Takip | `ttp` | Müşteri alacak takibi | Sonra |
| Mağaza Takip | `mtp` | Ciro, stok, hedef, prim analizi | Sonra |

**Şu an yalnızca `ptp` kuruluyor.** Ama şema, yetki modeli ve klasör
yapısı dördü de varmış gibi tasarlanır. Sonradan eklenen modül hiçbir
ortak yapıyı değiştirmek zorunda kalmamalı — bu belgenin varlık sebebi
budur.

### Kaynak: taşınan program

`ptp`, `Desktop/Karas Takip Programı/ptp/magaza crm/` altındaki Electron
uygulamasından taşınıyor. Orada Express + `db.json` ile çalışıyor.
Taşımada iş mantığı korunur, veri katmanı ve kimlik doğrulama yeniden
yazılır. Eski program yerelde bir süre yedek kalır.

---

## 2. Teknoloji

| | |
|---|---|
| Çatı | Next.js (App Router) + TypeScript |
| Veri | Supabase — Postgres, Auth, Storage |
| Stil | Tailwind CSS 4, token'lar `app/globals.css` içinde `@theme` bloğunda |
| Yayın | Vercel |
| Zamanlanmış iş | Supabase `pg_cron` |
| Dil | Yalnızca Türkçe. Kod, değişken, dosya ve tablo adları dahil. |

**Neden Next.js:** arayüz ve API tek çatıda. Modül eklemek klasör
eklemektir; ortak giriş, yetki ve düzen tek yerde durur.

**Neden Supabase:** dört modülün aynı veriyi görmesi gerekiyor. Firma,
kullanıcı ve personel tanımları ortak; her modülün kendi kopyasını
tutması en pahalı hata olurdu. Ayrıca RLS, çok firmalı ayrımı veri
tabanı seviyesinde zorlar — uygulama kodunda unutulsa bile sızıntı olmaz.

---

## 3. Çok firmalılık ve yetki — en kritik bölüm

Sistemde **üç rol** vardır. Bu ayrım şemanın merkezindedir; sonradan
eklenemez.

| Rol | Kim | Ne görür |
|---|---|---|
| `superadmin` | Karas Teknoloji (Kaan) | **Bütün firmalar.** Firma açar, kapatır, modül yetkisi verir, fatura durumunu yönetir. |
| `firma_yoneticisi` | Müşteri firmanın sahibi/yetkilisi | **Yalnızca kendi firması.** Kendi kullanıcılarını yönetir, kendi verisini görür. |
| `kullanici` | Müşterinin çalışanı | Kendi firmasında, **yalnızca yetki verilen modüller.** |

**Süperadmin bir firma değildir.** Firmaların üstünde duran platform
katmanıdır. Müşteri yöneticisi başka firmanın varlığından haberdar
olmaz; süperadmin hepsini görür ama bunu firma verisine karışmadan yapar.

### Değişmez kural

> **Firma verisi taşıyan her tablonun `firma_id` sütunu ve RLS politikası
> vardır. İstisna yoktur.**

Bunu sonradan eklemek, üç modül yazıldıktan sonra imkânsıza yakındır.
İlk tablodan itibaren uygulanır.

```sql
-- Her firma tablosunun iskeleti
create table ptp_gorevler (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmalar(id) on delete cascade,
  -- ... modüle özel sütunlar
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  olusturan uuid references auth.users(id)
);

alter table ptp_gorevler enable row level security;
```

### RLS deseni

Politikalar elle yazılmaz, iki yardımcı fonksiyon üzerinden kurulur:

```sql
-- Oturumdaki kullanıcının firması
create or replace function aktif_firma() returns uuid
language sql stable security definer set search_path = public as $$
  select firma_id from kullanicilar where auth_id = auth.uid()
$$;

-- Süperadmin mi
create or replace function superadmin_mi() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select rol = 'superadmin' from kullanicilar
                   where auth_id = auth.uid()), false)
$$;
```

Her tablo için standart politika:

```sql
create policy "firma kendi verisini görür" on ptp_gorevler
  for select using (firma_id = aktif_firma() or superadmin_mi());

create policy "firma kendi verisini yazar" on ptp_gorevler
  for insert with check (firma_id = aktif_firma() or superadmin_mi());
```

`update` ve `delete` için de aynı desen. **Politikası olmayan işlem
reddedilir** — Postgres'in varsayılanı budur ve bize yarar.

### Modül yetkisi

Kullanıcının hangi modülleri görebileceği ayrı tabloda tutulur:

```sql
create table modul_yetkileri (
  kullanici_id uuid not null references kullanicilar(id) on delete cascade,
  modul text not null check (modul in ('ptp','otp','ttp','mtp')),
  seviye text not null check (seviye in ('okuma','yazma','yonetim')),
  primary key (kullanici_id, modul)
);
```

Firmanın hangi modülleri satın aldığı ise firma seviyesinde durur
(`firma_modulleri`). **İki katman da denetlenir:** firma modülü almamışsa
kullanıcıya yetki verilmiş olması bir şey ifade etmez.

---

## 4. Veri tabanı kuralları

### Adlandırma

- Tablo ve sütun adları **Türkçe, `snake_case`**: `gorevler`, `olusturuldu`
- Türkçe karakter kullanılmaz: `calisan` (✓), `çalışan` (✗)
- Modüle özel tablolar **modül önekiyle**: `ptp_gorevler`, `otp_cekler`
- Ortak tablolar öneksiz: `firmalar`, `kullanicilar`, `personeller`
- Çoğul tablo, tekil sütun: `gorevler` tablosunda `baslik` sütunu

### Her tabloda bulunan sütunlar

| Sütun | Tür | Neden |
|---|---|---|
| `id` | `uuid` | Sıralı sayı kullanılmaz — adres çubuğundan başka firmanın kaydı tahmin edilemesin |
| `firma_id` | `uuid` | Çok firmalı ayrım (ortak tablolar hariç) |
| `olusturuldu` | `timestamptz` | Her zaman `timestamptz`, asla `timestamp` |
| `guncellendi` | `timestamptz` | Tetikleyiciyle otomatik güncellenir |
| `olusturan` | `uuid` | Kim yaptı — denetim için |

### Silme

**Kayıt silinmez, işaretlenir.** `silindi timestamptz` sütunu kullanılır
ve sorgular `where silindi is null` ile filtreler. Sebep: müşteri "yanlış
sildim" dediğinde geri dönüş olsun. Gerçek silme yalnızca KVKK talebiyle
yapılır ve kaydı tutulur.

### Görünümler — dikkat

> **Yeni bir `view` eklenirken iki adım zorunludur:**
> ```sql
> create view ... with (security_invoker = on) as ...;
> revoke all on ... from anon;
> ```

Postgres'te görünümler varsayılan olarak *oluşturanın* yetkisiyle çalışır
ve RLS'i atlar. Kardeş projede bu bir kez yaşandı: anon anahtarla müşteri
telefonu okunabiliyordu. Aynı hata burada firma verisini sızdırır.

### Değişiklikler

Şema değişikliği panelden elle yapılmaz. `supabase/migrations/` altına
tarihli SQL dosyası yazılır ve depoya işlenir. Sebep: yerel, test ve
canlının aynı şemada olduğundan emin olmanın başka yolu yok.

---

## 5. Kimlik doğrulama

**Panel girişi Supabase Auth ile yapılır.** E-posta + şifre. Oturum
çerezde, sunucu tarafında doğrulanır.

`auth.users` ile kendi `kullanicilar` tablomuz `auth_id` üzerinden
bağlanır. Rol, firma ve yetkiler bizim tablomuzda durur — Auth yalnızca
"bu kişi gerçekten o mu" sorusunu cevaplar.

### Personel ekranı istisnası

`ptp`'de mağaza personeli, ekranı ortak bir tablet/bilgisayardan kullanır
ve PIN girer. **PIN bir kimlik doğrulama yöntemi değildir** — "bu görevi
kim yaptı" işaretidir.

Kural: cihaz önce firma oturumuyla bağlanır (yönetici bir kez giriş
yapar), personel ekranı o oturumun içinde çalışır ve PIN yalnızca kişiyi
seçer. **PIN'le doğrudan panele girilemez.** Bu ayrım korunmalı; PIN'i
gerçek girişe dönüştürmek en kolay güvenlik hatasıdır.

---

## 6. Klasör yapısı

```
app/
  (giris)/                 giriş, şifre sıfırlama — oturumsuz sayfalar
  (panel)/                 oturum zorunlu; ortak düzen, sekmeler
    ptp/                   Personel Takip
    otp/  ttp/  mtp/       sonraki modüller — şimdilik yok
    ayarlar/               firma ayarları, kullanıcı yönetimi
  (yonetim)/               YALNIZCA superadmin — firma yönetimi
  api/
lib/
  supabase/                istemci ve sunucu bağlantıları
  yetki/                   rol ve modül denetimi — tek kaynak
  ortak/                   modüllerin paylaştığı iş mantığı
bilesenler/
  arayuz/                  düğme, tablo, form — tasarım sistemi
  panel/                   sekme, üst bar, yan menü
supabase/
  migrations/
```

**Modül sınırı kuralı:** bir modül başka modülün klasöründen import
yapmaz. Ortak ihtiyaç varsa `lib/ortak/` altına taşınır. Bu kural
bozulursa modülleri ayrı ayrı satmak imkânsız hale gelir.

---

## 7. Kod yazım kuralları

Bu bölüm ileride açılacak Next.js projelerinde de aynen geçerlidir.

### TypeScript

- `any` kullanılmaz. Tür bilinmiyorsa `unknown` yazılır ve daraltılır.
- Veri tabanı türleri elle yazılmaz, Supabase'den üretilir:
  `npx supabase gen types typescript` → `lib/supabase/tipler.ts`
- Dışa açılan her fonksiyonun dönüş türü yazılır.

### Next.js

- **Varsayılan sunucu bileşenidir.** `'use client'` yalnızca gerçekten
  tarayıcı durumu gerektiğinde yazılır (form durumu, açılır menü).
- Veri okuma sunucu bileşeninde yapılır; istemciye veri prop olarak iner.
- Yazma işlemleri **Server Action** ile yapılır, API route ile değil.
  API route yalnızca dışarıdan çağrılacak uçlar için (webhook, cron).
- Her Server Action ilk satırında yetki denetler. **İstisna yok:**

```ts
export async function gorevOlustur(veri: GorevGirdisi) {
  const yetki = await yetkiDenetle('ptp', 'yazma');
  if (!yetki.uygun) throw new Error('Yetkisiz işlem');
  // ...
}
```

RLS zaten koruyor olsa da uygulama katmanı da denetler — iki kilit, tek
anahtardan iyidir.

### Adlandırma

| Ne | Nasıl | Örnek |
|---|---|---|
| Değişken, fonksiyon | Türkçe `camelCase` | `gorevleriGetir` |
| Bileşen | Türkçe `PascalCase` | `GorevKarti` |
| Dosya (bileşen) | `PascalCase.tsx` | `GorevKarti.tsx` |
| Dosya (diğer) | `kebab-case.ts` | `yetki-denetle.ts` |
| Tablo, sütun | Türkçe `snake_case` | `ptp_gorevler` |

### Hata yönetimi

Hata yutulmaz. Kullanıcıya ne olduğu sade Türkçeyle söylenir, teknik
ayrıntı loglanır. `catch (e) {}` yasaktır.

---

## 8. Tasarım dili

Panel, kurumsal sitenin **"Teknik Blueprint"** dilini sürdürür — aynı
firma, aynı görsel kimlik. Ama panel bir uygulamadır: yoğunluk daha
yüksek, boşluk daha az, tıklama sayısı daha önemlidir.

### Ortak olan

- **Yuvarlak köşe yok.** Global olarak sıfırlanır.
- **Tek vurgu rengi turuncu**, cimri kullanılır.
- Etiket, sayı ve künye `font-mono`, büyük harf, geniş `tracking`.
- Renk token'ları siteyle aynı: `kagit`, `murekkep`, `turuncu`, `izgara`.
- **Ham renk kodu yazılmaz** (`#ABC123`, `bg-blue-500`).

### Panelde farklı olan

- Bölüm arası boşluk siteye göre dar; ekrana daha çok veri sığar.
- Tablolar birinci sınıf vatandaştır: sabit başlık, sıralama, satır hover.
- Her ekranda **tek birincil eylem** bulunur (turuncu dolu düğme).
  İkincisi gerekiyorsa çerçeveli düğme olur.
- Boş durum (`veri yok`) her listede tasarlanır — boş tablo gösterilmez,
  ne yapılacağı yazılır.
- Yükleniyor durumu iskelet (skeleton) ile verilir, dönen çark ile değil.

### Yazım tonu

Sitedeki kurallar burada da geçerli: abartı sıfat yok, somut ol, kısa
cümle, sade Türkçe. Ek olarak:

- Hata mesajı ne olduğunu **ve ne yapılacağını** söyler.
  "Kayıt başarısız" (✗) · "Görev kaydedilemedi, bağlantını kontrol et" (✓)
- Onay soruları sonucu söyler: "Sil" değil, "Görevi sil — geri alınamaz".

---

## 9. Güvenlik

- **`service_role` anahtarı istemciye asla gitmez.** Yalnızca sunucu
  tarafında, yalnızca gerçekten RLS atlaması gereken işlerde.
- Sırlar koda yazılmaz, ortam değişkeninde durur. Taşınan programda
  Telegram anahtarı ve varsayılan şifre kodun içindeydi; **taşırken
  ikisi de ortam değişkenine alınacak.**
- Varsayılan şifre kavramı yoktur. Kullanıcı davetle kurulur, şifresini
  kendisi belirler.
- `superadmin` işlemleri denetim kaydına yazılır (`denetim_kayitlari`):
  kim, ne zaman, hangi firmada, ne yaptı.
- Dosya yüklemeleri **Supabase Storage**'a gider, sunucu diskine değil.
  Kova politikaları da firma bazlı ayrılır.

---

## 10. Zamanlanmış işler

Taşınan programda `setInterval` ile 21:30 hatırlatma ve 22:00 günlük özet
gönderiliyor. **Vercel sunucusuz çalışır, sürekli açık süreç yoktur** —
bu yapı olduğu gibi taşınamaz.

Çözüm: Supabase `pg_cron` işi belirlenen saatte bir Edge Function ya da
panel API ucunu tetikler. Saat firma bazlı ayarlanabildiği için iş her
firmayı ayrı değerlendirir.

Kural: **zamanlanmış iş kendi başına iş mantığı yazmaz**, normal bir
fonksiyonu çağırır. Böylece elle de tetiklenebilir ve test edilebilir.

---

## 11. Yeni modül ekleme

1. `app/(panel)/<kisaltma>/` klasörü açılır
2. Tabloları `<kisaltma>_` önekiyle, `firma_id` ve RLS ile oluşturulur
3. `modul_yetkileri` içindeki `check` listesine kısaltma eklenir
4. `firma_modulleri` üzerinden satılabilir hale gelir
5. Sekme, kullanıcının yetkisi varsa kendiliğinden görünür — panel
   düzenine elle sekme eklenmez
6. Bu dosya ve `PANEL-HARITASI.md` aynı işlem içinde güncellenir

---

## 12. Yapma

- Firma verisi taşıyan tabloyu `firma_id` ve RLS olmadan oluşturma
- `security_invoker` olmadan görünüm oluşturma
- Bir modülden başka modülün klasörüne import etme
- `service_role` anahtarını istemci tarafında kullanma
- Sır veya varsayılan şifreyi koda yazma
- `any` kullanma, `catch (e) {}` yazma
- Ham renk kodu veya `rounded-*` sınıfı kullanma
- Şemayı Supabase panelinden elle değiştirme — migration yaz
- Kaydı gerçekten silme — `silindi` ile işaretle
- Değişiklik yapıp bu dosyayı ve haritayı güncellemeden bırakma
