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

  /* Geçmiş aylar: yıl bloğunun altında, tek satır. Açılınca içindeki
     aylar normal görünümüne dönüyor. */
  details.gecmis-kutu{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}
  details.gecmis-kutu>summary{
    cursor:pointer;list-style:none;
    font-size:12px;font-weight:600;letter-spacing:.04em;
    color:var(--muted);padding:4px 0;user-select:none;
  }
  details.gecmis-kutu>summary::-webkit-details-marker{display:none}
  details.gecmis-kutu>summary::before{content:"▸ ";display:inline-block;transition:transform .15s}
  details.gecmis-kutu[open]>summary::before{content:"▾ "}
  details.gecmis-kutu>summary:hover{color:var(--ink)}
  details.gecmis-kutu>details.month-det{margin-top:8px}

  /* Gecikmiş ödemesi olan geçmiş ay yerinde kalıyor ve göze çarpıyor:
     vadesi geçmiş bir borç, bu ayın işlerinden daha acil. */
  details.month-det.gecikmis-ay>summary{
    border-left:3px solid var(--red);
    padding-left:11px;
  }

  /* Kredi özeti */
  .kredi-ozet-bas{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .kredi-ozet-baslik{
    font-size:12px;font-weight:700;letter-spacing:.08em;
    text-transform:uppercase;color:var(--muted);
  }
  .kredi-ozet-yil{
    margin-left:auto;padding:5px 10px;font-family:inherit;font-size:13px;
    font-weight:600;background:var(--card);color:var(--ink);
    border:1px solid var(--line);border-radius:0;cursor:pointer;
  }
  .kredi-ozet-kutular{
    display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
    gap:1px;background:var(--line);border:1px solid var(--line);
  }
  .kredi-ozet-kart{background:var(--card);padding:12px 14px}
  .kredi-ozet-kart.vurgu .ko-deger{color:var(--amber)}
  .ko-ad{
    display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;
    color:var(--muted);
  }
  .ko-deger{display:block;margin-top:6px;font-size:17px;font-weight:700}
  .ko-alt{display:block;margin-top:3px;font-size:11.5px;color:var(--muted)}
  .kredi-ozet-not{
    margin:12px 0 0;font-size:12px;line-height:1.6;color:var(--muted);
  }
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


/* ---------- 8. DIA yükleme düğmesi panele yönlendiriyor ---------- */
/* İçe aktarma artık panelin kendi sayfasında: kolon eşleme arayüzü ve
   önizleme listesi için gereken yer bu HTML'in içinde yoktu. Düğme
   üst pencereyi oraya götürüyor. */

const diaAktarimBaglantisi = [
	{
		bul: `onclick="document.getElementById('diaFile').click()"`,
		koy: `onclick="window.parent.location.href = '/otp/aktarim'"`,
		not: 'DIA yükleme düğmesi panel sayfasına yönlendiriyor',
	},
];

for (const k of diaAktarimBaglantisi) {
	if (s.includes(k.bul)) {
		s = s.replace(k.bul, k.koy);
		rapor.push(k.not);
	} else {
		rapor.push('⚠ bulunamadı: ' + k.not);
	}
}

/* ---------- 9. Aylık görünüm bu aydan başlasın ---------- */
/* Geçmiş aylar kapalı geliyordu ama LİSTENİN ÜSTÜNDE duruyordu:
   eylüldeyken ocak, şubat, mart… hepsini geçip aşağı kaydırmak
   gerekiyordu.

   Geçmiş aylar yıl bloğunun altına, tek satırlık katlanmış bir
   başlığın arkasına alınıyor. Silinmiyorlar — geçmişe bakmak
   gerektiğinde bir tıkla açılıyor.

   renderAylik veri her değiştiğinde içeriği baştan yazdığı için
   fonksiyon sarmalanıyor; sonradan DOM'a müdahale eden bir izleyici
   kurmaktan daha az kırılgan. */

const AYLIK_BETIGI = `
<script>
(function () {
  var asil = window.renderAylik;
  if (typeof asil !== 'function') return;

  window.renderAylik = function () {
    asil.apply(this, arguments);
    try { gecmisiAltaAl(); } catch (e) {}
  };

  function gecmisiAltaAl() {
    var bolum = document.getElementById('tab-aylik');
    if (!bolum) return;

    bolum.querySelectorAll('details.year-det').forEach(function (yil) {
      var ic = yil.querySelector('.yinner') || yil;
      var gecmisler = ic.querySelectorAll(':scope > details.month-det.gecmis');
      if (!gecmisler.length) return;

      /* Gecikmiş ödemesi olan ay TOPLANMIYOR: vadesi geçmiş ve hâlâ
         ödenmemiş bir borç, bu ayın işlerinden daha acil. Ölçüt ay
         başlığındaki kırmızı "N geciken" rozeti. */
      var toplanacak = [];
      gecmisler.forEach(function (ay) {
        var geciken = ay.querySelector(':scope > summary .badge.b-red');
        if (geciken) {
          ay.classList.add('gecikmis-ay');
        } else {
          toplanacak.push(ay);
        }
      });

      if (!toplanacak.length) return;

      var kutu = document.createElement('details');
      kutu.className = 'gecmis-kutu';

      var baslik = document.createElement('summary');
      baslik.textContent = 'Geçmiş aylar (' + toplanacak.length + ')';
      kutu.appendChild(baslik);

      toplanacak.forEach(function (ay) { kutu.appendChild(ay); });
      ic.appendChild(kutu);
    });
  }
})();
</` + `script>
`;

if (s.includes(govdeSonu)) {
	s = s.replace(govdeSonu, AYLIK_BETIGI + govdeSonu);
	rapor.push('aylık görünümde geçmiş aylar alta toplandı');
} else {
	rapor.push('⚠ body sonu bulunamadı — aylık düzenleme eklenemedi');
}

/* ---------- 10. Kredi özeti: ödenen faiz ve kalan borcun dağılımı ---------- */
/* "Bu zamana kadar ne kadar faiz ödedim" sorusunun doğal sınırı YIL.
   Faiz muhasebede gider ve yıllık raporlanıyor; bütün yılları toplamak
   sürekli büyüyen, karar verdirmeyen bir sayı üretiyor. Yıl bazında
   karşılaştırılabiliyor: geçen yıl ne, bu yıl ne.

   ⚠️ Ödeme TARİHİ tutulmuyor, elimizde yalnızca taksidin VADESİ var.
   Yıl ayrımı vadeye göre yapılıyor; düzenli ödenen bir kredide ikisi
   aynı aya düşer, gecikmeli ödemede fark eder. Ekranda da yazıyor.

   Kısmi ödenmiş taksitte anapara/faiz oranla bölünüyor: yarısı
   ödenmişse faizin de yarısı ödenmiş sayılıyor. Tümünü ödenmiş ya da
   ödenmemiş saymak iki uçta da yanlış rakam verirdi. */

const KREDI_BETIGI = `
<script>
(function () {
  var asil = window.renderKrediler;
  if (typeof asil !== 'function') return;

  var secilenYil = null;

  window.renderKrediler = function () {
    asil.apply(this, arguments);
    try { ozetiKoy(); } catch (e) {}
  };

  function taksitler() {
    var hepsi = [];
    (window.DB && DB.krediler ? DB.krediler : []).forEach(function (k) {
      (k.taksitler || []).forEach(function (t) { hepsi.push(t); });
    });
    return hepsi;
  }

  function oran(t) {
    if (!t.tutar || t.tutar <= 0) return 0;
    var o = (t.odenen || 0) / t.tutar;
    return o < 0 ? 0 : o > 1 ? 1 : o;
  }

  function hesapla(yil) {
    var t = taksitler();
    var o = {
      yilFaiz: 0, yilBsmv: 0, yilAnapara: 0,
      tumFaiz: 0,
      kalan: 0, kalanAnapara: 0, kalanFaiz: 0, kalanBsmv: 0,
      yillar: {},
    };

    t.forEach(function (x) {
      var od = oran(x);
      var kal = 1 - od;
      var y = String(x.vade || '').slice(0, 4);

      var faiz = x.faiz || 0, bsmv = x.bsmv || 0, ana = x.anapara || 0;

      o.tumFaiz += faiz * od;
      if (y) o.yillar[y] = (o.yillar[y] || 0) + faiz * od;

      if (y === yil) {
        o.yilFaiz += faiz * od;
        o.yilBsmv += bsmv * od;
        o.yilAnapara += ana * od;
      }

      o.kalan += x.kalan || 0;
      o.kalanAnapara += ana * kal;
      o.kalanFaiz += faiz * kal;
      o.kalanBsmv += bsmv * kal;
    });

    /* Bazı taksitlerde tutar, anapara + faiz + BSMV toplamından
       büyük çıkıyor: DIA'nın ayrı kolonda verdiği KKDF gibi bir kalem
       yerel programa hiç alınmamış. Farkı yutmak yerine gösteriyoruz;
       yoksa dört rakam toplanınca tutmuyor ve güven kayboluyor. */
    o.kalanDiger = o.kalan - o.kalanAnapara - o.kalanFaiz - o.kalanBsmv;

    return o;
  }

  function ozetiKoy() {
    var bolum = document.getElementById('tab-krediler');
    if (!bolum || !taksitler().length) return;

    var eski = bolum.querySelector('.kredi-ozet');
    if (eski) eski.remove();

    var buYil = new Date().getFullYear().toString();
    var h = hesapla(secilenYil || buYil);
    var yillar = Object.keys(h.yillar).filter(function (y) {
      return h.yillar[y] > 0.5;
    }).sort().reverse();
    if (yillar.indexOf(buYil) === -1) yillar.unshift(buYil);
    var aktifYil = secilenYil || buYil;

    var p = function (n) { return para(Math.round(n)); };

    var kutu = document.createElement('div');
    kutu.className = 'panel kredi-ozet';
    kutu.innerHTML =
      '<div class="kredi-ozet-bas">' +
        '<span class="kredi-ozet-baslik">Kredi özeti</span>' +
        '<select class="kredi-ozet-yil">' +
          yillar.map(function (y) {
            return '<option value="' + y + '"' +
              (y === aktifYil ? ' selected' : '') + '>' + y + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="kredi-ozet-kutular">' +
        kart(aktifYil + ' yılı ödenen faiz', p(h.yilFaiz),
             h.yilBsmv > 0.5 ? '+ ' + p(h.yilBsmv) + ' BSMV' : '', true) +
        kart('Kalan borç', p(h.kalan), '') +
        kart('Kalanın anaparası', p(h.kalanAnapara), '') +
        kart('Kalanın faizi', p(h.kalanFaiz),
             h.kalanBsmv > 0.5 ? '+ ' + p(h.kalanBsmv) + ' BSMV' : '') +
      '</div>' +
      '<p class="kredi-ozet-not">' +
        'Tüm yıllarda ödenen faiz: <b>' + p(h.tumFaiz) + '</b>' +
        ' · ' + aktifYil + ' yılında ödenen anapara: <b>' + p(h.yilAnapara) + '</b>' +
        (h.kalanBsmv > 0.5 || Math.abs(h.kalanDiger) > 0.5
          ? '<br>Kalanın geri kalanı: ' +
            (h.kalanBsmv > 0.5 ? p(h.kalanBsmv) + ' BSMV' : '') +
            (h.kalanBsmv > 0.5 && Math.abs(h.kalanDiger) > 0.5 ? ' · ' : '') +
            (Math.abs(h.kalanDiger) > 0.5
              ? p(h.kalanDiger) + ' diğer (KKDF vb. — DIA raporunda ayrı kolonda)'
              : '')
          : '') +
        '<br>Ödeme tarihi tutulmadığı için yıl ayrımı taksidin vadesine göre yapılır.' +
      '</p>';

    kutu.querySelector('.kredi-ozet-yil').addEventListener('change', function (e) {
      secilenYil = e.target.value;
      ozetiKoy();
    });

    bolum.insertBefore(kutu, bolum.firstChild);
  }

  function kart(ad, deger, alt, vurgu) {
    return '<div class="kredi-ozet-kart' + (vurgu ? ' vurgu' : '') + '">' +
      '<span class="ko-ad">' + ad + '</span>' +
      '<span class="ko-deger">' + deger + '</span>' +
      (alt ? '<span class="ko-alt">' + alt + '</span>' : '') +
      '</div>';
  }
})();
</` + `script>
`;

if (s.includes(govdeSonu)) {
	s = s.replace(govdeSonu, KREDI_BETIGI + govdeSonu);
	rapor.push('kredi özeti eklendi (ödenen faiz + kalan borcun dağılımı)');
} else {
	rapor.push('⚠ body sonu bulunamadı — kredi özeti eklenemedi');
}

/* ---------- Yaz ---------- */

fs.mkdirSync(path.dirname(HEDEF), { recursive: true });
fs.writeFileSync(HEDEF, BASLIK + s, 'utf8');

console.log('hedef:', HEDEF);
rapor.forEach((r) => console.log(' ·', r));
console.log('kalan ham /api/ :', (s.match(/["'`]\/api\/(?!otp)/g) || []).length);
console.log('boyut:', (fs.statSync(HEDEF).size / 1024).toFixed(0), 'KB');
