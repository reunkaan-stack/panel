# 05 — Olmazsa olmaz ekranlar

> Yeni bir iş yazılımı planlarken okunur.

Her işletme yazılımında, konusu ne olursa olsun, aşağıdaki ekranlar
bulunur. Modüle özel ekranlar bunların **üstüne** gelir. Bu liste
atlandığında eksikler ilk gerçek kullanımda ortaya çıkar ve o noktada
eklemek pahalıdır.

---

## 1. Giriş (`/giris`)

En çok görülen ekran. Basit görünür, en çok tuzağı olan yerdir.

**Bulunur:** e-posta, şifre, "beni hatırla", şifremi unuttum bağlantısı,
firma/ürün adı.

**Bulunmaz:** kayıt ol bağlantısı. Kullanıcılar davetle oluşturulur;
kimse kendi kendine hesap açmaz.

| Kural | Sebep |
|---|---|
| Hata mesajı "E-posta veya şifre hatalı" | Hangi e-postanın kayıtlı olduğunu sızdırmaz |
| 5 başarısız denemeden sonra geçici kilit | Kaba kuvvet denemesi |
| Başarısız denemeler loglanır | Saldırı fark edilsin |
| Şifre alanı `autocomplete="current-password"` | Şifre yöneticileri çalışsın |
| Giriş sonrası **son bakılan sayfaya** dönülür | Oturum düştüğünde kullanıcı yerini kaybetmesin |
| Enter tuşu formu gönderir | Klavyeyle çalışanlar için |

---

## 2. Şifre sıfırlama (`/sifre-sifirlama`)

- Adres kayıtlı olsun olmasın **aynı mesaj** gösterilir
- Bağlantı tek kullanımlık ve süreli (60 dakika)
- Şifre değişince **diğer tüm oturumlar kapatılır**
- Kullanıcıya "şifreniz değişti" bilgi e-postası gider — değiştiren o
  değilse haberi olsun

---

## 3. Panel ana ekranı (`/`)

Giriş yapan kullanıcının ilk gördüğü yer. **Boş bir hoş geldiniz sayfası
değildir** — bugün ne yapılması gerektiğini söyler.

**Bulunur:** yetkili olduğu modüllerin sekmeleri, bugüne ait özet
(bekleyen iş, gecikmiş kayıt, dikkat isteyen şey), son işlemler.

Kullanıcı yalnızca bir modüle yetkiliyse doğrudan o modüle girer; tek
sekmeli bir ana ekran gereksiz tıklamadır.

---

## 4. Kullanıcı yönetimi (`/ayarlar/kullanicilar`)

Firma yöneticisinin ekranı. **Kendi firmasının** kullanıcılarını yönetir.

**Bulunur:** kullanıcı listesi (ad, e-posta, rol, son giriş, durum),
davet et, yetki düzenle, pasife al.

| Kural | Sebep |
|---|---|
| Kullanıcı **silinmez, pasife alınır** | Geçmiş kayıtlardaki "kim yaptı" bilgisi kaybolmasın |
| Kendi hesabını pasife alamaz | Kendini kilitlemesin |
| Son yönetici rolünden çıkarılamaz | Firma yöneticisiz kalmasın |
| Yetki değişikliği denetim kaydına yazılır | Sonradan sorulur |
| Davet e-postayla gider, şifreyi kullanıcı belirler | Varsayılan şifre olmaz |

---

## 5. Firma yönetimi (`/yonetim/firmalar`) — yalnızca süperadmin

Platform sahibinin ekranı. Müşteri firmalar burada yönetilir.

**Bulunur:** firma listesi, yeni firma açma, modül yetkilendirme, firma
kapatma, kullanım özeti.

- Firma kapatıldığında verisi **silinmez**, erişim kapanır
- Modül yetkisi firma seviyesinde verilir; kullanıcı yetkisi ondan sonra
  anlam kazanır
