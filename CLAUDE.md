# Karas Panel — proje kuralları

**Yeni bir şey üretmeden önce bu dosyayı oku.** Burada bu projeye özel
kurallar var; genel yazılım standartları `standartlar/` klasöründedir.

---

## Hangi dosya ne zaman okunur

| Dosya | Ne zaman |
|---|---|
| **`CLAUDE.md`** (bu dosya) | Her işe başlarken |
| **`standartlar/00-TEMEL.md`** | Projeye başlarken, bir kez |
| **`standartlar/01-VERITABANI.md`** | Tablo veya sorgu yazmadan önce — **her seferinde** |
| **`standartlar/02-GUVENLIK.md`** | Kimlik, yetki, sır veya kişisel veriye dokunmadan önce |
| **`standartlar/03-ARAYUZ.md`** | Ekran veya bileşen yazmadan önce |
| **`standartlar/04-KOD.md`** | Kod yazarken |
| **`standartlar/05-EKRANLAR.md`** | Yeni ekran planlarken |
| **`standartlar/06-TESLIM.md`** | Yayına çıkmadan önce |
| **`HARITA.md`** | Bir şeyi değiştirmeden önce: ne nerede |
| **`DURUM.md`** | Uzun aradan sonra: durum, kararlar, tuzaklar |

> `standartlar/` klasörü **projeden bağımsızdır.** Yeni bir yazılım
> başlatırken olduğu gibi kopyalanır; oraya bu projeye özel bir şey
> yazılmaz.

---

## 1. Sistem nedir

**Karas Panel**, işletme yazılımlarını tek girişte, tek ekranda, yetki
bazlı toplayan çok firmalı web platformudur.
Adres: `panel.karasteknoloji.com`

Modüller tek tek satılır ama tek panelde çalışır. Bir müşteri yalnızca
Personel Takip alsa da aynı panele girer; sonradan başka modül eklenirse
yeni program öğrenmez, sekme açılır.

| Modül | Kod | Ne yapar | Durum |
|---|---|---|---|
| Personel Takip | `ptp` | Günlük iş emri, checklist | **Kuruluyor** |
| Ödeme Takip | `otp` | Çek, kredi, ödeme planı | Sırada |
| Tahsilat Takip | `ttp` | Müşteri alacak takibi | Sırada |
| Mağaza Takip | `mtp` | Ciro, stok, hedef, prim | Sırada |

Yeni modüller eklenecek (üretim planlama gibi). **Şema, yetki modeli ve
klasör yapısı hepsi varmış gibi tasarlanır.**

---

## 2. Teknoloji

| | |
|---|---|
| Çatı | Next.js 16 (App Router) + React 19 + TypeScript |
| Veri | Supabase — Postgres, Auth, Storage |
| Stil | Tailwind CSS 4, token'lar `app/globals.css` |
| Yayın | Vercel — `main` dalına push otomatik yayınlar |
| Zamanlanmış iş | Supabase `pg_cron` |
| Dil | Yalnızca Türkçe |

```bash
npm run dev
```

```bash
npm run kontrol
```

```bash
npm run build
```

`kontrol` tip denetimidir; değişiklikten sonra çalıştırılır, sıfır hata
beklenir.

---

## 3. Roller — bu projenin merkezi

| Rol | Görür |
|---|---|
| `superadmin` | Bütün firmalar. Firma açar, modül yetkisi verir. |
| `firma_yoneticisi` | Yalnızca kendi firması. Kendi kullanıcılarını yönetir. |
| `kullanici` | Kendi firmasında, yalnızca yetkili modüller. |

Süperadmin bir firma değildir; firmaların üstünde duran platform
katmanıdır. Müşteri yöneticisi başka firmanın varlığından haberdar olmaz.

**İki katman birden denetlenir:** firma o modülü almış mı
(`firma_modulleri`) **ve** kullanıcının yetkisi var mı
(`modul_yetkileri`). Ayrıntı: `standartlar/02-GUVENLIK.md`.

---

## 4. Klasör yapısı

```
app/
  (giris)/            oturumsuz sayfalar
  (panel)/            oturum zorunlu
    ptp/              her modül kendi klasöründe
    ayarlar/
  (yonetim)/          yalnızca superadmin
  api/
lib/
  supabase/  yetki/  ortak/
bilesenler/
  arayuz/  panel/
supabase/migrations/
standartlar/          projeden bağımsız kurallar
```

