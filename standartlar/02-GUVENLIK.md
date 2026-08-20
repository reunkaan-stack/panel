# 02 — Güvenlik ve kişisel veri

> Kimlik, yetki, sır veya kişisel veriye dokunmadan önce okunur.

Bu belgedeki kuralların çoğu "olur da başımıza gelirse" değil, **kardeş
projelerde bir kez başımıza geldiği için** yazılmıştır.

---

## 1. Kimlik doğrulama

**Supabase Auth kullanılır.** Kendi şifre saklama mekanizmamızı yazmayız
— o iş, doğru yapılması sanıldığından çok daha zor olan işlerden biridir.

`auth.users` ile kendi `kullanicilar` tablomuz `auth_id` üzerinden
bağlanır:

```sql
create table kullanicilar (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique not null references auth.users(id) on delete cascade,
  firma_id uuid references firmalar(id) on delete cascade,  -- superadmin'de null
  ad text not null,
  eposta text not null,
  rol text not null check (rol in ('superadmin','firma_yoneticisi','kullanici')),
  aktif boolean not null default true,
  son_giris timestamptz,
  olusturuldu timestamptz not null default now()
);
```

Auth yalnızca "bu kişi gerçekten o mu" sorusunu cevaplar. **Rol, firma ve
yetkiler bizim tablomuzda durur** — kimlik sağlayıcısı değişse bile yetki
modeli yerinde kalır.

### Kullanıcı oluşturma

**Varsayılan şifre kavramı yoktur.** Kullanıcı davetle kurulur, şifresini
kendisi belirler. `admin123` gibi bir varsayılan, yerel ağda tolere
edilebilir; internete açık bir sistemde açık kapıdır.

### Oturum

- Oturum çerezi `httpOnly`, `secure`, `sameSite=lax`
- Oturum **sunucu tarafında doğrulanır.** İstemcideki rol bilgisi
  görüntü içindir, karar mercii değildir.
- Hassas işlemlerden önce (şifre değişimi, kullanıcı silme) yeniden
  kimlik sorulur.

---

## 2. Yetki denetimi — iki katman

RLS veri tabanında koruyor olsa bile **uygulama katmanı da denetler.**
İki kilit, tek anahtardan iyidir; ayrıca uygulama katmanı kullanıcıya
anlamlı bir hata verebilir, RLS ise boş liste döner.

```ts
export async function gorevOlustur(veri: GorevGirdisi) {
  const yetki = await yetkiDenetle('ptp', 'yazma');
  if (!yetki.uygun) throw new YetkisizHata();
  // ...
}
```

**Her sunucu eyleminin (server action) ilk satırı yetki denetimidir.
İstisna yok.** Denetimi unutmanın maliyeti, yazmanın maliyetinden kat kat
büyüktür.

### İki seviye birden denetlenir

1. **Firma o modülü almış mı?** (`firma_modulleri`)
2. **Kullanıcının o modülde yetkisi var mı?** (`modul_yetkileri`)

Firma modülü almamışsa kullanıcıya yetki verilmiş olması bir şey ifade
etmez.

### Yetki seviyeleri

| Seviye | Ne yapabilir |
|---|---|
| `okuma` | Görür, değiştiremez |
| `yazma` | Kayıt ekler ve günceller |
| `yonetim` | Modül ayarlarını değiştirir, kayıt siler |

---

## 3. Sırlar

- **Sır koda yazılmaz.** Ortam değişkeninde durur.
- `.env` git'e **gönderilmez**. `.env.example` şablon olarak gönderilir,
  içi boştur.
- `NEXT_PUBLIC_` ön eki taşıyan her değer **tarayıcıya gider.** Anon
  anahtar gidebilir; başka hiçbir şey gitmez.
- **`service_role` anahtarı istemciye asla gitmez.** Bütün RLS kurallarını
  atlar. Yalnızca sunucu tarafında, yalnızca gerçekten gerekli işlerde.
- Sır sızdıysa **döndürülür (rotate)**, "kimse görmemiştir" denmez.

Yaşanmış: taşınan bir programda Telegram bot anahtarı ve varsayılan
yönetici şifresi kaynak dosyanın içinde yazılıydı. Depo herkese açık
olsaydı ikisi de sızmış olacaktı.

---

## 4. Girdi doğrulama

**Gelen her veri düşmandır.** İstemciden gelen hiçbir değere güvenilmez —
istemci kodunu biz yazmış olsak bile, çünkü tarayıcıda değiştirilebilir.

- Doğrulama **sunucuda** yapılır. İstemcideki doğrulama kullanıcı
  kolaylığıdır, güvenlik değildir.
- Şema doğrulaması kullanılır (`zod` vb.). Elle `if` yığını yazılmaz.
- **`firma_id` istemciden alınmaz.** Oturumdaki kullanıcıdan türetilir.
  İstemciden alınırsa başka firmanın kimliğini gönderen biri o firmaya
  yazar.
- SQL doğrudan birleştirilerek kurulmaz; parametreli sorgu kullanılır.

---

## 5. Dosya yükleme

- Dosyalar **nesne depolamaya** gider (Supabase Storage), sunucu diskine
  değil. Sunucusuz ortamda disk kalıcı değildir.
