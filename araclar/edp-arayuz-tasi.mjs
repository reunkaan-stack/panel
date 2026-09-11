/* EXCEL DOSYA YÜKLEME PROGRAMI (edp) — panele taşıma betiği.

   Kaynak, Kaan'ın masaüstündeki tek dosyalık program. O dosyaya
   DOKUNULMUYOR; bu betik okuyup panele uygun sürümünü üretiyor:

     public/edp/uygulama.html   ← çerçevede açılan sayfa
     public/edp/uygulama.js     ← programın kendi kodu

   ⚠️ ÜRETİLEN DOSYALAR ELLE DÜZENLENMEZ. Değişiklik buraya adım
   olarak yazılır ve betik yeniden çalıştırılır. ÖTP'de de böyle
   yapıldı; sebebi, kaynak program güncellenince değişikliklerin
   kaybolmaması.

   Çalıştırma: node araclar/edp-arayuz-tasi.mjs
*/

import fs from 'node:fs';
import path from 'node:path';

const KAYNAK =
	'C:/Users/kaan/Desktop/İşletme Programları/pdf to excel - Kopya/PDF-Dia-Donusturucu13.08.2026.html';

const HEDEF_DIZIN = path.join(process.cwd(), 'public', 'edp');
const HEDEF_HTML = path.join(HEDEF_DIZIN, 'uygulama.html');
const HEDEF_JS = path.join(HEDEF_DIZIN, 'uygulama.js');

const BASLIK = `<!-- Karas Panel'e taşındı — ELLE DÜZENLEME.
     Kaynak: masaüstündeki PDF-Dia-Donusturucu HTML dosyası.
     Üreten: araclar/edp-arayuz-tasi.mjs -->
`;

const rapor = [];
let s = fs.readFileSync(KAYNAK, 'utf8');


/* ---------- 1. Kütüphaneler panelden ---------- */
/* Program pdf.js ve SheetJS'i cdnjs'ten çekiyordu; kendi haritası da
   "İnternet gerekli" diye sınır olarak yazmış. CDN'e erişilemediği
   anda program sessizce açılmıyor: PDF okunmuyor, Excel üretilmiyor
   ve sebebi ekranda görünmüyor. Dosyalar public/edp/kutuphane
   altına indirildi. */

const kutuphaneler = [
	{
		bul: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
		koy: '/edp/kutuphane/pdf.min.js',
	},
	{
		bul: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
		koy: '/edp/kutuphane/xlsx.full.min.js',
	},
	{
		bul: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
		koy: '/edp/kutuphane/pdf.worker.min.js',
	},
];

let kutuphaneSayaci = 0;
for (const k of kutuphaneler) {
	if (s.includes(k.bul)) {
		s = s.split(k.bul).join(k.koy);
		kutuphaneSayaci++;
	}
}
rapor.push(kutuphaneSayaci + ' kütüphane panele alındı (CDN bağımlılığı yok)');


/* ---------- 2. Program kodu ayrı dosyaya ---------- */
/* Ayarlar sunucudan geliyor ve bu bekleme gerektiriyor; program ise
   açılır açılmaz ayarları okuyor. Kodu ayrı dosyaya alıp ayarlar
   geldikten SONRA yüklüyoruz. Böylece programın kendi başlangıç
   mantığına hiç dokunulmuyor.

   new Function ile çalıştırmak da mümkündü ama hata satır numaraları
   anlamsızlaşırdı; ayrı dosyada yığın izi doğru kalıyor. */

const betikBasi = s.lastIndexOf('<script>');
const betikSonu = s.lastIndexOf('</' + 'script>');
if (betikBasi < 0 || betikSonu < betikBasi) {
	throw new Error('Ana betik bulunamadı');
}

let js = s.slice(betikBasi + '<script>'.length, betikSonu);
s = s.slice(0, betikBasi) + '@@BETIK@@' + s.slice(betikSonu + ('</' + 'script>').length);
rapor.push('program kodu uygulama.js dosyasına ayrıldı');


/* ---------- 3. Ayarlar tarayıcıdan sunucuya ---------- */
/* Program ayarları localStorage'da tutuyordu: ikinci bilgisayardan
   girince anlaşma oranları ve öğrenilmiş kolon eşlemesi yok oluyordu.
   Artık firmaya bağlı tabloda.

   localStorage TAMAMEN kaldırılmadı, önbellek olarak duruyor: sunucu
   yanıtı gelmeden önce program açılırsa son bilinen ayarla açılsın.

   Kaydetme geciktirilerek yapılıyor — canlı fiyat kutuları her tuşta
   kaydediyor, her tuşta sunucuya yazmak gereksiz. */

const KAYDETME_YARDIMCISI = `

/* ---- Panel eklentisi: ayarları sunucuya yaz ---- */
/* Bu fonksiyon AYNI DOSYADA olmak zorunda: cfg "let" ile tanımlı ve
   üst seviye let/const global nesneye yazılmaz, yani ayrı bir betik
   etiketinden görülemez. */
var edpKayitZamani = null;
function ayarlariKaydet() {
  try { localStorage.setItem('diaCfg', JSON.stringify(cfg)); } catch (e) {}

  clearTimeout(edpKayitZamani);
  edpKayitZamani = setTimeout(function () {
    fetch('/api/edp/ayarlar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    })
      .then(function (cevap) {
        if (!cevap.ok) {
          console.error('[edp] ayarlar kaydedilemedi', cevap.status);
          toast('Ayarlar kaydedilemedi — yetkiniz olmayabilir');
        }
      })
      .catch(function (e) {
        console.error('[edp] ayarlar kaydedilemedi', e);
        toast('Ayarlar kaydedilemedi — bağlantı yok');
      });
  }, 600);
}
`;