> **Modül sınırı kuralı:** bir modül başka modülün klasöründen import
> yapmaz. Ortak ihtiyaç `lib/ortak/` altına taşınır.
>
> Tek depoda çalışmanın tek gerçek riski modüllerin birbirine
> yapışmasıdır; bu kural onu kapatır. Kural korunduğu sürece bir modül
> ileride ayrı depoya çıkarılabilir.

---

## 5. Yeni modül ekleme

1. `app/(panel)/<kod>/` klasörü açılır
2. Tablolar `<kod>_` önekiyle, `firma_id` ve RLS ile oluşturulur
3. `modul_yetkileri` içindeki `check` listesine kod eklenir
4. `firma_modulleri` üzerinden satılabilir hale gelir
5. Sekme, kullanıcının yetkisi varsa **kendiliğinden** görünür — panel
   düzenine elle sekme eklenmez
6. `CLAUDE.md` ve `HARITA.md` aynı işlem içinde güncellenir

Modül planlarken `standartlar/05-EKRANLAR.md` sonundaki yedi soru
cevaplanır.

---

## 6. PTP — taşınan program

`ptp`, `Desktop/Karas Takip Programı/ptp/magaza crm/` altındaki Electron
uygulamasından taşınıyor (Express + `db.json`). İş mantığı korunur; veri
katmanı, kimlik doğrulama ve zamanlanmış işler yeniden yazılır.

Taşırken zorunlu olarak değişen dört şey:

1. **Personel PIN'leri düz metindi** → hash'lenir
2. **`adminPassword: 'admin123'`** → Supabase Auth
3. **Telegram anahtarı koddaydı** → ortam değişkeni
4. **Telegram `getUpdates` ile yoklanıyordu** → webhook (sunucusuz
   ortamda sürekli çalışan süreç yok)

### Personel ekranı istisnası

Mağaza personeli ekranı ortak bir cihazdan kullanır ve PIN girer.
**PIN kimlik doğrulama değildir** — "bu görevi kim yaptı" işaretidir.

Cihaz önce firma oturumuyla bağlanır, personel ekranı o oturumun içinde
çalışır, PIN yalnızca kişiyi seçer. **PIN'le doğrudan panele girilemez.**
Bu ayrım korunmalı; PIN'i gerçek girişe dönüştürmek en kolay güvenlik
hatasıdır.

---

## 7. Bu projeye özel kararlar

**Panel arama motorlarına kapalı** (`noindex`). Müşteri verisi barındıran
bir uygulamanın dizine girmesi için sebep yok.

**Panel iframe'e gömülemez** (`X-Frame-Options: DENY`). Yerel sistem
modülleri iframe'e gömüyordu; webde bu hem üçüncü taraf çerez
kısıtlarına takılır hem tıklama hırsızlığına açar.

**Karanlık mod zorunlu.** Panel günde saatlerce bakılan bir uygulama;
tanıtım sitesinde gereksizdi, burada değil.

**Supabase projesi kurumsal siteyle ortak, şema ayrı.** Ücretsiz planın
proje sınırı yüzünden yeni proje açılamıyor. Site tabloları `public`,
panel tabloları `panel` şemasında.

Şema ayrımı düzen için değil güvenlik için: sitenin anon anahtarı
herkese açık bir sayfanın içinde ve `anon` rolüne `panel` şeması
kapatıldı. O anahtar panel verisine **ulaşamaz** — RLS'e ek, ondan
bağımsız ikinci kilit. Giriş Auth API'sine gittiği için `anon`'un bu
şemaya ihtiyacı da yok.

Bedeli kabul edildi: veri kotası, bant genişliği ve yedekler siteyle
ortak. Yedek geri yüklenirse ikisi birden geri alınır. İleride panel
kendi projesine taşınırsa tek bir şema taşınır — `public` içinden
tablo ayıklamaktan çok kolay.

⚠️ Şemanın API'ye açık olması gerekir: Supabase → Settings → API →
Exposed schemas → `panel`.

---

## 8. Yapma

Genel yasaklar her standart belgesinin sonundadır. Bu projeye özel olanlar:

- Modülü ayrı depoya çıkarma (tek depo, klasör olarak eklenir)
- Bir modülden başka modülün klasörüne import etme
- Panel düzenine elle sekme ekleme (yetkiden türer)
- PIN'i gerçek kimlik doğrulamaya dönüştürme
- Panelin Supabase projesine sitenin verisini karıştırma
- Değişiklik yapıp `HARITA.md`'yi güncellemeden bırakma
