# 03 — Arayüz ve tasarım sistemi

> Ekran veya bileşen yazmadan önce okunur.

---

## 1. Tasarım dili: Teknik Blueprint

Arayüz bir mühendislik çizimi gibi görünür. Bu bilinçli bir tercihtir:
işletme yazılımları birbirine benzer ve çoğu jenerik "bootstrap paneli"
gibi durur. Ayrışmanın en ucuz yolu tutarlı ve karakterli bir dildir.

### Değişmezler

- **Yuvarlak köşe yok.** Global olarak sıfırlanır.
- **Tek vurgu rengi turuncu.** Cimri kullanılır; bir ekranda birkaç
  yerden fazla görünürse etkisini kaybeder.
- **Stok görsel yok.** Görsel gerekiyorsa çizim (SVG) üretilir.
- Etiket, sayı, künye ve düğme `font-mono`, büyük harf, geniş `tracking`.
- Gölge yerine ofset gölge: `shadow-[4px_4px_0_0_...]`
- **Ham renk kodu yazılmaz.** Yeni renk gerekiyorsa önce token tanımlanır.

### Panel, tanıtım sitesinden nerede ayrılır

Panel bir uygulamadır; günde sekiz saat bakılır.

- Boşluk daha dar — ekrana daha çok veri sığar
- Tablolar birinci sınıf vatandaştır
- Animasyon en aza indirilir; her gün görülen bir geçiş üçüncü günde
  yorucu olur (150 ms üstü geçiş kullanılmaz)
- **Karanlık mod zorunludur** — tanıtım sitesinde gereksizdi, panelde
  değil

---

## 2. Token mimarisi

İki katman kullanılır. Bu ayrım karanlık modun temelidir.

**Katman 1 — palet.** Ham renkler. Doğrudan kullanılmaz.

```css
--renk-kagit: #faf9f6;
--renk-kagit-2: #f2f0e9;
--renk-murekkep: #1a1a1a;
--renk-murekkep-2: #5c5952;
--renk-turuncu: #d9541e;
--renk-izgara: #ddd9d0;
/* karanlık tarafın kendi paleti */
--renk-gece: #14140f;
--renk-gece-2: #1c1c18;
--renk-gece-3: #26262180;
```

**Katman 2 — anlamsal token.** Bileşenler **yalnızca bunları** kullanır.

```css
@theme {
  --color-zemin: var(--renk-kagit);        /* sayfa arka planı */
  --color-zemin-2: var(--renk-kagit-2);    /* kart, panel */
  --color-metin: var(--renk-murekkep);     /* ana metin */
  --color-metin-2: var(--renk-murekkep-2); /* ikincil metin */
  --color-metin-3: var(--renk-murekkep-3); /* etiket, dipnot */
  --color-kenarlik: var(--renk-izgara);
  --color-vurgu: var(--renk-turuncu);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-tema='acik']) {
    --color-zemin: var(--renk-gece);
    --color-zemin-2: var(--renk-gece-2);
    --color-metin: #ebe8e0;
    --color-metin-2: #a8a49a;
    --color-metin-3: #7a766d;
    --color-kenarlik: #33332c;
    --color-vurgu: #e9683a;   /* koyu zeminde turuncu biraz açılır */
  }
}

:root[data-tema='karanlik'] { /* aynı değerler */ }
```

**Kural:** bir bileşen `bg-kagit` yazmaz, `bg-zemin` yazar. Böylece
karanlık mod tek dosyadan gelir; bileşenlerde tema koşulu bulunmaz.

### Tarama yolları

Tailwind, sınıfları kaynak dosyaları tarayarak üretir. Taramadığı bir
klasördeki sınıf CSS'e hiç girmez — hata vermez, sadece görünmez.

Tailwind 4 proje kökünden itibaren kendiliğinden tarar ve normal bir
klasör düzeninde ek ayar gerekmez. Yine de yollar açıkça yazılır:

```css
@import 'tailwindcss';
@source "../app";
@source "../bilesenler";
```

Sebep otomatik taramaya güvensizlik değil, **niyeti belgelemek**: kaynak
klasörlerin hangileri olduğu tek bakışta görünür ve tarama kökü dışında
kalan bir klasör (paylaşılan bir paket gibi) eklendiğinde nereye
yazılacağı bellidir.

### Üç durum

Tema **üç** durumludur, iki değil:

