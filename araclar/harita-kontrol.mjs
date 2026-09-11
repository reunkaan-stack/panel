/* HARİTA SAPMA DENETİMİ.

   lib/harita/veri.ts ile gerçek kodu karşılaştırır. Amaç tek soru:
   "harita güncel mi" sorusunun cevabını insana değil koda sordurmak.

   Kurumsal sitede "değişiklik yapınca haritayı güncelle" kuralı
   yazılıydı ve harita yine de aylarca bayatladı. Kural yetmiyor.

   ÇIKIŞ KODU:
     0 → harita güncel (ya da yalnızca fazlalık var)
     1 → HARİTADA EKSİK var: kodda olan bir şey haritaya yazılmamış

   Fazlalık (haritada olup kodda olmayan) yalnızca uyarı: planlanan
   ama henüz yazılmamış bir şey olabilir.

   Çalıştırma: node araclar/harita-kontrol.mjs   (npm run kontrol içinde) */

import fs from 'node:fs';
import path from 'node:path';

const KOK = process.cwd();
const HARITA = path.join(KOK, 'lib', 'harita', 'veri.ts');

const kirmizi = (s) => `\x1b[31m${s}\x1b[0m`;
const sari = (s) => `\x1b[33m${s}\x1b[0m`;
const yesil = (s) => `\x1b[32m${s}\x1b[0m`;
const soluk = (s) => `\x1b[2m${s}\x1b[0m`;

if (!fs.existsSync(HARITA)) {
	console.error(kirmizi('✗ lib/harita/veri.ts yok.'));
	process.exit(1);
}

const harita = fs.readFileSync(HARITA, 'utf8');

/* Haritadaki yol: ve ad: alanları. TypeScript'i ayrıştırmak yerine
   metinden okunuyor — betik tek bir dosyaya bakıyor ve o dosyanın
   biçimi elimizde. Ayrıştırıcı eklemek bu iş için fazla. */
const haritadakiYollar = new Set(
	[...harita.matchAll(/^\s*yol:\s*'([^']+)'/gm)].map((m) => m[1])
);
const haritadakiAdlar = new Set(
	[...harita.matchAll(/^\s*ad:\s*'([^']+)'/gm)].map((m) => m[1])
);

/* ---------- Kodda ne var ---------- */

function dosyalariBul(dizin, sonEk, biriktir = []) {
	if (!fs.existsSync(dizin)) return biriktir;
	for (const girdi of fs.readdirSync(dizin, { withFileTypes: true })) {
		const tam = path.join(dizin, girdi.name);
		if (girdi.isDirectory()) {
			if (girdi.name === 'node_modules' || girdi.name === '.next') continue;
			dosyalariBul(tam, sonEk, biriktir);
		} else if (girdi.name === sonEk || (sonEk.startsWith('.') && girdi.name.endsWith(sonEk))) {
			biriktir.push(path.relative(KOK, tam).split(path.sep).join('/'));
		}
	}
	return biriktir;
}

const sayfalar = dosyalariBul(path.join(KOK, 'app'), 'page.tsx');
const uclar = dosyalariBul(path.join(KOK, 'app', 'api'), 'route.ts');
const eylemler = dosyalariBul(path.join(KOK, 'app'), 'eylemler.ts');

/* Kodun gerçekten sorguladığı tablolar ve çağırdığı işlevler.
   Migration'daki tablo listesi değil: ölü tablolar da orada. */
function tumKaynak() {
	const dosyalar = [
		...dosyalariBul(path.join(KOK, 'app'), '.ts'),
		...dosyalariBul(path.join(KOK, 'app'), '.tsx'),
		...dosyalariBul(path.join(KOK, 'lib'), '.ts'),
	];
	return dosyalar.map((d) => fs.readFileSync(path.join(KOK, d), 'utf8')).join('\n');
}
const kaynak = tumKaynak();

