# 06 — Ortamlar, yayın ve teslim

> Yayına çıkmadan önce okunur.

---

## 1. Ortamlar

| Ortam | Nerede | Veri |
|---|---|---|
| Yerel | Geliştirme makinesi | Kendi Supabase projesi ya da yerel örnek |
| Önizleme | Vercel — her dal ve her PR | **Ayrı** Supabase projesi |
| Canlı | Vercel — `main` dalı | Gerçek veri |

> **Önizleme ortamı canlı veri tabanına bağlanmaz.** Denenmemiş bir kod
> müşterinin verisini bozabilir; ayrıca test verisi canlıya karışır.
> Bu, en sık ve en pahalı kısayoldur.

Ortam değişkenleri üç ortamda ayrı tanımlanır. Aynı anahtarın üç yerde de
kullanılması, ortam ayrımının olmaması demektir.

---

## 2. Yayın akışı

1. Dal açılır, iş yapılır
2. Yerelde `npm run kontrol` ve `npm run build` geçer
3. Push edilir → önizleme yayını çıkar
4. Önizlemede gözle denenir
5. `main`'e birleştirilir → canlıya çıkar

**Doğrudan `main`'e yazılmaz.** Tek kişilik ekipte bile: önizleme,
"derlenmiyor" ile "canlı bozuldu" arasındaki farktır.

Derleme hata verirse yayın **durur**. Hataları görmezden gelen ayar
(`ignoreBuildErrors`) açılmaz — o ayar, tip denetiminin tek faydasını
iptal eder.

---

## 3. Yayın öncesi kontrol listesi

### Kod
- [ ] `npm run kontrol` sıfır hata
- [ ] `npm run build` geçiyor
- [ ] Konsola bırakılmış `console.log` yok
- [ ] Yorum satırına alınmış ölü kod yok

### Güvenlik
- [ ] `.env` git'te değil (geçmişte de yok)
- [ ] `service_role` yalnızca sunucu kodunda
- [ ] Her tabloda RLS açık, politikalar yazılı
- [ ] Her görünümde `security_invoker` + `revoke`
- [ ] Her sunucu eyleminde yetki denetimi
- [ ] Varsayılan şifre yok
- [ ] Güvenlik başlıkları dönüyor

### Veri
- [ ] Migration'lar sırayla uygulanıyor
- [ ] Yedek alındı **ve geri yüklenebildiği denendi**
- [ ] Taşınan veri sayıldı: kaç kayıt gitti, kaçı geldi

### Arayüz
- [ ] Boş, hata, yükleniyor durumları var
- [ ] Karanlık modda her ekran denendi
- [ ] Telefonda denendi
- [ ] Klavyeyle gezilebiliyor, odak halkası görünüyor

### Çok firmalılık
- [ ] İki farklı firma hesabıyla giriş yapıldı
- [ ] A firması B'nin verisini **göremiyor**
- [ ] Süperadmin ekranı normal kullanıcıda 404 dönüyor

---

## 4. Veri taşıma

Eski bir sistemden veri taşınıyorsa:

1. **Önce say.** Kaynakta kaç kayıt var, tablo tablo yaz.
2. **Kuru çalıştır.** Yazmadan çalıştır, ne olacağını raporla.
3. **Taşı.**
4. **Tekrar say ve karşılaştır.** Sayılar tutmuyorsa sebebi bulunur;
   "yuvarlanmıştır" denmez.
5. **Örnekle doğrula.** Rastgele on kayıt elle karşılaştırılır.
6. **Kaynağı sakla.** Taşıma sonrası eski sistem bir süre yedek kalır.

Taşıma betiği depoya girer. Bir kez çalışıp atılacak olsa bile: altı ay
sonra "bu veri nereden geldi" sorusunun tek cevabı odur.

---

## 5. İzleme

- **Hata takibi kurulur** (Sentry vb.). Kullanıcının bildirmediği hatalar
  en tehlikelileridir.
- **Ayakta olma denetimi** kurulur; canlı adres dakikalık yoklanır.
- Yayın sonrası ilk saat loglara bakılır.

Ölçülmeyen sistem çalışıyor sayılmaz; yalnızca şikâyet gelmemiştir.

---

## 6. Geri alma

Her yayının geri alınabilir olması şarttır.

- Vercel'de önceki yayına dönmek tek tıktır — **kod tarafı kolaydır**
- **Zor olan veri tarafıdır:** migration geri alınamıyorsa geri dönüş
  yoktur. Bu yüzden yıkıcı migration (sütun silme, tür değiştirme) iki
  adıma bölünür ve araya bir sürüm konur
- Geri alma bir kez denenir; ihtiyaç anında ilk kez denenmez

---

## 7. Teslim ve devir

Müşteriye teslim edilen bir sistemde bulunur:

- Kısa kullanım kılavuzu (ekran görüntülü, sade Türkçe)
- Yönetici için kullanıcı ekleme/çıkarma anlatımı
- Destek kanalı ve müdahale süresi
- Verinin nerede durduğu ve nasıl dışa aktarılacağı bilgisi

**Müşteri verisini dışa aktarabilmelidir.** Sistemden çıkamayan müşteri
kilitlenmiş müşteridir; bu, uzun vadede güveni bitirir.

---

## 8. Yapma

- Önizleme ortamını canlı veri tabanına bağlama
- Doğrudan `main`'e yazma
- Derleme hatalarını görmezden gelen ayar açma
- Denenmemiş yedeğe güvenme
- Taşıma sonrası sayı karşılaştırması yapmadan devam etme
- Taşıma betiğini depoya koymadan atma
- Yıkıcı migration'ı tek adımda yapma
- Hata takibi kurmadan yayına çıkma
- Müşteriyi verisini dışa aktaramaz durumda bırakma
