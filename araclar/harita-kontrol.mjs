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
