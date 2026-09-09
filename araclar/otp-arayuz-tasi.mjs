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

/* Gizlenecek düğmelere kimlik veriliyor ki stil kuralları tutsun.
   Düğmeler SİLİNMİYOR: arayüzün kendi kodu bazılarına adıyla bakıyor
   (ayarAc, kullaniciChip'i dolduran kod), silinseydi null üzerinde
   çalışıp hata verirdi. */
const kimlikVer = [
	{
		bul: '<button class="btn btn-ghost" title="Ayarlar" onclick="ayarAc()">',
		koy: '<button id="ayarDugmesi" class="btn btn-ghost" title="Ayarlar" onclick="ayarAc()">',
		not: 'ayarlar sekmesi gizlendi (uçları panele taşınmadı)',
	},
	{
		bul: '<button class="btn btn-ghost" title="Oturumu kapat" onclick="cikisYap()">',
		koy: '<button id="cikisDugmesi" class="btn btn-ghost" title="Oturumu kapat" onclick="cikisYap()">',
		not: 'çıkış düğmesi ve kullanıcı adı gizlendi (panelin üst çubuğunda var)',
	},
];

for (const k of kimlikVer) {
	if (s.includes(k.bul)) {
		s = s.replace(k.bul, k.koy);
		rapor.push(k.not);
	} else {
		rapor.push('⚠ bulunamadı: ' + k.not);
	}
}

/* ---------- 6. Karas Panel teması ---------- */
/* Renkler panelin paletine çekiliyor. Arayüzün YAPISI değişmiyor:
   kartlar, tablolar, düzen aynı; değişen renk ve köşe.

   Anlam taşıyan renkler korunuyor. Yeşil "gelen", kırmızı "giden",
   amber "yaklaşan" demek; hepsini tek vurgu rengine indirmek
   ekrandaki bilgiyi yok ederdi. Onun yerine aynı anlamlar panelin
   toprak tonuna çekildi.

   Yuvarlak köşe sıfırlanıyor: panelin temel biçim kuralı bu ve tek
   değişkenle uygulanabiliyor.

   Yazı tipi DEĞİŞMİYOR. Panelin yazı tipleri üst belgeye yüklenmiş;
   font-face belge kapsamlı olduğu için çerçeve onları kullanamıyor.
   Aynı dosyaları buraya ikinci kez yüklemek sayfayı ağırlaştırırdı. */

