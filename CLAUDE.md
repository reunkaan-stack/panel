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

### Modül içi seviyeler

Panel rolleri sistemin geneli için. Bir modülün içindeki "personel mi
müdür mü" ayrımı `modul_yetkileri.seviye` ile kurulur — **yeni rol
alanı açılmaz**, var olan yapı yeter:

| Seviye | PTP'deki karşılığı |
|---|---|
| `okuma` | Görevleri görür, kapatamaz |
| `yazma` | **Personel** — kendine atanan görevleri kapatır |
| `yonetim` | **Müdür** — görev atar, şablon düzenler, rapor görür |

`firma_yoneticisi` ve `superadmin` ayrı kayda gerek olmadan
`yonetim` sayılır. Veri tabanı tarafında bunu
`panel.modul_seviyesi(modul)` fonksiyonu döndürür.

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

**Geçmiş veri taşınmadı.** Temiz başlangıç yapıldı; eski program bir
süre yerelde yedek kalıyor.

Taşırken değişenler:

1. **PIN kavramı tamamen kalktı** — aşağıya bak
2. **`adminPassword: 'admin123'`** → Supabase Auth
3. **Telegram anahtarı koddaydı** → ortam değişkeni
4. **Telegram `getUpdates` ile yoklanıyordu** → webhook (sunucusuz
   ortamda sürekli çalışan süreç yok)

### Personel = gerçek kullanıcı

Eski programda personel ortak bir cihazdan PIN girip kendini
işaretliyordu. **Bu yapı bırakıldı.** Her personelin kendi hesabı ve
şifresi var; panele kendi kimliğiyle giriyor, sistem kim olduğuna bakıp
ekranları ona göre açıyor.

Sonuç: `ptp_personeller` tablosu ve `pin_hash` kaldırıldı. Personel
zaten `panel.kullanicilar`. Görevlerdeki `atanan_id` ve
`tamamlayan_id` doğrudan oraya bakıyor.

⚠️ **Bilinen ödün:** mağazada tek ortak tablet varsa herkesin sürekli
girip çıkması sürtünme yaratır. Şu an kabul edildi. Sorun olursa çözüm
PIN'e dönmek değil, cihaza uzun ömürlü bir oturum + hızlı kullanıcı
değiştirme eklemektir.

---

### PTP nasıl çalışır

**İki tablo, üretim yok.**

| Tablo | Ne tutar |
|---|---|
| `ptp_gorevler` | Tanım: başlık, tür, tekrar, kime atandı |
| `ptp_kayitlar` | Ne yapıldı: zaman, kim, bölgeler, değer, not |

"Bugün hangi görevler var" **okuma anında** hesaplanır: bugün haftanın
kaçıncı günü, hangi tanımlar ona düşüyor. Karar tek yerde —
`panel.ptp_gunun_gorevleri()`; ekran da raporlar da onu kullanır.

⚠️ **Görev satırı ÜRETİLMEZ.** Önceki tasarımda her sabah 23 satır
üretiliyordu ve çoğu "hiçbir şey olmadı" diyen yer tutucuydu — yılda
~8400 satır. Kaldırıldı; "günü oluştur" düğmesi ve cron da gitti.
Yapılmamış görevin kaydı yoktur; bu bilgi kaydın yokluğundan okunur.

**Atama görevin kendisinde ve kalıcı.** Küçük bir mağazada aynı işi
genelde aynı kişi yapar; her gün yeniden atamak gereksiz iş olurdu.
Boşsa görev herkese görünür ve herkes kapatabilir.

**Başlık kayda kopyalanır** (`baslik_kopya`). Tanım sonradan
değişirse geçmiş bozulmasın diye; türetme yapılsaydı haziran kayıtları
bugünkü başlıkla görünürdü.

**Görev türleri** — `tur` alanı:

| Tür | Ne yapar |
|---|---|
| `onay` | Tek işaret: yapıldı |
| `kontrol` | İçinde maddeler, işaretlenenler kayda yazılır |
| `bolge` | Krokiden bir veya birkaç bölüm seçilir |
| `metin` | Serbest yazı |
| `sayi` | Sayı girilir |

Fotoğraf ayrı tür DEĞİL, her türle birlikte istenebilen bayrak.

**Tekrar** — `gunluk` / `haftalik` (`tekrar_gunleri` dizisi,
`{2,5}` = salı ve cuma) / `tek_seferlik` (`tek_tarih`).

**Tekrarlanabilir görev** gün içinde birden çok kez yapılır; her yapılış
ayrı kayıttır. Bölge görevleri de gün boyu açık kalır — sonradan başka
bir bölüm de temizlenmiş olabilir.

**Çoklu değerler dizi olarak** (`bolge_idler`, `madde_idler`).
Ara tablo açmak bir günlük kaydı okumak için üç join demek olurdu; bu
bir kayıt defteri, ilişkisel çözümleme değil. Raporda `unnest` ile açılır.

**Telegram bu modülün en değerli parçası** ve korunacak: anlık bildirim,
akşam özeti, bota yazınca görev düşmesi, `/durum` ve `/ozet`.
Sunucusuz ortamda sürekli çalışan süreç olmadığı için `getUpdates`
değil **webhook** kullanılacak.

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