- **Tür ve boyut sınırı sunucuda uygulanır.** Uzantıya değil, gerçek
  içerik türüne bakılır.
- Yüklenen dosya adı kullanıcıdan alınmaz; yeniden üretilir. Kullanıcı
  adıyla kaydedilirse `../../` içeren bir ad dizin dışına yazabilir.
- Depolama kovası **firma bazlı ayrılır** ve kova politikası yazılır.
  Dosya URL'sinin tahmin edilemez olması güvenlik değildir.

---

## 6. Hız sınırlama

Şu uçlarda sınır uygulanır:

| Uç | Sınır |
|---|---|
| Giriş denemesi | 5 deneme / 15 dakika / IP + hesap |
| Şifre sıfırlama | 3 / saat / hesap |
| Dosya yükleme | 20 / saat / kullanıcı |
| Dışa açık form | 10 / saat / IP |

Başarısız giriş denemeleri kayda geçer. Ardışık başarısızlıkta hesap
geçici kilitlenir ve kullanıcıya e-posta gider.

---

## 7. Loglama — ne yazılır, ne yazılmaz

### Yazılır

- Kim, ne zaman, hangi firmada, ne yaptı
- Başarısız giriş denemeleri
- Yetki reddi olayları
- Süperadminin firma verisine erişmesi
- Hata izleri (stack trace) — sunucu tarafında

### Yazılmaz

- **Şifre, hiçbir biçimde** (hash'i bile log'a düşmez)
- Oturum çerezi, token, API anahtarı
- TC kimlik numarası, kart numarası
- Kişisel verinin tamamı — gerekiyorsa maskelenir (`0507 *** ** 99`)

**Log kişisel veri deposu değildir.** Bir kaydın kim tarafından
değiştirildiğini bilmek için kullanıcı kimliği yeter; adı ve telefonu
gerekmez.

---

## 8. Hata mesajları

Kullanıcıya gösterilen mesaj **ne olduğunu ve ne yapılacağını** söyler;
sistemin iç yapısını sızdırmaz.

| Durum | Gösterilen | Loglanan |
|---|---|---|
| Yanlış şifre | "E-posta veya şifre hatalı" | Hangi hesap, hangi IP |
| Yetkisiz erişim | "Bu sayfaya erişiminiz yok" | Kim, neye erişmek istedi |
| Sunucu hatası | "Bir sorun oluştu, tekrar deneyin" | Tam hata izi |

**"E-posta bulunamadı" denmez** — hangi e-postanın kayıtlı olduğunu
öğrenmek isteyen birine bilgi verir. Şifre sıfırlamada da aynısı: adres
kayıtlı olsun olmasın aynı mesaj gösterilir.

---

## 9. Güvenlik başlıkları

Her yanıtta bulunur:

```
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

**`X-Frame-Options: DENY`** — panel hiçbir yerde iframe'e gömülmez. Hem
tıklama hırsızlığına kapatır hem üçüncü taraf çerez kısıtlarıyla
uğraşmayı gereksiz kılar.

Panel arama motorlarına kapalıdır (`noindex`). Müşteri verisi barındıran
bir uygulamanın dizine girmesi için hiçbir sebep yok.

---

## 10. KVKK

- **Ne topladığını bil.** Hangi tabloda hangi kişisel veri var, yazılı
  olsun.
- **Amaçla sınırlı topla.** "İleride lazım olur" diye alan açılmaz.
- **Saklama süresi tanımlı olsun.** Süresi dolan veri silinir veya
  anonimleştirilir.
- **Silme talebi karşılanabilir olsun.** Yumuşak silme kuralının
  istisnası budur: KVKK talebinde gerçekten silinir ve işlem denetim
  kaydına yazılır.
- **Aydınlatma metni gerçeği anlatsın.** Metnin sistemle çelişmesi, hiç
  metin olmamasından kötüdür.
- Yurt dışına veri aktarımı varsa (analitik, e-posta servisi, yapay zeka
  sağlayıcısı) açık rıza alınır.

---

## 11. Yayın öncesi güvenlik kontrolü

- [ ] `.env` git'te değil, geçmişte de yok
- [ ] `service_role` anahtarı yalnızca sunucu kodunda
- [ ] Her tabloda RLS açık ve politikalar yazılı
- [ ] Her görünümde `security_invoker` + `revoke`
- [ ] Her sunucu eyleminde yetki denetimi
- [ ] Varsayılan şifre yok
- [ ] Güvenlik başlıkları dönüyor
- [ ] Hata mesajları iç yapı sızdırmıyor
- [ ] Yedek alınabiliyor **ve geri yüklenebiliyor**

---

## 12. Yapma

- Kendi şifre saklama mekanizmanı yazma
- Varsayılan şifre koyma
- Sırrı koda yazma
- `service_role` anahtarını istemcide kullanma
- `firma_id`'yi istemciden alma
- İstemcideki doğrulamaya güvenme
- Şifreyi, token'ı veya tam kişisel veriyi log'a yazma
- "E-posta bulunamadı" gibi varlık sızdıran mesaj gösterme
- Yüklenen dosyayı kullanıcının verdiği adla kaydetme
- Denenmemiş yedeğe güvenme