const kayitCagrilari = [
	'localStorage.setItem("diaCfg",JSON.stringify(cfg));',
	"localStorage.setItem('diaCfg',JSON.stringify(cfg));",
];
let kayitSayaci = 0;
for (const cagri of kayitCagrilari) {
	while (js.includes(cagri)) {
		js = js.replace(cagri, 'ayarlariKaydet();');
		kayitSayaci++;
	}
}
js = js + KAYDETME_YARDIMCISI;
rapor.push(kayitSayaci + ' ayar kaydı sunucuya yönlendirildi');


/* ---------- 4. Açılışta ayarları sunucudan al ---------- */

const ONYUKLEYICI = `
<` + `script>
/* Ayarlar sunucudan alınıp localStorage'a yazılıyor, SONRA program
   yükleniyor. Sıra önemli: program açılır açılmaz localStorage'ı
   okuyor. */
(function () {
  function baslat() {
    var b = document.createElement('script');
    b.src = '/edp/uygulama.js';
    document.body.appendChild(b);
  }

  fetch('/api/edp/ayarlar', { headers: { Accept: 'application/json' } })
    .then(function (cevap) {
      if (!cevap.ok) throw new Error('ayarlar alınamadı: ' + cevap.status);
      return cevap.json();
    })
    .then(function (ayar) {
      localStorage.setItem('diaCfg', JSON.stringify(ayar));
    })
    .catch(function (e) {
      /* Sessiz kalınmıyor: ayarsız açılırsa tedarikçi oranları ve
         kolon eşlemesi boş gelir, kullanıcı sebebini bilmeli. */
      console.error('[edp] ayarlar alınamadı', e);
    })
    .finally(baslat);
})();
</` + `script>
`;

s = s.replace('@@BETIK@@', ONYUKLEYICI);
rapor.push('açılışta ayarlar sunucudan alınıyor');


/* ---------- 5. Karas teması ---------- */
/* Program koyu, soğuk mavi bir palet kullanıyordu. Panelin sıcak
   paleti uygulanıyor ve yuvarlak köşeler sıfırlanıyor — panelde
   yuvarlak köşe yok. */

const TEMA = `
  /* ============ Karas Panel teması ============ */
  :root{
    --bg:#f2f0e9; --panel:#faf9f6; --panel2:#efece4; --line:#ddd9d0;
    --text:#1a1a1a; --muted:#5c5952;
    --accent:#b8420f; --accent2:#b8420f;
    --edit:#6b4c00; --editbg:#f7efd6;
    --ok:#2f6f4e; --ro:#f2f0e9;
  }
  body.dark{
    --bg:#14140f; --panel:#1c1c17; --panel2:#232320; --line:#33332c;
    --text:#ebe8e0; --muted:#a8a49a;
    --accent:#e9683a; --accent2:#c2551f;
    --edit:#f0d49a; --editbg:#332b14;
    --ok:#5aa87d; --ro:#191915;
  }

  /* Köşeler: panelin tamamında yuvarlak köşe yok. Değişkene bağlı
     olmadıkları için tek tek sıfırlanıyor. */
  input[type=text],input[type=date],input[type=number],select,
  .seg,.btn,#drop,#settings,#xlmap,#verify,.pill,.toast,
  #verify .chk,td.editcell input{border-radius:0}

  /* Düğme metni: turuncu zeminde koyu metin okunmuyordu. */
  .btn{color:#faf9f6}
  .seg button.on{color:#faf9f6}
  .toast{background:var(--ok);color:#faf9f6}

  /* Başlık panele dönüş bağlantısı */
  header h1 a{color:inherit;text-decoration:none}
  header h1 a:hover{color:var(--accent)}
`;

const stilSonu = '</' + 'style>';
if (s.includes(stilSonu)) {
	s = s.replace(stilSonu, TEMA + stilSonu);
	rapor.push('panel teması uygulandı');
} else {
	rapor.push('⚠ stil sonu bulunamadı — tema eklenemedi');
}


/* ---------- 6. Tema panelden izleniyor ---------- */

const TEMA_BETIGI = `
<` + `script>
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


/* ---------- 7. Başlık panele dönüyor ---------- */
/* Çerçeve içindeyken panele dönmenin görünür bir yolu olsun. ÖTP'de
   de "Takip Paneli" yazısı aynı işi görüyor. */

const baslikEski = '<h1>PDF → Dia Excel Dönüştürücü</h1>';
const baslikYeni =
	'<h1><a href="/" target="_top" title="Panele dön">' +
	'Excel Dosya Yükleme Programı</a></h1>';

if (s.includes(baslikEski)) {
	s = s.replace(baslikEski, baslikYeni);
	rapor.push('başlık panele dönüş bağlantısı oldu');
} else {
	rapor.push('⚠ başlık bulunamadı');
}

s = s.replace(
	'<title>PDF → Dia Excel Dönüştürücü</title>',
	'<title>Excel Dosya Yükleme Programı — Karas Panel</title>'
);


/* ---------- Yaz ---------- */

fs.mkdirSync(HEDEF_DIZIN, { recursive: true });
fs.writeFileSync(HEDEF_HTML, BASLIK + s, 'utf8');
fs.writeFileSync(HEDEF_JS, js, 'utf8');

console.log('hedef:', HEDEF_HTML);
rapor.forEach((r) => console.log(' ·', r));
console.log(
	'kalan cdnjs bağlantısı :',
	(s.match(/cdnjs/g) || []).length + (js.match(/cdnjs/g) || []).length
);
console.log(
	'boyut: html',
	(fs.statSync(HEDEF_HTML).size / 1024).toFixed(0) + ' KB · js',
	(fs.statSync(HEDEF_JS).size / 1024).toFixed(0) + ' KB'
);