- Bu ekranın varlığı normal kullanıcıya **hiçbir şekilde sızmaz** —
  menüde görünmez, adresi denenirse 404 döner (403 değil; 403 "burada bir
  şey var ama giremezsin" der)

### Firma adına işlem yapma

Süperadmin destek verirken müşterinin ekranını görmek ister. İki yol var
ve seçim baştan yapılır:

| Yol | Artı | Eksi |
|---|---|---|
| Bütün firmaları tek listede görmek | Basit | Destek sırasında bağlam kurmak zor |
| "Firma seç" ile o firmanın gözüyle bakmak | Destek için çok daha iyi | Denetim kaydı şart |

İkincisi seçilirse: geçiş **denetim kaydına yazılır**, arayüzde sürekli
görünen bir uyarı şeridi bulunur ("Squala Home adına görüntülüyorsunuz"),
ve bu moddayken yazma işlemi ayrıca işaretlenir.

---

## 6. Log / denetim ekranı (`/yonetim/kayitlar`)

Çoğu projede atlanır, ilk anlaşmazlıkta aranır.

**Bulunur:** kim, ne zaman, hangi firmada, ne yaptı; filtre (kullanıcı,
tarih aralığı, eylem türü, firma), dışa aktarma.

| Kural | Sebep |
|---|---|
| Kayıt **değiştirilemez ve silinemez** | Denetim kaydının tek değeri güvenilirliğidir |
| Firma yöneticisi kendi firmasının kaydını görür | Şeffaflık |
| Süperadmin hepsini görür | Platform sorumluluğu |
| Şifre, token, tam kişisel veri yazılmaz | Log kişisel veri deposu değildir |
| Saklama süresi tanımlıdır | Sonsuza kadar tutmak KVKK sorunudur |

**Yazılan olaylar:** giriş/çıkış, başarısız giriş, yetki değişikliği,
kullanıcı açma/kapatma, gerçek silme, süperadminin firma verisine
erişmesi, ayar değişiklikleri.

---

## 7. Ayarlar (`/ayarlar`)

Firmaya ait yapılandırma. Modül ayarları kendi modülünün altında durur,
burada değil.

**Bulunur:** firma bilgileri, bildirim tercihleri, çalışma saatleri,
varsayılan değerler.

- Değişiklik **kaydedilene kadar uygulanmaz**; anlık kaydeden ayar ekranı
  yanlışlıkla değiştirmeye açıktır
- Kritik ayar değişikliği denetim kaydına yazılır
- Ayarın ne işe yaradığı yanında bir cümleyle anlatılır

---

## 8. Profil (`/profil`)

Kullanıcının kendi hesabı: ad, e-posta, şifre değiştirme, tema tercihi,
bildirim tercihi, açık oturumlar.

- Şifre değiştirirken **mevcut şifre sorulur**
- "Açık oturumlar" listesi ve "diğerlerini kapat" düğmesi bulunur

---

## 9. Hata ve sınır ekranları

| Ekran | Ne der |
|---|---|
| `404` | "Aradığınız sayfa yok" + panele dön |
| `403` | "Bu bölüme erişiminiz yok" + kimden isteneceği |
| `500` | "Bir sorun oluştu" + tekrar dene + hata kimliği |
| Bakım | "Kısa süreli bakım" + tahmini süre |
| Oturum düştü | Kullanıcı ne yaptığını kaybetmeden yeniden giriş |

**Hata kimliği önemlidir:** kullanıcı "şu kod çıktı" dediğinde log'da
tam olarak o olay bulunur.

---

## 10. Her liste ekranında bulunanlar

Modül ne olursa olsun bir liste ekranı şunları içerir:

- Arama
- Filtre (durum, tarih aralığı, sorumlu)
- Sıralama
- Sayfalama
- Toplu işlem (gerekiyorsa)
- Dışa aktarma (Excel/CSV) — işletme kullanıcısı bunu **her zaman** ister
- Dört durum: yükleniyor, boş, hata, yetkisiz

---

## 11. Yeni modül planlarken sorulacaklar

Üretim planlama, sipariş takibi, ne olursa olsun aynı sorular:

1. **Kim kullanacak?** Rol listesi ve her rolün göreceği ekranlar
2. **Hangi kayıt türü var?** Tablolar ve aralarındaki ilişkiler
3. **Hangi durumlar arası geçiş var?** Bir kayıt hangi durumlardan geçer,
   kim hangi geçişi yapabilir
4. **Ne zaman bildirim gider?** Kime, hangi kanaldan
5. **Hangi rapor istenecek?** İşletme sahibi ay sonunda neye bakacak
6. **Hangi veri dışarıdan gelecek?** Excel, başka program, elle giriş
7. **Ne yanlış giderse pahalı olur?** En kritik hata sınıfı, testi önce
   o alır

Bu yedi soru cevaplanmadan tablo yazılmaz.

---

## 12. Yapma

- Kayıt ol bağlantısı koyma (davetle çalış)
- "E-posta bulunamadı" gibi varlık sızdıran mesaj gösterme
- Süperadmin ekranını normal kullanıcıya 403 ile ele verme (404 dön)
- Kullanıcıyı gerçekten silme (pasife al)
- Denetim kaydını değiştirilebilir bırakma
- Log'a şifre, token veya tam kişisel veri yazma
- Liste ekranını dışa aktarma olmadan teslim etme
- Boş, hata ve yükleniyor durumlarını atlama
- Ayarı kaydet düğmesi olmadan anlık uygulama
