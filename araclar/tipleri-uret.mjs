/* SATIR TÜRLERİNİ ŞEMADAN ÜRET.

   Çıktı lib/veritabani.ts dosyasına yazılır — lib/tipler.ts'e DEĞİL.
   O dosyada alan türleri ve Türkçe arayüz etiketleri var; üzerine
   yazmak paneli onlarca yerden derlenmez hale getirir. Eskiden
   yorumda öyle yazıyordu, düzeltildi.

   GEREKENLER:
     1. Supabase kişisel erişim jetonu
        supabase.com/dashboard/account/tokens → yeni jeton
     2. Jeton kabuğa verilir — DEPOYA YAZILMAZ, SOHBETE YAZILMAZ:
          Windows PowerShell : $env:SUPABASE_ACCESS_TOKEN = "..."
          Git Bash           : export SUPABASE_ACCESS_TOKEN="..."
     3. npm run tipler

   Proje kimliği NEXT_PUBLIC_SUPABASE_URL'den çıkarılıyor; o da yoksa
   SUPABASE_PROJE_REF ortam değişkeninden okunuyor.

   ÜRETİLEN DOSYA DEPOYA GİRER: Vercel derlerken jeton yok, dosyanın
   hazır durması gerekiyor. */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const kirmizi = (s) => `\x1b[31m${s}\x1b[0m`;
const yesil = (s) => `\x1b[32m${s}\x1b[0m`;
const soluk = (s) => `\x1b[2m${s}\x1b[0m`;

const HEDEF = 'lib/veritabani.ts';

function projeKimligi() {
	if (process.env.SUPABASE_PROJE_REF) return process.env.SUPABASE_PROJE_REF;

	const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
	const m = url.match(/https:[/][/]([a-z0-9]+)[.]supabase[.]co/i);
	return m ? m[1] : null;
}

const jeton = process.env.SUPABASE_ACCESS_TOKEN;
const ref = projeKimligi();

if (!jeton || !ref) {
	console.error(kirmizi('\n✗ Tür üretilemedi — eksik bilgi:\n'));
	if (!jeton) console.error(kirmizi('  · SUPABASE_ACCESS_TOKEN tanımlı değil'));
	if (!ref) console.error(kirmizi('  · Proje kimliği bulunamadı'));

	console.error(
		soluk(`
  Jeton:  supabase.com/dashboard/account/tokens
  Kabuğa: export SUPABASE_ACCESS_TOKEN="..."      (Git Bash)
          $env:SUPABASE_ACCESS_TOKEN = "..."      (PowerShell)

  Proje kimliği Supabase adresinin ilk parçasıdır:
    https://<kimlik>.supabase.co
  Ya NEXT_PUBLIC_SUPABASE_URL tanımlayın ya da:
    export SUPABASE_PROJE_REF="<kimlik>"

  JETONU BURAYA, DEPOYA YA DA SOHBETE YAZMAYIN — yalnızca kabuğa.
`)
	);
	process.exit(1);
}

console.log(soluk(`proje: ${ref} · şema: panel · hedef: ${HEDEF}`));

try {
	const cikti = execFileSync(
		'npx',
		[
			'--yes',
			'supabase',
			'gen',
			'types',
			'typescript',
			'--project-id',
			ref,
			'--schema',
			'panel',
		],
		{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
	);

	if (!cikti.includes('export type Database')) {
		console.error(kirmizi('✗ Beklenen çıktı gelmedi; dosya yazılmadı.'));
		process.exit(1);
	}

	const baslik = `/* ÜRETİLMİŞ DOSYA — ELLE DÜZENLEMEYİN.
   Kaynak: Supabase panel şeması.  Yeniden üret: npm run tipler
   Alan türleri ve arayüz etiketleri lib/tipler.ts içindedir. */

`;

	fs.writeFileSync(HEDEF, baslik + cikti, 'utf8');
	console.log(yesil(`✓ ${HEDEF} yazıldı (${(cikti.length / 1024).toFixed(0)} KB)`));
	console.log(soluk('  Şimdi istemcilere <Database> geçilebilir.'));
} catch (e) {
	console.error(kirmizi('✗ supabase gen types çalışmadı.'));
	console.error(soluk(String(e.message ?? e).slice(0, 500)));
	process.exit(1);
}