const TEMA = `
  /* ============ Karas Panel teması ============ */
  :root{
    --bg:#f2f0e9; --card:#faf9f6; --ink:#1a1a1a; --muted:#5c5952;
    --line:#ddd9d0;
    --blue:#b8420f;   /* ana eylem: panelin turuncusu */
    --green:#2f6f4e; --red:#a32b1c; --amber:#9a6b12;
    --teal:#356b62; --purple:#6d4b63;
    --radius:0px;     /* panelde yuvarlak köşe yok */
  }

  body.dark{
    --bg:#14140f; --card:#1c1c17; --ink:#ebe8e0; --muted:#a8a49a;
    --line:#33332c;
    --blue:#e9683a; --green:#5aa87d; --red:#e0705f; --amber:#d3a445;
    --teal:#6aa79c; --purple:#a888b4;
  }

  /* Değişkene bağlı olmayan sabit renkler — soğuk gri tonlarıydı,
     panelin sıcak paletiyle çakışıyordu. */
  header{background:#1a1a1a;color:#faf9f6}
  header .date{color:#a8a49a}
  .btn-ghost{background:#33332c;color:#ebe8e0}
  .btn-ghost:hover{background:#4a4a40}
  th{background:#f2f0e9}
  .mini-btn:hover{background:#f2f0e9}
  .pbar{background:#e9e6dd;border-radius:0}
  .dot.gr{background:#c9c4b8}
  details.year-det>summary{background:#1a1a1a;color:#faf9f6}
  details.year-det>summary .ok,
  details.year-det>summary .ozet-txt{color:#a8a49a}
  details.year-det.eski>summary{background:#e9e6dd;color:#5c5952;border-radius:0}
  details.year-det.eski>summary .ok,
  details.year-det.eski>summary .ozet-txt{color:#6e6a62}
  details.year-det.eski>summary .tot{color:#5c5952}

  /* Rozetler: aynı anlam, panelin tonunda */
  .b-amber{background:#f5ecd8;color:#7a5410}
  .b-gray,.b-slate{background:#e9e6dd;color:#5c5952}
  .b-indigo{background:#e6e0ea;color:#5b3f6b}

  body.dark header{background:#0f0f0b}
  body.dark th,body.dark .tfoot td{background:#26261f}
  body.dark .mini-btn:hover{background:#26261f}
  body.dark .modal{background:#1c1c17}
  body.dark .pbar,body.dark .bar-row .track{background:#33332c}
  body.dark .btn-ghost{background:#26261f;color:#ebe8e0}
  body.dark details.year-det>summary{background:#26261f}
  body.dark details.year-det.eski>summary{background:#1c1c17;color:#a8a49a}
  body.dark .b-amber{background:#33291a;color:#d3a445}
  body.dark .b-gray,body.dark .b-slate{background:#26261f;color:#a8a49a}
  body.dark .b-indigo{background:#2a2430;color:#a888b4}

  /* Panelin üst çubuğunda zaten var olanlar: tema, çıkış, kullanıcı
     adı. Aynı şeyi iki kez göstermek yer kaplıyor ve hangisinin
     geçerli olduğunu belirsizleştiriyor. */
  #temaBtn,
  #cikisDugmesi,
  #kullaniciChip{display:none !important}
`;

if (s.includes(stilSonu)) {
	s = s.replace(stilSonu, TEMA + stilSonu);
	rapor.push('panel teması uygulandı (renkler + köşe)');
} else {
	rapor.push('⚠ stil bloğu bulunamadı — tema uygulanamadı');
}

/* ---------- 7. Temayı panelden al ---------- */
/* Çerçeve ayrı bir belge; panelin data-tema özniteliğini görmüyor.
   Aynı kaynaktan gömüldüğümüz için üst belge okunabiliyor — hem
   açılışta hem değiştiğinde. Tek başına açılırsa sistem tercihine
   düşüyor. */

const TEMA_BETIGI = `
<script>
(function () {
  function uygula() {
    var koyu;
    try {
      var t = window.parent.document.documentElement.getAttribute('data-tema');
      koyu = t === 'karanlik' ||
        (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch (e) {
      /* Üst belge okunamıyor: tek başına açılmış. */
      koyu = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (document.body) document.body.classList.toggle('dark', koyu);
  }

  uygula();
  document.addEventListener('DOMContentLoaded', uygula);
  window.addEventListener('load', uygula);

  try {
    new MutationObserver(uygula).observe(
      window.parent.document.documentElement,
      { attributes: true, attributeFilter: ['data-tema'] }
    );
  } catch (e) {}

  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', uygula);
})();
</` + `script>
`;

const govdeSonu = '</' + 'body>';
if (s.includes(govdeSonu)) {
	s = s.replace(govdeSonu, TEMA_BETIGI + govdeSonu);
	rapor.push('tema paneldeki seçimi izliyor');
} else {
	rapor.push('⚠ body sonu bulunamadı — tema izleyicisi eklenemedi');
}

/* ---------- Yaz ---------- */

fs.mkdirSync(path.dirname(HEDEF), { recursive: true });
fs.writeFileSync(HEDEF, BASLIK + s, 'utf8');

console.log('hedef:', HEDEF);
rapor.forEach((r) => console.log(' ·', r));
console.log('kalan ham /api/ :', (s.match(/["'`]\/api\/(?!otp)/g) || []).length);
console.log('boyut:', (fs.statSync(HEDEF).size / 1024).toFixed(0), 'KB');