| Durum | Nasıl | Ne olur |
|---|---|---|
| Sistem (varsayılan) | `data-tema` yok | İşletim sistemi tercihine uyar |
| Açık | `data-tema="acik"` | Kullanıcı açıkça seçmiş |
| Karanlık | `data-tema="karanlik"` | Kullanıcı açıkça seçmiş |

Seçim `localStorage`'a yazılır ve `<html>` üzerine **sayfa boyanmadan
önce** uygulanır — yoksa karanlık modda bir kare beyaz parlar. Bunun için
`<head>` içinde küçük bir satır içi betik gerekir.

### Karanlık modda dikkat

- **Saf siyah kullanılmaz** (`#000`). Kontrast fazla sert, uzun bakışta
  yorucu. Koyu ama nötr bir zemin seçilir.
- **Saf beyaz metin kullanılmaz.** Kırık beyaz gözü daha az yorar.
- Renk körü olmayan biri için bile **kırmızı-yeşil ayrımı tek başına
  yeterli değildir.** Durum, renkle birlikte metin veya simgeyle anlatılır.
- Görseller ve grafikler karanlık zeminde ayrıca denenir; açık zemin için
  seçilmiş renkler orada kaybolur.

---

## 3. Vurgu rengi iki tondur — ölçülmüş

Marka turuncusu (`#d9541e`) kâğıt zeminde **3.81:1** kontrast verir.
Bileşen sınırı için yeterlidir (WCAG kuralı 3:1) ama **küçük yazı için
değildir** (4.5:1 gerekir).

Bu yüzden iki token vardır:

| Token | Nerede | Aydınlık | Karanlık |
|---|---|---|---|
| `vurgu` | Kenarlık, nişan, odak halkası, seçim | 3.81:1 ✓ (sınır 3:1) | — |
| `vurgu-metin` | Küçük yazı, dolu düğme zemini | **5.22:1** ✓ | **5.72:1** ✓ |

Marka görünümü korunur; okunabilirlik ödün vermez.

### Ölçülmüş kontrast değerleri

Aşağıdakiler hesaplanarak doğrulandı, göz kararı değil:

| Token | Aydınlık | Karanlık |
|---|---|---|
| `metin` / zemin | 16.53:1 | 15.09:1 |
| `metin-2` / zemin | 6.64:1 | 7.43:1 |
| `metin-3` / zemin | 5.11:1 | 4.76:1 |
| `vurgu-metin` / zemin | 5.22:1 | 5.72:1 |

`metin-3` ilk denemede 3.45:1 çıkmıştı — kurumsal siteden devralınan
ton, küçük etiketler için yetersizdi. Koyulaştırıldı. **Palet devralınsa
bile yeniden ölçülür.**

## 4. Durum renkleri

Turuncu **vurgu** rengidir; hata veya gecikme anlamına gelmez. Bir işin
geciktiğini turuncuyla anlatmak vurguyu tüketir.

```css
--color-basarili: #2f6f4e;
--color-uyari:    #9a6b12;
--color-hata:     #a32b1c;
```

Karanlık tarafta üçünün de açılmış karşılığı tanımlanır.

---

## 5. Tipografi

| Kullanım | Yazı tipi |
|---|---|
| Başlık, gövde | `font-sans` (IBM Plex Sans) |
| Etiket, sayı, künye, düğme | `font-mono` (IBM Plex Mono), büyük harf |

- Yazı tipleri **kendi sunucumuzdan** servis edilir; Google'a istek gitmez.
- `latin-ext` altkümesi zorunludur — Türkçe karakterler onda.
- **Tablodaki sayılar `font-mono`.** Değişken genişlikli rakam sütunu
  hizasız görünür.
- **Form alanı yazısı en az 16px.** Daha küçüğünde iOS Safari alana
  odaklanınca sayfayı büyütür ve düzen bozulur.

---

## 6. Bileşen kuralları

### Ortak sınıf nerede durur

> **Bir sınıfı iki bileşen kullanıyorsa `globals.css` içinde tanımlanır.**

Yaşanmış: kardeş projede form alanı sınıfları iki bileşende kullanılıp
hiçbir yerde tanımlanmamıştı. Alanların kenarlığı, zemini ve dolgusu hiç
olmadı; sitenin ana dönüşüm aracı aylarca görünmez alanlarla çalıştı.
Bileşen içindeki `<style>` bloğu başka bileşeni etkilemez.

### Düğmeler

- **Her ekranda tek birincil eylem** (dolu turuncu). İkincisi gerekiyorsa
  çerçeveli olur.
