# 00 — Temel kurallar

> Bu klasördeki belgeler **projeden bağımsızdır.** Yeni bir yazılım
> başlatırken `standartlar/` klasörünü olduğu gibi kopyala; projeye özel
> kurallar kök dizindeki `CLAUDE.md` içinde durur.

---

## 1. Bu belgeler ne işe yarar

Bir yazılımın kalitesi, tek tek verilen kararların iyiliğinden çok
**kararların tutarlılığından** gelir. Üç ay sonra yazılan bir ekranın ilk
günkü ekranla aynı dili konuşması, her seferinde yeniden düşünmekten daha
değerlidir.

Bu belgeler o tutarlılığı sağlar. Bir kural katıysa sebebi yazılıdır;
sebebi geçersizleştiğinde kural da değişir. **Sebepsiz kural yoktur.**

| Belge | Ne zaman okunur |
|---|---|
| `00-TEMEL.md` | Projeye başlarken, bir kez |
| `01-VERITABANI.md` | Tablo veya sorgu yazmadan önce — **her seferinde** |
| `02-GUVENLIK.md` | Kimlik, yetki, sır veya kişisel veriye dokunmadan önce |
| `03-ARAYUZ.md` | Ekran veya bileşen yazmadan önce |
| `04-KOD.md` | Kod yazarken; ilk projede baştan sona okunur |
| `05-EKRANLAR.md` | Yeni ekran planlarken |
| `06-TESLIM.md` | Yayına çıkmadan önce |

---

## 2. Dil: Türkçe

**Kod, değişken, dosya, tablo ve sütun adları Türkçe yazılır.**

Sebep tercih değil, maliyet: bu yazılımları Türkçe konuşan bir işletme
kullanıyor, Türkçe konuşan bir ekip yazıyor. `paymentStatus` ile
`odemeDurumu` arasında zihinsel bir çeviri adımı vardır ve o adım her
okumada tekrarlanır. Yıllar içinde tek tek küçük, toplamda büyük bir
maliyettir.

### Kural detayları

- Türkçe karakter **kullanılmaz**: `calisan` (✓), `çalışan` (✗)
  Sebep: veri tabanı, dosya sistemi ve URL'lerde sorun çıkarır.
- Dilin kendi kelimeleri İngilizce kalır: `id`, `token`, `hash`, `url`
- Kütüphane API'leri olduğu gibi kullanılır — `useState` Türkçeleştirilmez

### Adlandırma tablosu

| Ne | Nasıl | Örnek |
|---|---|---|
| Değişken, fonksiyon | `camelCase` | `gorevleriGetir` |
| Bileşen | `PascalCase` | `GorevKarti` |
| Bileşen dosyası | `PascalCase.tsx` | `GorevKarti.tsx` |
| Diğer dosyalar | `kebab-case.ts` | `yetki-denetle.ts` |
| Sabit | `SCREAMING_SNAKE` | `AZAMI_DOSYA_BOYUTU` |
| Tablo, sütun | `snake_case` | `ptp_gorevler`, `olusturuldu` |
| Tür (type/interface) | `PascalCase` | `GorevGirdisi` |

### Ad seçerken

- **Kısaltma yapma.** `krl` değil `kural`. Tek istisna yerleşik modül
  kısaltmalarıdır (`ptp`, `otp`) ve onlar belgede tanımlıdır.
- **Ne olduğunu söyle, nasıl olduğunu değil.** `gorevListesi` (✓),
  `gorevArray` (✗)
- **Boolean'lar soru gibi okunur:** `aktif`, `silindi`, `odendiMi`

---

## 3. Her projede bulunan belgeler

| Dosya | İşi |
|---|---|
| `CLAUDE.md` | Projeye özel üretim kuralları. Yeni bir şey yazmadan önce okunur. |
| `HARITA.md` | Envanter: hangi dosya nerede, hangi bileşen ne yapar, "şunu değiştirmek için nereye bak" tablosu |
| `DURUM.md` | Hikâye: ne yapıldı, neden öyle yapıldı, ne bekliyor, hangi tuzağa düşüldü |
| `standartlar/` | Bu klasör — projeden bağımsız kurallar |

**Değişiklik yapıldığında `HARITA.md` aynı işlem içinde güncellenir.**
Güncel olmayan bir harita yanlış yönlendirir; yararından çok zarar verir.

`DURUM.md` yalnızca köklü değişikliklerde güncellenir: yeni bölüm, mimari
karar, yaşanmış bir sorun.

### Yaşanmış tuzaklar bölümü

`DURUM.md` içinde bir "yaşanmış tuzaklar" bölümü bulunur. Bir hata iki
kez yapıldıysa yazılmamış demektir. Bu bölüm, kuralların çoğunun kaynağıdır.

---

## 4. Karar kaydı

Sıra dışı bir karar verildiğinde **gerekçesi kodun yanına yazılır.**
Ne yapıldığı koddan okunur; neden yapıldığı okunmaz.

```ts
/* Kenarlık kalınlaştırmak yerine ikinci bir çizgi ekleniyor —
   kalınlaşınca alan bir piksel oynuyor ve göz yoruyor. */
```

Yorum yazma kuralı: **kodun ne yaptığını anlatan yorum yazma.** Neden
öyle yaptığını, hangi alternatifin neden elendiğini, hangi tuzağın
farkında olunduğunu yaz.

---

## 5. Commit mesajları

Türkçe yazılır. İlk satır 60 karakteri geçmez ve **ne değiştiğini**
söyler. Gövde **neden** değiştiğini anlatır.

```
Form alanları görünmüyordu: .alan ve .onay tanımlandı

Her iki form bileşeni de bu sınıfları kullanıyordu ama hiçbir yerde
tanımlı değildi. Sınıflar global.css içine yazıldı, çünkü ikisini de
iki bileşen birden kullanıyor.
```

- Bir commit tek bir işi yapar. "Şunu düzelttim ve bu arada şunu da
  ekledim" iki commit'tir.
- Yayını bozan bir commit atılmaz. Yerel derleme geçmeden gönderilmez.

---

## 6. Değişikliğin boyutu

- **Bir dosya 400 satırı geçiyorsa** bölünmeyi hak ediyordur.
- **Bir fonksiyon 50 satırı geçiyorsa** muhtemelen iki iş yapıyordur.
- **Bir bileşen üç seviyeden derin iç içe geçiyorsa** alt bileşene ayrılır.

Bunlar katı sınır değil, durup düşünme işaretidir.

---

## 7. Yapma

- İngilizce değişken adı kullanma
- Türkçe karakterli dosya veya sütun adı kullanma
- Kısaltma uydurma
- Ne yaptığını anlatan yorum yazma (neden'i yaz)
- Değişiklik yapıp `HARITA.md`'yi güncellemeden bırakma
- Bir commit'te birden çok iş yapma
- Kuralı sebebini yazmadan ekleme
