/* ÖTP arayüzünü yerel programdan panele taşır.
 *
 *   node araclar/otp-arayuz-tasi.mjs
 *
 * Kaynak: Karas Takip Programı/otp/OdemeTakip/index.html
 * Hedef : public/otp/uygulama.html
 *
 * Neden betik: hedef dosya ELLE düzenlenmiyor. Kaynak program bir gün
 * güncellenirse aynı dönüşümler yeniden uygulanabilsin diye her
 * değişiklik burada tanımlı. Elle düzenlenen bir kopya, kaynakla
 * arasındaki farkın zamanla kaybolması demek.
 *
 * Tasarıma, düzene ve iş mantığına DOKUNULMUYOR. Yapılanlar:
 *   1. API adreslerinin önüne /otp ekleniyor (panelin uçlarıyla
 *      çakışmasın diye)
 *   2. Modül çubuğu kaldırılıyor (panelin kendi gezinmesi var)
 *   3. Şifre değiştirme kutusu kaldırılıyor (panelin Kişiler ekranı
 *      yapıyor; iki ayrı şifre yönetimi kafa karıştırır)
 */

import fs from 'node:fs';
import path from 'node:path';

const KAYNAK = 'C:/Users/kaan/Desktop/Karas Takip Programı/otp/OdemeTakip/index.html';
const HEDEF = path.join(process.cwd(), 'public', 'otp', 'uygulama.html');

const BASLIK = `<!-- Karas Panel'e taşındı — ELLE DÜZENLEME.
     Kaynak: Karas Takip Programı/otp/OdemeTakip/index.html
     Üreten: araclar/otp-arayuz-tasi.mjs
     Değişiklik gerekiyorsa o betiğe yazılır ve yeniden çalıştırılır. -->
`;

if (!fs.existsSync(KAYNAK)) {
	console.error('Kaynak bulunamadı:', KAYNAK);
	process.exit(1);
}

let s = fs.readFileSync(KAYNAK, 'utf8');
const rapor = [];

/* ---------- 1. API adresleri ---------- */

const adresSayisi = (s.match(/["'`]\/api\//g) || []).length;
s = s.replace(/(["'`])\/api\//g, '$1/api/otp/');
rapor.push(`${adresSayisi} API adresi → /api/otp/`);

/* ---------- 2. Modül çubuğu ---------- */
/* Panelin kendi gezinmesi var; iki sıra sekme kullanıcıyı şaşırtıyor.
   Çubuğun açtığı TTP/PTP çerçeveleri de gidiyor: onlar yereldeki
   programları başlatıyordu, panelde karşılığı yok. */

const cubukDeseni =
	/<div id="modulBar"[\s\S]*?<iframe id="ptpFrame"[^>]*><\/iframe>\n?/;

if (cubukDeseni.test(s)) {
	s = s.replace(
		cubukDeseni,
		'<!-- Modül çubuğu kaldırıldı: gezinme panelde. -->\n'
	);
	rapor.push('modül çubuğu ve TTP/PTP çerçeveleri kaldırıldı');
} else {
	rapor.push('⚠ modül çubuğu bulunamadı — kaynak değişmiş olabilir');
}

/* ---------- 3. Şifre değiştirme kutusu ---------- */
/* Giriş artık panelin. Şifreyi Kişiler ekranından süperadmin
   değiştiriyor; burada ikinci bir yol bırakmak, hangisinin geçerli
   olduğunu belirsizleştirirdi. */

const sifreDeseni =
	/<div class="ayar-blok">\s*<div class="ayar-baslik"[^>]*>🔑 Şifre Değiştir<\/div>[\s\S]*?<\/div>\s*(?=<div class="ayar-blok tehlike">)/;

if (sifreDeseni.test(s)) {
	s = s.replace(
		sifreDeseni,
		`<div class="ayar-blok">
      <div class="ayar-baslik">🔑 Şifreler</div>
      <p>Şifre ve kullanıcı işlemleri panelin <strong>Kişiler</strong>
         ekranından yapılır. Giriş buraya panelden geliyor.</p>
    </div>

    `
	);
	rapor.push('şifre değiştirme kutusu → Kişiler ekranına yönlendirme');
} else {
	rapor.push('⚠ şifre kutusu bulunamadı — kaynak değişmiş olabilir');
}

/* ---------- 4. Firma seçicisi ---------- */
/* Seçim panelin üst çubuğunda. Arayüzün kendi seçicisi kalsaydı iki
   ayrı seçim yolu olurdu ve hangisinin geçerli olduğu belirsizleşirdi.

   Eleman SİLİNMİYOR, gizleniyor: arayüzün JavaScript'i onu adıyla
   arıyor (innerHTML dolduruyor), silinseydi null üzerinde çalışıp
   hata verirdi. */

/* ---------- 5. Ayarlar sekmesi ---------- */
/* Kaldırılıyor: içindeki beş uç (log, sifirla, sifre-degistir,
   yedekler, yedek-yukle) panele taşınmadı ve 404 dönüyor. Karşılıkları
   panelin kendi ekranlarında:

     Şifre ve kullanıcı  → Kişiler
     Bildirim ayarları   → Ayarlar › Bildirimler
     Yedek               → veri tabanı yedeği
     Log                 → denetim kayıtları

   Çalışmayan bir düğme bırakmak, kullanıcıya "bozuk" dedirtir. */

const stilSonu = '</' + 'style>';
if (s.includes(stilSonu)) {
	const kural = [
		'  /* Firma seçimi panelin üst çubuğunda yapılıyor. */',
		'  #sirketSec { display: none !important; }',
		'  /* Ayarlar panelin kendi ekranlarında. */',
		'  #ayarDugmesi { display: none !important; }',
		stilSonu,
	].join('\n');
	s = s.replace(stilSonu, kural);
	rapor.push('firma seçicisi gizlendi (panelin üst çubuğuna devredildi)');
} else {
	rapor.push('⚠ stil bloğu bulunamadı — seçici gizlenemedi');
}

/* Ayarlar düğmesine kimlik veriliyor ki yukarıdaki kural tutsun.
   Düğme silinmiyor: ayarAc() ve ayarKapat() ona bakıyor. */
const ayarDugmesi = '<button class="btn btn-ghost" title="Ayarlar" onclick="ayarAc()">';
if (s.includes(ayarDugmesi)) {
	s = s.replace(
		ayarDugmesi,
		'<button id="ayarDugmesi" class="btn btn-ghost" title="Ayarlar" onclick="ayarAc()">'
	);
	rapor.push('ayarlar sekmesi gizlendi (uçları panele taşınmadı)');
} else {
	rapor.push('⚠ ayarlar düğmesi bulunamadı — kaynak değişmiş olabilir');
}

/* ---------- Yaz ---------- */

fs.mkdirSync(path.dirname(HEDEF), { recursive: true });
fs.writeFileSync(HEDEF, BASLIK + s, 'utf8');

console.log('hedef:', HEDEF);
rapor.forEach((r) => console.log(' ·', r));
console.log('kalan ham /api/ :', (s.match(/["'`]\/api\/(?!otp)/g) || []).length);
console.log('boyut:', (fs.statSync(HEDEF).size / 1024).toFixed(0), 'KB');
