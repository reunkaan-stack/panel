# 04 — Kod yazım kuralları

> İlk projede baştan sona okunur; sonra gerektikçe bakılır.
> Varsayılan yığın **TypeScript + Next.js (App Router)**.

---

## 1. TypeScript

- **`any` kullanılmaz.** Tür bilinmiyorsa `unknown` yazılır ve daraltılır.
  `any` yazmak, tür denetimini o noktadan itibaren kapatmaktır.
- **Dışa açılan her fonksiyonun dönüş türü yazılır.** Çıkarım yerel
  değişkende iyidir, API sınırında değil.
- **Veri tabanı türleri elle yazılmaz**, şemadan üretilir:
  `npx supabase gen types typescript > lib/supabase/tipler.ts`
- `interface` yerine `type` tercih edilir; birleşim ve kesişim gerektiğinde
  tutarsızlık olmasın.
- `enum` kullanılmaz — sabit birleşim yazılır:
  ```ts
  type Durum = 'bekliyor' | 'tamamlandi' | 'atlandi';
  ```
  Veri tabanındaki `check` kısıtıyla birebir aynı olur.
- **`!` (non-null assertion) yazılmaz.** Gerçekten null olamıyorsa tür
  yanlıştır; olabiliyorsa denetlenir.

### Tür isimleri

| Ne | Örnek |
|---|---|
| Veri kaydı | `Gorev` |
| Form girdisi | `GorevGirdisi` |
| Liste öğesi (kısaltılmış) | `GorevOzeti` |
| Fonksiyon sonucu | `GorevSonucu` |

---

## 2. Next.js

### Sunucu / istemci ayrımı

- **Varsayılan sunucu bileşenidir.** `'use client'` yalnızca gerçekten
  tarayıcı durumu gerektiğinde yazılır: form durumu, açılır menü,
  sürükleme.
- `'use client'` **yaprak bileşene** konur, sayfanın tepesine değil.
  Tepeye konursa altındaki her şey istemciye iner.
- Veri okuma sunucu bileşeninde yapılır; istemciye prop olarak iner.

### Veri yazma

- Yazma işlemleri **Server Action** ile yapılır.
- API route yalnızca dışarıdan çağrılacak uçlar için kullanılır: webhook,
  zamanlanmış iş tetikleyicisi, dış entegrasyon.
- **Her Server Action'ın ilk satırı yetki denetimidir.** İstisna yok.

```ts
'use server';

export async function gorevOlustur(girdi: GorevGirdisi): Promise<Gorev> {
  const yetki = await yetkiDenetle('ptp', 'yazma');
  if (!yetki.uygun) throw new YetkisizHata();

  const veri = gorevSemasi.parse(girdi);   // doğrulama sunucuda
  // firma_id istemciden ALINMAZ, oturumdan gelir
  return gorevKaydet({ ...veri, firmaId: yetki.firmaId });
}
```

### Önbellek

- Veri değiştiren her eylem ilgili yolu tazeler (`revalidatePath`).
- Kullanıcıya özel veri **önbelleğe alınmaz**. Çok firmalı bir sistemde
  yanlış önbellek, bir firmanın verisini diğerine göstermek demektir.
  Şüphedeysen önbelleklememe tarafında kal.

---

## 3. Klasör düzeni

```
app/
  (giris)/            oturumsuz sayfalar
  (panel)/            oturum zorunlu
    <modul>/          her modül kendi klasöründe
    ayarlar/
  (yonetim)/          yalnızca superadmin
  api/
lib/
  supabase/           istemci ve sunucu bağlantıları
  yetki/              rol ve modül denetimi — tek kaynak
  ortak/              modüllerin paylaştığı iş mantığı
bilesenler/
  arayuz/             düğme, tablo, form — tasarım sistemi
  panel/              sekme, üst bar, yan menü
```

> **Modül sınırı kuralı:** bir modül başka modülün klasöründen import
> yapmaz. Ortak ihtiyaç `lib/ortak/` altına taşınır.