const tablolar = new Set([...kaynak.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]));
const islevler = new Set([...kaynak.matchAll(/\.rpc\('([a-z_]+)'/g)].map((m) => m[1]));

/* ---------- Karşılaştır ---------- */

const eksikler = [];
const uyarilar = [];

function yolDenetle(liste, etiket) {
	for (const yol of liste) {
		if (!haritadakiYollar.has(yol)) eksikler.push(`${etiket}: ${yol}`);
	}
}

yolDenetle(sayfalar, 'Ekran haritada yok');
yolDenetle(uclar, 'API ucu haritada yok');
yolDenetle(eylemler, 'Sunucu eylemi haritada yok');

/* Bileşenler de envanterde olmalı. Diyagrama konmuyorlar ama
   listeden düşmemeliler: "bu ekranı kim çiziyor" sorusunun cevabı
   kodu taramakla değil haritaya bakmakla bulunmalı. */
const bilesenDosyalari = [
	...dosyalariBul(path.join(KOK, 'app'), '.tsx'),
	...dosyalariBul(path.join(KOK, 'bilesenler'), '.tsx'),
].filter((d) => !d.endsWith('/page.tsx') && !d.endsWith('/layout.tsx'));

for (const d of bilesenDosyalari) {
	if (!harita.includes("'" + d + "'")) {
		eksikler.push('Bileşen haritada yok: ' + d);
	}
}

/* lib/ modülleri de haritada olmalı. Bunlar ortak mantığın durduğu
   yer; haritada yoksa bir sonraki oturum onları yeniden keşfeder.
   Üç tanesi tam böyle kaçmıştı: lib/surum.ts ve lib/ptp/kroki.ts
   kopya temizliğinde yeni yaratıldı, lib/supabase/ayar.ts ise
   baştan beri haritada yoktu. */
yolDenetle(
	dosyalariBul(path.join(KOK, 'lib'), '.ts'),
	'lib modülü haritada yok'
);

for (const t of tablolar) {
	if (!haritadakiAdlar.has(t)) eksikler.push(`Tablo haritada yok: ${t}`);
}
for (const f of islevler) {
	if (!haritadakiAdlar.has(f + '()')) eksikler.push(`Veritabanı işlevi haritada yok: ${f}()`);
}

/* Haritada yazılı ama diskte olmayan dosya: yanlış yol ya da silinmiş
   dosya. Bu da eksik sayılır — yanlış yol gösteren harita, harita
   olmamasından kötüdür. */
for (const yol of haritadakiYollar) {
	if (yol.startsWith('supabase/migrations/')) continue;
	if (!fs.existsSync(path.join(KOK, yol))) {
		eksikler.push(`Haritadaki yol diskte yok: ${yol}`);
	}
}

/* CANLI TABLO KÜMESİ.

   Migration'lar sırayla işlenip "şu an hangi tablolar var" hesaplanıyor:
   yaratılanlar eklenir, adı değişenler taşınır, düşürülenler çıkarılır.
   Sonra kodun .from() ile sorguladığı her ad bu kümede aranıyor.

   Neden: eski tasarımdan kalma adlar migration dosyalarında hâlâ
   geçiyor (ptp_gorev_kayitlari, ptp_personeller…). Kod aramasında
   çıkıyorlar, canlı sanılıyorlar ve yanlış tabloya sorgu yazılıyor.
   Bir kez yaşandı; tip denetimi bunu yakalayamaz çünkü Supabase
   istemcisi tiplenmemiş durumda — .from('herhangibirsey') derleniyor.

   Bu denetim, türler şemadan üretilip istemciler tiplenene kadar
   aynı işi görüyor. */
const migrationDizini = path.join(KOK, 'supabase', 'migrations');
const siraliMigrationlar = fs
	.readdirSync(migrationDizini)
	.filter((d) => d.endsWith('.sql'))
	/* Tarih önekliler önce geldi, numaralılar sonra. */
	.sort((a, b) => {
		const sayi = (d) => (d.startsWith('20') ? Number(d.slice(0, 8)) : 1e9 + Number(d));
		return sayi(a) - sayi(b);
	});

const canliTablolar = new Set();
const adDegisimi = new Map();
for (const dosya of siraliMigrationlar) {
	const icerik = fs.readFileSync(path.join(migrationDizini, dosya), 'utf8');

	/* TEK GEÇİŞ, DOSYA SIRASIYLA. Önce bütün create'ler sonra bütün
	   drop'lar işlenirse yanlış sonuç çıkıyor: 5_ içinde eski tablolar
	   ÖNCE düşürülüyor, sonra ptp_sablonlar onların adını alıyor.
	   Türe göre gruplanınca rename'i drop siliyordu. */
	const desen =
		/(create|drop|alter) table (?:if not exists |if exists )?panel[.]([a-z_]+)([^;]*rename to ([a-z_]+))?/gi;

	for (const m of icerik.matchAll(desen)) {
		const eylem = m[1].toLowerCase();
		const ad = m[2];
		const yeniAd = m[4];

		if (eylem === 'create') canliTablolar.add(ad);
		else if (eylem === 'drop') canliTablolar.delete(ad);
		else if (eylem === 'alter' && yeniAd) {
			canliTablolar.delete(ad);
			canliTablolar.add(yeniAd);
			/* Politikalar tabloyla birlikte taşınır; eski ada yazılmış
			   politikaları yeni ada devredebilmek için iz tutuluyor. */
			adDegisimi.set(ad, yeniAd);
		}
	}
}

for (const t of tablolar) {
	if (!canliTablolar.has(t)) {
		eksikler.push(
			`Kod olmayan tabloyu sorguluyor: ${t} — migration'larda yaratılmamış ya da düşürülmüş`
		);
	}
}

/* SABİT MODÜL LİSTESİ AVI.

   Modül listesi BEŞ ayrı yere kopyalanmıştı. Sonuncusu bir sunucu
   eyleminin içinde "const tumu = ['ptp','otp','ttp','mtp']" diye
   duruyordu; edp eklenince güncellenmedi ve firma modülü kaydedilmiş
   gibi görünüp hiç yazılmadı — "kaydedildi" mesajı yalan değildi,
   listedeki dört modül gerçekten yazılıyordu.

   Tür türetmesi bunu YAKALAMAZ: eksik bir alt küme de geçerli bir
   Modul[] dizisidir. Bu yüzden kalıbın kendisi aranıyor: aynı satırda
   iki ya da daha çok modül kodu geçiyorsa orada elle yazılmış bir
   liste vardır.

   Tek kaynak (lib/tipler.ts) ve harita dosyası muaf. */
const modulKodlari = [
	...fs
		.readFileSync(path.join(KOK, 'lib', 'tipler.ts'), 'utf8')
		.matchAll(/kod: '([a-z]{2,4})'/g),
].map((m) => m[1]);

const muafDosyalar = ['lib/tipler.ts', 'lib/harita/veri.ts'];

for (const dosya of [
	...dosyalariBul(path.join(KOK, 'app'), '.ts'),
	...dosyalariBul(path.join(KOK, 'app'), '.tsx'),
	...dosyalariBul(path.join(KOK, 'lib'), '.ts'),
]) {
	if (muafDosyalar.includes(dosya)) continue;

	const icerikSatirlari = fs
		.readFileSync(path.join(KOK, dosya), 'utf8')
		.split(String.fromCharCode(10));
	icerikSatirlari.forEach((satir, i) => {
		/* Yorum satırı kod değildir. Bu kontrolün kendi gerekçesini
		   anlatan yorumlar da modül kodlarını örnek olarak yazıyor;
		   onları yakalamak yanlış alarm olurdu. */
		const kirp = satir.trim();
		if (kirp.startsWith('//') || kirp.startsWith('*') || kirp.startsWith('/*')) return;

		const gecen = modulKodlari.filter((k) => satir.includes("'" + k + "'"));
		if (gecen.length >= 2) {
			eksikler.push(
				`Elle yazılmış modül listesi: ${dosya}:${i + 1} — ${gecen.join(', ')}. ` +
					'lib/tipler.ts içindeki MODULLER kullanılmalı.'
			);
		}
	});
}

/* RLS KAPSAMI.

   Bugün iki hata tam buradan çıktı:

     · denetim_kayitlari'nda RLS açıktı ama INSERT politikası hiç
       yazılmamıştı. On bir yerden yazılıyordu, hepsi sessizce
       reddediliyordu ve tablo aylarca boş kaldı. Postgres hata
       döndürmüyor, yalnızca sıfır satır etkiliyor.

     · kullanicilar'da son_giris aynı sınıftan bir sessizlik yaşadı.

   Burada aranan: RLS açık ama yazma yolu olmayan tablo. Okuma
   politikası olup yazma politikası olmaması çoğu zaman kasıt
   değil, unutmadır.

   BİLEREK YAZMASIZ olanlar aşağıda gerekçesiyle listeleniyor. */
const YAZMASIZ_TABLOLAR = {
	denetim_kayitlari:
		'Yazma panel.denetim_yaz() SECURITY DEFINER islevinden geciyor; ' +
		'kullanici kendi adina kayit dusemesin diye politika bilerek yok.',
};

const rlsAcik = new Set();
const politikalar = new Map(); // tablo -> Set(eylem)

for (const dosya of siraliMigrationlar) {
	const icerik = fs.readFileSync(path.join(migrationDizini, dosya), 'utf8');

	for (const m of icerik.matchAll(
		/alter table panel[.]([a-z_]+)[^;]*enable row level security/gi
	)) {
		rlsAcik.add(m[1]);
	}

	const ekle = (tablo, eylem) => {
		if (!politikalar.has(tablo)) politikalar.set(tablo, new Set());
		politikalar.get(tablo).add(eylem.toLowerCase());
	};

	/* Doğrudan yazılmış politikalar */
	for (const m of icerik.matchAll(
		/create policy [a-z_]+ on panel[.]([a-z_]+) for ([a-z]+)/gi
	)) {
		ekle(m[1], m[2]);
	}

	/* DÖNGÜYLE ÜRETİLENLER. Politikalar tek tek yazılmak yerine
	   "foreach t in array array['a','b'] loop ... create policy
	   %1$s_okuma on panel.%1$s for select" biçiminde üretiliyor.
	   Tablo adı yerinde yer tutucu olduğu için düz metin taraması
	   bunları göremiyor ve sekiz tablo politikasızmış gibi
	   görünüyordu — dördü yanlış alarm olarak çıktı. */
	const donguEylemleri = [
		...icerik.matchAll(/create policy %1[$]s_[a-z_]+ on panel[.]%1[$]s for ([a-z]+)/gi),
	].map((m) => m[1]);

	if (donguEylemleri.length) {
		for (const dizi of icerik.matchAll(/foreach [a-z]+ in array array[[](.+?)]/gis)) {
			const tablolar = [...dizi[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
			for (const t of tablolar) {
				for (const e of donguEylemleri) ekle(t, e);
			}
		}
	}
}

/* Eski ada yazılmış politikaları ve RLS bayrağını yeni ada devret. */
for (const [eski, yeni] of adDegisimi) {
	if (politikalar.has(eski)) {
		const birlesik = politikalar.get(yeni) ?? new Set();
		for (const e of politikalar.get(eski)) birlesik.add(e);
		politikalar.set(yeni, birlesik);
	}
	if (rlsAcik.has(eski)) rlsAcik.add(yeni);
}

for (const tablo of canliTablolar) {
	if (!rlsAcik.has(tablo)) {
		eksikler.push('RLS KAPALI: ' + tablo + ' — firma verisi korumasiz.');
		continue;
	}
	if (YAZMASIZ_TABLOLAR[tablo]) continue;

	const eylemler2 = politikalar.get(tablo) ?? new Set();
	const yazabilir =
		eylemler2.has('all') || eylemler2.has('insert') || eylemler2.has('update');

	if (!yazabilir) {
		uyarilar.push(
			'RLS acik ama YAZMA POLITIKASI YOK: ' +
				tablo +
				' — kod bu tabloya yaziyorsa sessizce sifir satir etkiler.'
		);
	}
}

/* Bildirim olayları haritada olmalı: yeni modül olay ekleyip
   haritaya yazmazsa "bu bildirim nereden geliyor" sorusu kodda
   aranır. */
const olaylar = [
	...fs
		.readFileSync(path.join(KOK, 'lib', 'bildirim', 'katalog.ts'), 'utf8')
		.matchAll(/kod: '([a-z]+[.][a-z_]+)'/g),
].map((m) => m[1]);

/* Katalogdaki ornek yorumu ayni kodu tekrar ediyor. */
for (const olay of new Set(olaylar)) {
	if (!harita.includes(olay)) {
		eksikler.push('Bildirim olayi haritada yok: ' + olay);
	}
}

/* Migration numaralarında boşluk: sıra karışıklığı erken görünsün. */
const migrationlar = fs
	.readdirSync(path.join(KOK, 'supabase', 'migrations'))
	.map((d) => d.match(/^(\d+)_/))
	.filter(Boolean)
	.map((m) => Number(m[1]))
	/* Tarih önekli ilk kurulum dosyaları (20260820_…) sıralı numara
	   değil; 21 → 20260820 diye sahte boşluk üretiyorlardı. */
	.filter((n) => n < 1000)
	.sort((a, b) => a - b);
for (let i = 1; i < migrationlar.length; i++) {
	const fark = migrationlar[i] - migrationlar[i - 1];
	if (fark > 1) {
		uyarilar.push(
			`Migration numarası atlanmış: ${migrationlar[i - 1]} → ${migrationlar[i]}`
		);
	}
}

/* ---------- Rapor ---------- */

console.log(soluk('harita denetimi — lib/harita/veri.ts'));
console.log(
	soluk(
		`  ${sayfalar.length} ekran · ${uclar.length} uç · ${eylemler.length} eylem · ` +
			`${tablolar.size} tablo · ${islevler.size} işlev`
	)
);

for (const u of uyarilar) console.log(sari(`  ! ${u}`));

if (eksikler.length === 0) {
	console.log(yesil('  ✓ harita güncel'));
	process.exit(0);
}

console.log(kirmizi(`\n  ✗ haritada ${eksikler.length} eksik:`));
for (const e of eksikler) console.log(kirmizi(`    · ${e}`));
console.log(
	soluk('\n  lib/harita/veri.ts dosyasına ekle, sonra tekrar çalıştır.\n')
);
process.exit(1);