- Yıkıcı eylem (silme) **asla birincil düğme değildir** ve onay ister.
- Onay sorusu sonucu söyler: "Sil" değil, **"Görevi sil — geri alınamaz"**.
- İşlem sürerken düğme kilitlenir ve durumu söyler ("Kaydediliyor…").
  Kilitlenmezse çift tıklayan kullanıcı iki kayıt oluşturur.

### Tablolar

- Başlık satırı kaydırırken sabit kalır
- Sayı sütunları sağa, metin sola hizalanır
- Uzun tablo `overflow-x: auto` içinde kaydırılır; **sayfa gövdesi asla
  yatay kaymaz**
- Satır sayısı 50'yi geçiyorsa sayfalama gelir
- Sıralanabilir sütun başlığında yön işareti görünür

### Formlar

- Etiket her zaman görünür — yer tutucu (placeholder) etiket yerine
  kullanılmaz; yazmaya başlayınca kaybolur ve kullanıcı ne girdiğini
  unutur
- Zorunlu alan işaretlenir
- Hata alanın **altında** ve alana özel gösterilir; sayfa başında toplu
  liste değil
- Doğrulama kullanıcı alandan çıkınca çalışır, her tuşta değil
- Kaydedilmemiş değişiklik varken sayfadan çıkılırsa uyarılır

---

## 7. Zorunlu durumlar

Her liste ve her ekran **dört durumu** karşılar. Üçü unutulur ve ilk
gerçek kullanımda ortaya çıkar.

| Durum | Ne gösterilir |
|---|---|
| **Yükleniyor** | İskelet (skeleton). Dönen çark kullanılmaz — sayfanın nasıl görüneceğini önceden anlatmaz |
| **Boş** | Ne olduğu ve ne yapılacağı. "Kayıt yok" yetmez: "Henüz görev tanımlanmadı — ilk görevi ekleyin" |
| **Hata** | Ne olduğu, ne yapılacağı ve tekrar deneme düğmesi |
| **Yetkisiz** | "Bu bölüme erişiminiz yok" + kimden isteneceği |

Boş durum tasarlanmamış bir ekran yarım kalmış demektir.

---

## 8. Erişilebilirlik

Bunlar "sonra bakarız" maddesi değildir; sonradan eklenmesi baştan
yapmaktan pahalıdır.

- Metin/zemin kontrastı en az **4.5:1** (büyük başlıkta 3:1, bileşen
  sınırında 3:1). Her iki temada da **hesaplanarak** ölçülür — göz kararı
  yanıltır, özellikle turuncu gibi doygun renklerde.
- **Renk tek başına anlam taşımaz.** Durum, metin veya simgeyle
  desteklenir.
- Her etkileşimli öğeye klavyeyle ulaşılır; odak halkası görünür
  (`:focus-visible`).
- Sekme sırası ekrandaki görsel sırayla aynıdır.
- Simge-only düğmeye `aria-label` yazılır.
- Form alanı `<label>` ile ilişkilendirilir.
- Dinamik mesajlar (`kaydedildi`, `hata`) `aria-live` ile duyurulur.

---

## 9. Mobil ve duyarlılık

- Panel **öncelikle masaüstü** için tasarlanır — günlük iş orada yapılır.
- Ama saha ekranları (personel görev listesi gibi) **öncelikle telefon**
  için tasarlanır. Hangi ekranın hangisi olduğu baştan kararlaştırılır.
- Dokunma hedefi en az 44×44 piksel.
- Tablolar telefonda karta dönüşür; yatay kaydırma son çaredir.

---

## 10. Yapma

- Ham renk kodu veya `rounded-*` yazma
- Bileşende `bg-kagit` gibi palet token'ı kullanma (anlamsal token kullan)
- Bileşen içinde tema koşulu yazma
- Karanlık modda saf siyah veya saf beyaz kullanma
- İki bileşenin paylaştığı sınıfı bileşen içinde tanımlama
- Yer tutucuyu etiket yerine kullanma
- Boş, hata ve yükleniyor durumlarını atlama
- Yıkıcı eylemi birincil düğme yapma
- Sayfa gövdesini yatay kaydırtma
- Durumu yalnızca renkle anlatma
- Marka rengini kontrastını ölçmeden küçük yazıda kullanma
- Devralınan paleti yeniden ölçmeden kullanma
- Tarama kökü dışında kaynak klasörü açıp `@source` satırını eklemeyi unutma
- 150 ms'den uzun geçiş animasyonu koyma