Bu kural bozulursa modüller birbirine yapışır ve ayrı ayrı satmak
imkânsız hale gelir. Ayrıca bir modüldeki değişiklik diğerini bozmaya
başlar — tek depoda çalışmanın tek gerçek riski budur ve bu kural onu
kapatır.

---

## 4. Hata yönetimi

- **`catch (e) {}` yasaktır.** Hata yutulursa sorun kaybolmaz, yalnızca
  görünmez olur ve üç ay sonra başka bir yerde patlar.
- Yakalanan hata ya çözülür, ya anlamlandırılıp yeniden fırlatılır, ya
  loglanır. Üçünden biri yapılır.
- Kendi hata türlerimiz tanımlanır:

```ts
export class YetkisizHata extends Error {
  constructor() { super('Bu işlem için yetkiniz yok'); }
}
export class BulunamadiHata extends Error { /* ... */ }
export class DogrulamaHatasi extends Error { /* ... */ }
```

- Kullanıcıya gösterilen mesaj **ne olduğunu ve ne yapılacağını** söyler.
  Teknik ayrıntı loglanır, ekrana yazılmaz.

---

## 5. Yorum yazma

**Kodun ne yaptığını anlatan yorum yazma.** O bilgi zaten kodda.

```ts
// KÖTÜ — kodu tekrar ediyor
// kullanıcıyı getir
const kullanici = await kullaniciGetir(id);

// İYİ — neden'i anlatıyor
/* Yetki denetimi RLS'den önce yapılıyor; RLS boş liste döndüğü için
   kullanıcı "veri yok" ile "yetkin yok" arasındaki farkı göremiyor. */
```

Şunlar yazılır:
- Sıra dışı bir kararın gerekçesi
- Elenmiş alternatif ve eleme sebebi
- Bilinen bir tuzağın farkında olunduğu
- Geçici çözüm ve kalıcı çözümün ne olduğu

---

## 6. Bağımlılıklar

- **Her paket bir borçtur.** Yüz satırla yazılabilecek şey için paket
  eklenmez.
- Eklemeden önce: son bir yılda güncellenmiş mi, kaç bağımlılığı var,
  bakımı kim yapıyor?
- Sürümler kilitlenir (`package-lock.json` depoya girer).
- Ana sürüm yükseltmesi ayrı commit'te yapılır ve denenir.

---

## 7. Test

Her şeyi test etmeye çalışmak, hiçbir şeyi test etmemeye dönüşür. Şu üçü
test edilir:

1. **Yetki ve firma ayrımı.** "A firmasının kullanıcısı B firmasının
   verisini görebiliyor mu?" — en pahalı hata sınıfı.
2. **Para ve tarih hesapları.** Yuvarlama, KDV, iskonto, gün farkı.
3. **Bir kez bozulan her şey.** Hata düzeltilirken önce onu yakalayan
   test yazılır; aynı hata iki kez olmaz.

Arayüz testleri en son gelir ve en kırılgandır.

---

## 8. Performans

Erken en iyileştirme yapılmaz, ama şunlar baştan doğru yapılır:

- **Sayfalama** — sınırsız liste dönen uç nokta yazılmaz
- **N+1 sorgu yok** — listede satır başına sorgu atılmaz
- **Görseller optimize** — ham fotoğraf servis edilmez
- **İstemciye inen JavaScript az tutulur** — `'use client'` yayılmasın

Ölçmeden "yavaş" denmez; tahminle en iyileştirme yapılmaz.

---

## 9. Yapma

- `any` yazma
- `!` (non-null assertion) kullanma
- `catch (e) {}` yazma
- `'use client'` yazısını sayfanın tepesine koyma
- Server Action'a yetki denetimi olmadan başlama
- `firma_id`'yi istemciden alma
- Kullanıcıya özel veriyi önbelleğe alma
- Bir modülden başka modülün klasörüne import etme
- Kodun ne yaptığını anlatan yorum yazma
- Yüz satırla yazılacak iş için paket ekleme
- Ölçmeden en iyileştirme yapma
