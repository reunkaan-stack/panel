
pdfjsLib.GlobalWorkerOptions.workerSrc = "/edp/kutuphane/pdf.worker.min.js";

// ---------- Ayarlar ----------
const DEF = {birim:"ADET", kdv:"20", sistemKdv:"1", bolen:"1.2", f1Discount:"0", f1Discount2:"", f3:"100", f5:"100",
  suppliers:{CANSU:"1.10", SELMA:"1.10"}, xlmap:null};
let cfg = JSON.parse(localStorage.getItem("diaCfg")||"null") || structuredClone(DEF);
if(!cfg.priceRulesV2 && Object.prototype.hasOwnProperty.call(cfg,'f4')){
  const oldF3=parseFloat(cfg.f3), oldF4=parseFloat(cfg.f4);
  cfg.f3=Number.isFinite(oldF3) ? String(Math.max(0,(oldF3-1)*100)) : DEF.f3;
  cfg.f5=Number.isFinite(oldF4) ? String(Math.max(0,(oldF4-1)*100)) : DEF.f5;
}
cfg.priceRulesV2=true;
ayarlariKaydet();
cfg.f1Discount ??= DEF.f1Discount; cfg.f1Discount2 ??= DEF.f1Discount2; cfg.f3 ??= DEF.f3; cfg.f5 ??= DEF.f5;

let rows = [];      // {no,kod,aciklama,barkod,miktar,fiyat,nfiyat, ad(manuel), f4(manuel|null)}
/* İKİ AYRI KDV VAR — karıştırılırsa her fiyat bozulur.

   FATURA KDV'si: tedarikçinin faturayı kaç KDV ile keseceği. Ne kadar
   ÖDEDİĞİMİZİ belirler. Belgede yazıyor (PDF dipnotu, KARAS kolonu).

   ÜRÜN KDV'si: ürünün gerçek KDV'si. Dia'ya yazılacak KDV hariç
   fiyatı ve F/J kolonlarını belirler. HİÇBİR BELGEDE YAZMIYOR.

   İkisi genelde aynı ama "yarı fatura" durumunda ayrışıyor:
     100 TL ürün, %10 fatura  →  ödenen 110 TL
     ürünün KDV'si %20        →  KDV hariç 110/1,2 = 91,67 TL
   Belgedeki %10'u ürün KDV'si sanmak muhasebede sessiz hata demek. */
let dosyaKdvDahil = false;   // dosyadaki fiyat KDV içeriyor mu
let faturaKdv = 20;          // yalnızca dosya KDV hariçken kullanılır
const VARSAYILAN_URUN_KDV = 20;
let pdfFtr = {ara:0, genel:0, kdv:0.10}; // PDF dipnotundan okunan toplamlar
/* Kaynak seçici kaldırıldı: dosya uzantısı zaten söylüyor ve iki
   yerden yönetilen bir seçim, kullanıcının yanlış kutuyu işaretleyip
   "neden okumuyor" demesine yol açıyordu. */
let sourceKind = "";
let autoName = false;   // ürün adını otomatik (ham) kullan
let xlBook = null, xlAOA = [];          // yüklenen Excel verisi

// ---------- Yardımcılar ----------
function parseTL(s){ if(s==null) return 0; return parseFloat(String(s).replace(/\./g,'').replace(',','.'))||0; }
function numCell(v){ // Excel hücresinden sayı (numeric ya da "1.234,56" metni olabilir)
  if(v==null||v==='') return 0;
  if(typeof v==='number') return v;
  return parseTL(v);
}
function fmt(n){
  if(n===''||n==null||isNaN(n)) return '';
  let r = Math.round(n*100)/100;
  let s = r.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  return s.replace('.',',');
}
function todayStr(){ const d=new Date(); const p=x=>String(x).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function dmy(iso){ const [y,m,d]=iso.split('-'); return d+'.'+m+'.'+y; }
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
function percentValue(v){ return parseTL(String(v).replace('%','')); }
// Hücre içi mini hesap makinesi: "100*1,1" → 110 (+ - * / ve parantez)
function evalExpr(str){
  let s=String(str).trim().replace(/\s+/g,'').replace(/,/g,'.');
  if(!/^[-+*/().0-9]+$/.test(s) || s==='') return null;
  try{ const v=Function('"use strict";return ('+s+')')(); return (typeof v==='number'&&isFinite(v))?v:null; }
  catch(e){ return null; }
}
function profitMultiplier(v){ return 1 + (percentValue(v)/100); }
function markBarcodeIssues(){
  const counts={};
  rows.forEach(r=>{ const b=String(r.barkod||'').trim(); if(b) counts[b]=(counts[b]||0)+1; });
  rows.forEach(r=>{ const b=String(r.barkod||'').trim(); r.barkodEdit=!b || counts[b]>1; });
}

// ---------- Fiyat hesapları ----------
/** Ürünün KDV'si. Satırda yoksa varsayılan. */
function urunKdv(r){
  var k = Number(r.kdv);
  return (k === 10 || k === 20) ? k : VARSAYILAN_URUN_KDV;
}

/** Dia'nın J kolonu: 20 → 1, 10 → 2. Kural sabittir, elle girilmez. */
function sistemKdv(r){ return urunKdv(r) === 10 ? '2' : '1'; }

/** İskontolar düşülmüş dosya fiyatı. */
function indirimli(r){
  const ilk=1-percentValue(cfg.f1Discount)/100;
  const ikinci=cfg.f1Discount2==='' ? 1 : 1-percentValue(cfg.f1Discount2)/100;
  return r.nfiyat * ilk * ikinci;
}

/** ÖDENEN para — KDV dahil. fiyat2 budur. */
function odenen(r){
  return dosyaKdvDahil ? indirimli(r) : indirimli(r) * (1 + faturaKdv/100);
}

function fiyat2(r){ return odenen(r); }

/** KDV hariç fiyat: ödenen ÷ ÜRÜNÜN kdv'si (faturanınki değil). */
function fiyat1(r){ return odenen(r) / (1 + urunKdv(r)/100); }
function fiyat3(r){ return fiyat2(r) * profitMultiplier(cfg.f3); }
function fiyat5(r){ return fiyat3(r) * profitMultiplier(cfg.f5); }
function fiyat4(r){ return (r.f4!=null && r.f4!=='') ? parseTL(r.f4) : fiyat5(r); }
/** Dia'nın C kolonuna yazılacak ad.

    SIRA: elle yazılan / hafızadan gelen ad  →  ham ad (otomatik
    açıksa)  →  boş. Hafızadan gelen ad r.ad içine konuyor, yani
    kullanıcı üzerine yazabiliyor; bir sonraki indirmede onun
    yazdığı öğreniliyor. */
function urunAdi(r){
  const elle=(r.ad||'').trim();
  if(elle) return elle;
  return autoName ? r.aciklama : '';
}

/** Geçen alışa göre değişim yüzdesi. Karşılaştırma KDV HARİÇ
    fiyatla yapılıyor: KDV dahil tutar üzerinden bakmak, fatura
    KDV'si değiştiğinde olmayan bir zam gösterirdi. */
function zamOrani(r){
  if(!r.sonAlis || r.sonAlis<=0) return null;
  return (fiyat1(r)-r.sonAlis)/r.sonAlis*100;
}

/* Bu eşiğin altındaki oynama gürültü sayılıyor; her kuruşluk
   fark için uyarı çıkarsa uyarıya bakılmaz olur. */
const ZAM_ESIGI = 5;

function ekAlan5(r){ return (r.kod? r.kod+'-':'') + r.aciklama + (r.barkod? ' ('+r.barkod+')':''); }

// ---------- PDF okuma ----------
async function readPDF(file){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;
  let lines = [], allRows = [];
  for(let p=1;p<=pdf.numPages;p++){
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    // metin parçalarını y konumuna göre satırlara grupla
    const map = {};
    tc.items.forEach(it=>{
      const y = Math.round(it.transform[5]);
      (map[y]=map[y]||[]).push({x:it.transform[4], s:it.str});
    });
    const entries = Object.keys(map).map(Number).sort((a,b)=>b-a).map(y=>({
      y, text: map[y].sort((a,b)=>a.x-b.x).map(o=>o.s).join(' ').replace(/\s+/g,' ').trim()
    })).filter(e=>e.text);
    entries.forEach(e=>lines.push(e.text));
    allRows = allRows.concat(parsePage(entries));
  }
  allRows.forEach((r,i)=>r.no=i+1);
  return {rows: allRows, ftr: parseFooter(lines)};
}

function lastNum(s){ const m = s.match(/[\d.]*\d,\d{2}/g); return m? parseTL(m[m.length-1]) : null; }

function parseFooter(lines){
  let ara=null, genel=null, kdv=0.10;
  for(const ln of lines){
    if(/Ara\s*Toplam/i.test(ln)){ const n=lastNum(ln); if(n!=null) ara=n; }
    if(/Genel\s*Toplam/i.test(ln)){ const n=lastNum(ln); if(n!=null) genel=n; }
    const km = ln.match(/KDV\s*Toplam[^%]*%\s*(\d+)/i);
    if(km) kdv = parseInt(km[1],10)/100;
  }
  return {ara, genel, kdv};
}

// Ürün satırı: "[No?]  [kod?] açıklama  barkod(13)  koli miktar fiyat nfiyat tutar"
// Baştaki sıra no opsiyonel (Cansu/Bella'da var: "1 ...", Aymet'te yok: "AYM-... ...")
const PROD = /^(?:\d+\s+)?(.+?)\s+(\d{13})\s+(.*)$/;
// Kod parçası (ayrı satıra düşen): kısa, büyük harf/rakam
const CODE = /^[A-Z0-9ÇĞİÖŞÜ.\-\/ ]{1,24}$/;

function parsePage(entries){
  // ürün satırlarını bul
  const prods = [];
  entries.forEach(e=>{ const m=e.text.match(PROD); if(m) prods.push({y:e.y, m}); });
  if(!prods.length) return [];
  // ayrı satıra düşen kod parçalarını en yakın ürüne ata
  const orphans = {};
  entries.forEach(e=>{
    if(e.text.match(PROD)) return;
    if(!CODE.test(e.text.trim())) return;
    let best=null, bd=1e9;
    prods.forEach(p=>{ const d=Math.abs(p.y-e.y); if(d<bd){bd=d;best=p;} });
    if(best && bd<22){ (orphans[best.y]=orphans[best.y]||[]).push({y:e.y, t:e.text.trim()}); }
  });
  const out=[];
  prods.forEach(p=>{
    const [, middle, barkod, rest] = p.m;
    // rest: koli, miktar, fiyat, nfiyat, tutar (binlik ayracı boşluk olabilir)
    const toks = rest.trim().split(/\s+/);
    let idx=0; const koli=toks[idx++]; const miktar=parseInt(toks[idx++],10)||0;
    const nums=[]; let prefix='';
    for(; idx<toks.length; idx++){
      const t=toks[idx];
      if(t.indexOf(',')>=0){ nums.push(parseTL(prefix+t)); prefix=''; }
      else { prefix += t; }
    }
    const fiyat = nums[0]||0;
    const nfiyat = nums.length>=2 ? nums[1] : (nums[0]||0);
    // kod ve ad ayrımı
    let kod='', ad=middle.trim();
    const orph=(orphans[p.y]||[]).sort((a,b)=>b.y-a.y).map(o=>o.t);
    if(orph.length){
      kod = orph.join(' ');                       // kod ayrı satırlarda → ad tam middle
    } else {
      const sp = middle.trim().split(/\s+/);
      if(/[0-9]/.test(sp[0]) && /[-.]/.test(sp[0]) && sp.length>1){
        kod = sp[0]; ad = sp.slice(1).join(' ');  // kod satır içinde (CNS-4057 gibi)
      }
    }
    out.push({no:0, kod, aciklama:ad, barkod, miktar, fiyat, nfiyat,
      ad:'', f4:null, sec:true});   // no, readPDF'te yeniden numaralanır
  });
  return out;
}

// ---------- Tablo render ----------
function render(){
  const tb = document.getElementById('tbody');
  tb.innerHTML='';
  rows.forEach((r,i)=>{
    const tr=document.createElement('tr');
    if(!r.sec) tr.style.opacity='.4';
    tr.innerHTML =
      `<td class="ro" style="text-align:center"><input type="checkbox" data-sec="${i}" ${r.sec?'checked':''}></td>`+
      `<td class="ro num">${r.no}</td>`+
      (r.barkodEdit
        ? `<td class="editcell"><input data-i="${i}" data-col="barkod" value="${String(r.barkod||'').replace(/"/g,'&quot;')}" placeholder="Barkod gir"></td>`
        : `<td class="ro">${r.barkod}</td>`)+
      `<td class="ro">${r.aciklama}</td>`+
      /* Ad hücresi artık otomatik kipte de düzenlenebilir: hafızadan
         gelen adı görüp değiştirebilmek gerekiyor. Hafızadan geldiyse
         işaretleniyor ki kullanıcı nereden geldiğini bilsin. */
      `<td class="editcell"${r.hafizadan?' title="Daha önce bu adı vermiştiniz"':''}>`+
        `<input data-i="${i}" data-col="ad" value="${(r.ad||'').replace(/"/g,'&quot;')}" `+
        `placeholder="${autoName?(r.aciklama||'').replace(/"/g,'&quot;'):'temiz ad'}">`+
        (r.hafizadan?'<span class="hafiza-im" title="Hafızadan geldi">⟲</span>':'')+
      `</td>`+
      `<td class="ro num">${r.miktar}</td>`+
      `<td class="editcell num"><select data-i="${i}" data-col="kdv">`+
        `<option value="20" ${urunKdv(r)===20?'selected':''}>%20</option>`+
        `<option value="10" ${urunKdv(r)===10?'selected':''}>%10</option>`+
      `</select></td>`+
      `<td class="ro num">${fmt(r.nfiyat)}`+
        (function(){
          const z=zamOrani(r);
          if(z===null || Math.abs(z)<ZAM_ESIGI) return '';
          const yon = z>0 ? 'zam' : 'indirim';
          return '<span class="zam '+(z>0?'arti':'eksi')+'" title="Geçen alış: '+
                 fmt(r.sonAlis)+' ₺ ('+(r.sonAlisTarihi||'')+') — '+yon+'">'+
                 (z>0?'▲':'▼')+Math.abs(Math.round(z))+'%</span>';
        })()+
      `</td>`+
      `<td class="num calc">${fmt(fiyat2(r))}</td>`+
      `<td class="num calc">${fmt(fiyat1(r))}</td>`+
      `<td class="num calc">${fmt(fiyat3(r))}</td>`+
      `<td class="editcell num"><input data-i="${i}" data-col="f4" value="${r.f4!=null&&r.f4!==''?r.f4:''}" placeholder="${fmt(fiyat5(r))}">`+
        (r.sonSatis ? `<span class="oneri" title="Geçen sefer bu fiyatı yazmıştınız">${fmt(r.sonSatis)}</span>` : '')+
      `</td>`+
      `<td class="num calc f5-${i}">${fmt(fiyat4(r))}</td>`+
      `<td class="ro">${ekAlan5(r)}</td>`;
    tb.appendChild(tr);
  });
  document.getElementById('tbl').style.display = rows.length?'table':'none';
  document.getElementById('navHint').style.display = rows.length?'block':'none';
  document.getElementById('exportBtn').disabled = !rows.length;
  updateCount();
  renderVerify();
  bindCells();
}

function updateCount(){
  const sel=rows.filter(r=>r.sec).length;
  document.getElementById('count').textContent =
    rows.length? `${rows.length} ürün okundu · ${sel} tanesi Excel'e yazılacak` : 'Ürün bulunamadı';
}

function renderPdfVerifyLegacy(){
  const box=document.getElementById('verify');
  if(!rows.length){ box.style.display='none'; return; }
  const adet = rows.reduce((s,r)=>s+(r.miktar||0),0);
  const araHesap = rows.reduce((s,r)=>s+r.fiyat*r.miktar,0);      // Σ Fiyat × Adet  → Ara Toplam
  const netHesap = rows.reduce((s,r)=>s+r.nfiyat*r.miktar,0);     // Σ N.Fiyat × Adet (iskontolu net)
  const genelHesap = netHesap*(1+pdfFtr.kdv);                     // net × (1+KDV) → Genel Toplam
  const near=(a,b)=>a!=null&&b!=null&&Math.abs(a-b)<0.5;
  const chip=(ok,label)=> ok===null ? '' :
    `<div class="chk ${ok?'ok':'bad'}">${ok?'✓':'✗'} ${label}</div>`;
  const araOk   = pdfFtr.ara   ? near(araHesap, pdfFtr.ara)     : null;
  const genelOk = pdfFtr.genel ? near(genelHesap, pdfFtr.genel) : null;
  box.innerHTML =
    `<div class="v"><span>Toplam Adet</span><b>${adet}</b></div>`+
    `<div class="v"><span>Ara Toplam (hesap)</span><b>${fmt(araHesap)}</b></div>`+
    (pdfFtr.ara?`<div class="v"><span>PDF Ara Toplam</span><b>${fmt(pdfFtr.ara)}</b></div>`:'')+
    chip(araOk,'Ara Toplam')+
    `<div class="v"><span>Genel Toplam (hesap, KDV %${Math.round(pdfFtr.kdv*100)})</span><b>${fmt(genelHesap)}</b></div>`+
    (pdfFtr.genel?`<div class="v"><span>PDF Genel Toplam</span><b>${fmt(pdfFtr.genel)}</b></div>`:'')+
    chip(genelOk,'Genel Toplam');
  box.style.display='flex';
}

// Seçili satırlara göre canlı sipariş özeti
function renderVerify(){
  const box=document.getElementById('verify');
  if(!rows.length){ box.style.display='none'; return; }
  const selected=rows.filter(r=>r.sec);
  const adet=selected.reduce((sum,r)=>sum+(r.miktar||0),0);
  const araToplam=selected.reduce((sum,r)=>sum+fiyat1(r)*r.miktar,0);
  const genelToplam=selected.reduce((sum,r)=>sum+fiyat2(r)*r.miktar,0);
  /* KDV dağılımı: karışık listede hangi satırın hangi orana
     düştüğü gizlenmemeli — yanlış F/J Dia'da sessiz hata demek. */
  const yirmi=selected.filter(r=>urunKdv(r)===20).length;
  const on=selected.filter(r=>urunKdv(r)===10).length;
  const karisik = yirmi>0 && on>0;

  box.innerHTML=
    `<div class="v"><span>Seçili Toplam Adet</span><b>${adet}</b></div>`+
    `<div class="v"><span>Ara Toplam (KDV hariç)</span><b>${fmt(araToplam)}</b></div>`+
    `<div class="v"><span>Genel Toplam (KDV dahil)</span><b>${fmt(genelToplam)}</b></div>`+
    `<div class="v"><span>Ürün KDV dağılımı</span><b>${yirmi} × %20 · ${on} × %10</b></div>`+
    (karisik
      ? `<div class="chk bad">! Karışık KDV — kontrol edin</div>`
      : '');
  box.style.display='flex';
}

function bindCells(){
  document.querySelectorAll('#tbody input[data-sec]').forEach(cb=>{
    cb.addEventListener('change',e=>{
      const i=+e.target.dataset.sec;
      rows[i].sec=e.target.checked;
      e.target.closest('tr').style.opacity = rows[i].sec?'1':'.4';
      updateCount();
      renderVerify();
      const sa=document.getElementById('selAll'); if(sa) sa.checked=rows.every(r=>r.sec);
    });
  });
  /* KDV hücresi bir <select>; input döngüsüne girmiyor. */
  document.querySelectorAll('#tbody select[data-col="kdv"]').forEach(sec=>{
    sec.addEventListener('change',e=>{
      rows[+e.target.dataset.i].kdv=parseInt(e.target.value,10);
      render();
    });
  });

  document.querySelectorAll('#tbody input[data-i]').forEach(inp=>{
    inp.addEventListener('input',e=>{
      const i=+e.target.dataset.i, col=e.target.dataset.col;
      rows[i][col]=e.target.value;
      if(col==='f4'){ // fiyat5 = fiyat4 anlık güncelle
        const c=document.querySelector('.f5-'+i); if(c) c.textContent=fmt(fiyat4(rows[i]));
      }
    });
    inp.addEventListener('keydown',e=>{
      const i=+e.target.dataset.i, col=e.target.dataset.col;
      // fiyat4 hücresinde Enter: ifade varsa hesapla, sonucu yaz, satırda kal
      if(e.key==='Enter' && col==='f4'){
        const raw=e.target.value;
        if(/[+\-*/]/.test(raw.slice(1))){          // baştaki eksi hariç bir operatör var mı
          const val=evalExpr(raw);
          if(val!=null){
            e.preventDefault();
            const s=fmt(val);
            e.target.value=s; rows[i].f4=s; e.target.select();
            const c=document.querySelector('.f5-'+i); if(c) c.textContent=fmt(fiyat4(rows[i]));
            return;
          }
        }
      }
      if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){
        e.preventDefault();
        const dir=(e.key==='ArrowUp')?-1:1;
        const next=document.querySelector(`#tbody input[data-i="${i+dir}"][data-col="${col}"]`);
        if(next){ next.focus(); next.select(); }
      }
    });
    inp.addEventListener('change',e=>{
      if(e.target.dataset.col==='barkod'){ markBarcodeIssues(); render(); }
    });
  });
}

// ---------- Excel çıktı (Dia şablonu, kolonlar ayrık, metin) ----------
/* Sıfırlama son kontrol ekranından geliyor; kalıcı bir ayar DEĞİL.
   Açık kalan görünmez bir seçim, sessizce yanlış Excel üretirdi. */
function exportXlsx(sifirla34){
  const tarih = dmy(document.getElementById('tarih').value || todayStr());
  const grup = document.getElementById('grupKodu').value.trim();
  const header = ["S/N","Barkod","Açıklama","Birim","Fiyat2","KDV","Grup Kodu","EK ALAN 5","düzenleme tarihi","Sistem kdv","Fiyat1","fiyat3","fiyat4","fiyat5"];
  const aoa=[header];
  const dahil = rows.filter(r=>r.sec);
  if(!dahil.length){ toast("Hiç satır seçili değil!"); return; }
  dahil.forEach((r,k)=>{
    aoa.push([
      String(k+1),
      String(r.barkod),
      urunAdi(r),                 // C: hafıza/elle → ham ad
      cfg.birim,                  // D
      fmt(fiyat2(r)),             // E Fiyat2
      String(urunKdv(r)),         // F  ürünün KDV'si
      grup,                       // G
      ekAlan5(r),                 // H
      tarih,                      // I
      sistemKdv(r),               // J  20→1, 10→2
      fmt(fiyat1(r)),             // K Fiyat1
      sifirla34 ? '0' : fmt(fiyat3(r)),   // L fiyat3
      sifirla34 ? '0' : fmt(fiyat4(r)),   // M fiyat4
      /* N HİÇ SIFIRLANMAZ: her zaman elle girilen değer, o boşsa
         hesaplanan fiyat5. Sıfırlama yalnızca toptan (L) ve
         perakende (M) kolonlarını kapatıyor. */
      fmt(fiyat4(r))
    ]);
  });
  // her hücre metin olarak (barkod bilimsel gösterime düşmesin)
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  Object.keys(ws).forEach(k=>{ if(k[0]!=='!'){ ws[k].t='s'; ws[k].z='@'; } });
  ws['!cols']=header.map((h,i)=>({wch: i===2||i===7?40:12}));
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Dia");
  XLSX.writeFile(wb, "Dia Yukleme "+tarih.replace(/\./g,'-')+".xlsx");
  hafizayaYaz(dahil);
  toast("Excel indirildi ✓");
}

// ---------- Olaylar ----------
const drop=document.getElementById('drop'), fileInput=document.getElementById('fileInput');
drop.onclick=()=>fileInput.click();
drop.ondragover=e=>{e.preventDefault();drop.classList.add('hover');};
drop.ondragleave=()=>drop.classList.remove('hover');
drop.ondrop=async e=>{e.preventDefault();drop.classList.remove('hover');await handleFiles(e.dataTransfer.files);};
fileInput.onchange=async e=>{await handleFiles(e.target.files);};

async function handleFiles(files){
  const arr=[...files];
  const isXls=f=>/\.(xlsx|xls|csv)$/i.test(f.name);
  if(arr.length && isXls(arr[0])){
    await loadExcel(arr.find(isXls)||arr[0]);
    return;
  }
  /* PDF geldi: Excel kolon eşleme paneli açık kaldıysa kapansın.
     Eskiden bunu kaynak seçicisi yapıyordu. */
  const esleme=document.getElementById('xlmap');
  if(esleme) esleme.style.display='none';

  let all=[]; let ftr={ara:0, genel:0, kdv:0.10};
  for(const f of arr){
    if(f.type!=='application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) continue;
    try{
      const res=await readPDF(f); all=all.concat(res.rows);
      if(res.ftr.ara)   ftr.ara   += res.ftr.ara;
      if(res.ftr.genel) ftr.genel += res.ftr.genel;
      ftr.kdv = res.ftr.kdv;
    }
    catch(err){ toast("PDF okunamadı: "+f.name); console.error(err); }
  }
  all.forEach((r,i)=>r.no=i+1);
  rows=all; pdfFtr=ftr; sourceKind='pdf'; markBarcodeIssues();

  /* Dipnottaki oran FATURA kdv'sidir — ödenen tutarı belirler.
     Ürünün kendi KDV'si DEĞİLDİR; o belgede hiç yazmıyor ve
     varsayılan %20 ile başlayıp satırdan düzeltiliyor. */
  const okunan=Math.round((ftr.kdv||0)*100);
  if(okunan===10||okunan===20){
    setRate((1+okunan/100).toFixed(2));
    toast('Fatura KDV oranı dosyadan okundu: %'+okunan);
  }
  render();
  if(rows.length) toast(rows.length+" ürün okundu ✓");
  hafizadanDoldur();
}

// ---------- Excel okuma + kolon eşleştirme ----------
const XL_FIELDS = [
  {key:'barkod',  label:'Barkod',   hints:['barkod','barcode']},
  {key:'kod',     label:'Kod / Stok kodu', hints:['kod','stok']},
  {key:'aciklama',label:'Açıklama / Ürün adı', hints:['açıkla','aciklama','ürün','urun','ad','isim','name']},
  {key:'miktar',  label:'Adet / Miktar', hints:['adet','miktar','qty','quantity']},
  {key:'fiyat',   label:'Fiyat (liste)', hints:['fiyat','price']},
  {key:'nfiyat',  label:'N.Fiyat (net)', hints:['n.fiyat','n. fiyat','nfiyat','net']}
];

async function loadExcel(file){
  const buf=await file.arrayBuffer();
  xlBook=XLSX.read(buf,{type:'array'});
  const sel=document.getElementById('xlSheet');
  sel.innerHTML=xlBook.SheetNames.map(n=>`<option>${n}</option>`).join('');
  loadSheet();
  if(loadKarasExcel()) return;
  document.getElementById('xlmap').style.display='block';
  toast("Excel yüklendi — kolonları eşleştir");
}

function normalizedText(v){ return String(v??'').toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim(); }
function firstCell(row,start,end){
  for(let i=start;i<=end;i++){ if(row[i]!==undefined && row[i]!==null && row[i]!=='') return row[i]; }
  return '';
}
function isKarasHeader(row){
  const labels=row.map(normalizedText);
  return labels.includes('stok kodu') && labels.includes('stok ismi') &&
    labels.some(x=>x.startsWith('barkod')) && labels.includes('adet') &&
    labels.some(x=>x==='b.fiyat' || x==='bfiyat');
}
function loadKarasExcel(){
  const headers=[];
  xlAOA.forEach((row,i)=>{ if(row && isKarasHeader(row)) headers.push(i); });
  if(!headers.length) return false;
  const out=[]; let sourceKdv=0;
  headers.forEach((headerIndex,sectionIndex)=>{
    const end=headers[sectionIndex+1] ?? xlAOA.length;
    for(let i=headerIndex+1;i<end;i++){
      const row=xlAOA[i]||[];
      const kod=String(firstCell(row,0,1)||'').trim();
      const aciklama=String(firstCell(row,2,9)||'').trim();
      const isSummary=/^(malınız toplam|müşteri şimdiki bakiye)/i.test(kod);
      if((!kod && !aciklama) || isSummary) continue;
      const barkod=String(firstCell(row,10,11)||'').trim();
      const miktar=Math.round(numCell(row[13]));
      const fiyat1=numCell(row[15]);
      if(!miktar && !fiyat1) continue;
      const kdv=numCell(row[14]); if(kdv) sourceKdv=kdv;
      out.push({no:out.length+1,kod,aciklama,barkod,miktar,fiyat:fiyat1,nfiyat:fiyat1,ad:'',f4:null,sec:true});
    }
  });
  if(!out.length) return false;
  rows=out; pdfFtr={ara:0,genel:0,kdv:sourceKdv?sourceKdv/100:0.10}; sourceKind='karas';
  autoName=true; document.getElementById('autoName').checked=true;
  /* KARAS'ta KDV kolonu FATURA oranıdır. cfg.kdv artık yok:
     çıktıdaki F kolonu satırın ÜRÜN kdv'sinden türetiliyor. */
  if(sourceKdv===10 || sourceKdv===20) setRate((1+sourceKdv/100).toFixed(2));
  markBarcodeIssues();
  document.getElementById('xlmap').style.display='none';
  render();
  toast(out.length+' KARAS ürünü okundu ✓');
  hafizadanDoldur();
  return true;
}

function loadSheet(){
  const name=document.getElementById('xlSheet').value;
  const ws=xlBook.Sheets[name];
  xlAOA=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
  // başlık satırını tahmin et: en çok metin dolu hücre içeren ilk satır
  let hr=0,best=-1;
  for(let i=0;i<Math.min(xlAOA.length,15);i++){
    const c=xlAOA[i].filter(v=>typeof v==='string'&&v.trim()).length;
    if(c>best){best=c;hr=i;}
  }
  document.getElementById('xlHeaderRow').value=hr+1;
  buildMapUI();
}

function colsFromHeader(){
  const hr=(parseInt(document.getElementById('xlHeaderRow').value,10)||1)-1;
  const head=xlAOA[hr]||[];
  return head.map((h,i)=>({i, name: (h===''||h==null)?`Sütun ${i+1}`:String(h)}));
}

function buildMapUI(){
  const cols=colsFromHeader();
  const saved=cfg.xlmap||{};
  const wrap=document.getElementById('xlFields'); wrap.innerHTML='';
  XL_FIELDS.forEach(f=>{
    // otomatik tahmin
    let guess = (f.key in saved) ? saved[f.key] : -1;
    if(guess===-1){
      const hit=cols.find(c=>f.hints.some(h=>c.name.toLowerCase().includes(h)));
      if(hit) guess=hit.i;
    }
    const opts=`<option value="-1">— yok —</option>`+
      cols.map(c=>`<option value="${c.i}" ${c.i===guess?'selected':''}>${c.name}</option>`).join('');
    const div=document.createElement('div'); div.className='field';
    div.innerHTML=`<label>${f.label}</label><select data-fld="${f.key}">${opts}</select>`;
    wrap.appendChild(div);
  });
}

function applyExcelMap(){
  const map={}; document.querySelectorAll('#xlFields select').forEach(s=>map[s.dataset.fld]=parseInt(s.value,10));
  if(map.barkod<0 && map.aciklama<0){ toast("En az Barkod veya Açıklama seçmelisin"); return; }
  cfg.xlmap=map; ayarlariKaydet();
  const hr=(parseInt(document.getElementById('xlHeaderRow').value,10)||1)-1;
  const get=(row,k)=> map[k]>=0 ? row[map[k]] : '';
  const out=[];
  for(let i=hr+1;i<xlAOA.length;i++){
    const row=xlAOA[i]; if(!row) continue;
    const barkod=String(get(row,'barkod')??'').trim();
    const aciklama=String(get(row,'aciklama')??'').trim();
    if(!barkod && !aciklama) continue; // boş satır
    out.push({
      no: out.length+1,
      kod: String(get(row,'kod')??'').trim(),
      aciklama, barkod,
      miktar: Math.round(numCell(get(row,'miktar'))),
      fiyat: numCell(get(row,'fiyat')),
      nfiyat: numCell(get(row,'nfiyat')) || numCell(get(row,'fiyat')),
      ad:'', f4:null, sec:true
    });
  }
  rows=out; pdfFtr={ara:0,genel:0,kdv:0.10}; sourceKind='generic'; markBarcodeIssues();
  document.getElementById('xlmap').style.display='none';
  render();
  document.getElementById('xlInfo').textContent='';
  toast(out.length+" ürün okundu ✓");
  hafizadanDoldur();
}

// ---------- Dosyadaki fiyat KDV dahil mi ----------
function faturaAlaniniGuncelle(){
  /* Dosya zaten KDV dahilse fatura oranı sorulmaz: ödenen tutar
     doğrudan dosyada yazıyor, çarpacak bir şey yok. */
  const alan=document.getElementById('faturaAlan');
  if(alan) alan.style.display = dosyaKdvDahil ? 'none' : '';
}

document.querySelectorAll('#dosyaSeg button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#dosyaSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    dosyaKdvDahil = b.dataset.dahil === '1';
    faturaAlaniniGuncelle();
    render();
  };
});

document.querySelectorAll('#faturaSeg button').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('#faturaSeg button').forEach(x=>x.classList.remove('on'));
    b.classList.add('on');
    faturaKdv = parseInt(b.dataset.fkdv,10);
    render();
  };
});

/* Seçili satırların ÜRÜN kdv'sini topluca değiştir. Tekstil satırlarını
   tek tek düzeltmek yerine işaretleyip tek tıkla. */
document.querySelectorAll('#urunKdvSeg button').forEach(b=>{
  b.onclick=()=>{
    const k=parseInt(b.dataset.ukdv,10);
    const secili=rows.filter(r=>r.sec);
    if(!secili.length){ toast('Önce satır seçin'); return; }
    secili.forEach(r=>r.kdv=k);
    render();
    toast(secili.length+' satır %'+k+' yapıldı');
  };
});

/* Eski çağrılar bu adı kullanıyordu: dosya KDV hariç kabul edilip
   fatura oranı ayarlanıyor. '1.00' = dosya zaten KDV dahil. */
function setRate(val){
  if(val==='1.00'){
    dosyaKdvDahil=true;
  } else {
    dosyaKdvDahil=false;
    faturaKdv = Math.round((parseFloat(val)-1)*100);
  }
  document.querySelectorAll('#dosyaSeg button').forEach(x=>{
    x.classList.toggle('on', (x.dataset.dahil==='1')===dosyaKdvDahil);
  });
  document.querySelectorAll('#faturaSeg button').forEach(x=>{
    x.classList.toggle('on', parseInt(x.dataset.fkdv,10)===faturaKdv);
  });
  faturaAlaniniGuncelle();
}
// grup kodu değişince tedarikçi oranını seç
document.getElementById('grupKodu').addEventListener('input',e=>{
  const code=e.target.value.trim().toUpperCase();
  if(sourceKind!=='karas' && cfg.suppliers[code]){ setRate(cfg.suppliers[code]); render(); }
});

document.addEventListener('change',e=>{
  if(e.target.id==='selAll'){
    const on=e.target.checked;
    rows.forEach(r=>r.sec=on);
    render();
  }
});
document.getElementById('autoName').onchange=e=>{ autoName=e.target.checked; render(); };
document.getElementById('xlSheet').onchange=loadSheet;
document.getElementById('xlHeaderRow').onchange=buildMapUI;
document.getElementById('xlApply').onclick=applyExcelMap;

document.getElementById('exportBtn').onclick=sonKontroluAc;
document.getElementById('tarih').value=todayStr();
function bindLivePriceInput(id,key){
  const input=document.getElementById(id);
  input.value=cfg[key];
  input.addEventListener('input',()=>{
    cfg[key]=input.value;
    ayarlariKaydet();
    render();
  });
}
bindLivePriceInput('f1Discount','f1Discount');
bindLivePriceInput('f1Discount2','f1Discount2');
bindLivePriceInput('f3Profit','f3');
bindLivePriceInput('f5Profit','f5');

// ---------- Ayarlar paneli ----------
const sp=document.getElementById('settings');
function fillSettings(){
  /* KDV ve Sistem kdv kutuları kaldırıldı: artık satırın kendi
     KDV'sinden türetiliyor, elle girilmiyor. Kaldırılan kutuya
     erişmek Ayarlar panelini açılır açılmaz çökertirdi. */
  setBirim.value=cfg.birim;
  renderSup();
}
function renderSup(){
  const el=document.getElementById('supList'); el.innerHTML='';
  Object.entries(cfg.suppliers).forEach(([name,r])=>{
    const lbl = r==='1.10'?'%10':r==='1.20'?'%20':'KDV dahil';
    const div=document.createElement('div'); div.className='sup-row';
    div.innerHTML=`<span class="pill">${name}</span><span class="small" style="flex:1">${lbl} (×${r})</span><button class="btn ghost" data-del="${name}">Sil</button>`;
    el.appendChild(div);
  });
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{delete cfg.suppliers[b.dataset.del];renderSup();});
}
document.getElementById('settingsBtn').onclick=()=>{fillSettings();sp.classList.add('open');};
document.getElementById('closeSettings').onclick=()=>sp.classList.remove('open');
document.getElementById('addSup').onclick=()=>{
  const n=newSupName.value.trim().toUpperCase(); if(!n)return;
  cfg.suppliers[n]=newSupRate.value; newSupName.value=''; renderSup();
};
document.getElementById('saveSettings').onclick=()=>{
  cfg.birim=setBirim.value;
  ayarlariKaydet();
  sp.classList.remove('open'); render(); toast("Ayarlar kaydedildi ✓");
};


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


/* ================= ÜRÜN HAFIZASI =================

   Barkod → daha önce verilen ad ve ürünün KDV'si.

   OKUMA: dosya her yüklendikten sonra, barkodlar sunucuya sorulur
   ve bilinenler satırlara işlenir.

   YAZMA: yalnızca EXCEL İNDİRİLDİĞİNDE. "İndirdim" = "onayladım";
   ekranda oynanıp vazgeçilen bir değer hafızaya geçmemeli.

   Hafıza çalışmazsa program eskisi gibi çalışır — ama sessiz
   kalmaz, kullanıcı neden tanımadığını bilsin. */

async function hafizadanDoldur(){
  const barkodlar=rows.map(r=>String(r.barkod||'').trim()).filter(Boolean);
  if(!barkodlar.length) return;

  try{
    const cevap=await fetch('/api/edp/urunler',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({barkodlar:barkodlar})
    });
    if(!cevap.ok) throw new Error('sunucu '+cevap.status);

    const veri=await cevap.json();
    const bilinen=veri.urunler||{};
    let adSayisi=0, kdvSayisi=0;

    rows.forEach(function(r){
      const kayit=bilinen[String(r.barkod||'').trim()];
      if(!kayit) return;

      /* Elle bir şey yazılmışsa ÜZERİNE YAZILMAZ: kullanıcının o
         andaki kararı hafızadan önce gelir. */
      if(kayit.ad && !(r.ad||'').trim()){
        r.ad=kayit.ad; r.hafizadan=true; adSayisi++;
      }
      if((kayit.kdv===10||kayit.kdv===20) && r.kdv==null){
        r.kdv=kayit.kdv; kdvSayisi++;
      }

      /* Öneri olarak saklanıyor, kutuya YAZILMIYOR: alış fiyatı
         değişmişse eski satış fiyatı yanlış olabilir. */
      r.sonSatis=kayit.sonSatis;
      r.sonAlis=kayit.sonAlis;
      r.sonAlisTarihi=kayit.sonAlisTarihi;
      r.sonTedarikci=kayit.sonTedarikci;
    });

    if(adSayisi||kdvSayisi){
      render();
      toast(adSayisi+' ürün adı, '+kdvSayisi+' KDV hafızadan geldi');
    }
  }catch(e){
    console.error('[edp] ürün hafızası okunamadı', e);
    toast('Ürün hafızası okunamadı — adlar boş gelecek');
  }
}

async function hafizayaYaz(satirlar){
  const urunler=satirlar
    .filter(function(r){ return String(r.barkod||'').trim(); })
    .map(function(r){
      return {
        barkod:String(r.barkod).trim(),
        ad:urunAdi(r),
        kdv:urunKdv(r),
        kod:r.kod||'',
        tedarikci:document.getElementById('grupKodu').value.trim(),
        /* Elle yazılmışsa o; yazılmamışsa öğrenilecek bir şey yok. */
        satisFiyati:(r.f4!=null&&r.f4!=='')?parseTL(r.f4):null,
        /* KDV hariç alış — zam karşılaştırmasının tabanı. */
        alisFiyati:fiyat1(r)
      };
    });
  if(!urunler.length) return;

  try{
    const cevap=await fetch('/api/edp/urunler',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({urunler:urunler})
    });
    if(!cevap.ok) throw new Error('sunucu '+cevap.status);
  }catch(e){
    console.error('[edp] ürün hafızası yazılamadı', e);
    toast('Excel indi ama ürün hafızası güncellenemedi');
  }
}


/* ================= SON KONTROL =================

   Excel indirmeden önceki tek durak. Veri buradan muhasebeye
   gidiyor; kaç ürün yazılacağı, KDV dağılımı ve sıfırlanacak
   kolonlar burada bir kez daha görünüyor.

   Sıfırlama seçimi burada duruyor, üst barda değil: "kimi zaman"
   yapılan bir şey için sürekli açık duran bir kutu unutulur ve
   sessizce yanlış dosya üretir. */

function sonKontroluAc(){
  const dahil=rows.filter(r=>r.sec);
  if(!dahil.length){ toast('Hiç satır seçili değil!'); return; }

  const tarih=dmy(document.getElementById('tarih').value || todayStr());
  const grup=document.getElementById('grupKodu').value.trim();
  const yirmi=dahil.filter(r=>urunKdv(r)===20).length;
  const on=dahil.filter(r=>urunKdv(r)===10).length;

  document.getElementById('onayOzet').innerHTML=
    '<b>'+dahil.length+' ürün</b> yazılacak · Grup kodu <b>'+(grup||'—')+'</b> · '+
    'Tarih <b>'+tarih+'</b><br>Ürün KDV: <b>'+yirmi+' × %20</b>, <b>'+on+' × %10</b>';

  const uyarilar=[];
  if(yirmi>0 && on>0){
    uyarilar.push('Listede iki farklı ürün KDV var. F ve J kolonları satır satır yazılacak — doğruluğundan emin olun.');
  }
  if(!grup){
    uyarilar.push('Grup kodu boş. Dia G kolonu boş gidecek.');
  }
  const barkodsuz=dahil.filter(r=>!String(r.barkod||'').trim()).length;
  if(barkodsuz){
    uyarilar.push(barkodsuz+' satırda barkod yok.');
  }
  document.getElementById('onayUyari').innerHTML=
    uyarilar.map(function(u){ return '<div>! '+u+'</div>'; }).join('');

  onizlemeyiCiz();
  document.getElementById('onayPerde').classList.add('acik');
}

/* İlk satırın çıktıdaki hâli: sıfırlama kutusu işaretlenince ne
   değiştiği rakamla görünsün, tarifle değil. */
function onizlemeyiCiz(){
  const dahil=rows.filter(r=>r.sec);
  const r=dahil[0];
  const kutu=document.getElementById('onayOnizleme');
  if(!r){ kutu.innerHTML=''; return; }

  const sifir=document.getElementById('sifirla34').checked;
  const satir=function(ad,deger){
    return '<tr><td>'+ad+'</td><td class="num"><b>'+deger+'</b></td></tr>';
  };

  kutu.innerHTML='<div class="small">İlk satır (<b>'+
    (urunAdi(r)||r.aciklama||'—')+'</b>) çıktıda şöyle görünecek:</div>'+
    '<table>'+
    satir('Fiyat1 (K) — KDV hariç', fmt(fiyat1(r))+' ₺')+
    satir('Fiyat2 (E) — KDV dahil', fmt(fiyat2(r))+' ₺')+
    satir('KDV (F) / Sistem kdv (J)', urunKdv(r)+' / '+sistemKdv(r))+
    satir('fiyat3 (L)', sifir ? '0' : fmt(fiyat3(r))+' ₺')+
    satir('fiyat4 (M)', sifir ? '0' : fmt(fiyat4(r))+' ₺')+
    satir('fiyat5 (N)', fmt(fiyat4(r))+' ₺')+
    '</table>';
}

document.getElementById('sifirla34').addEventListener('change', onizlemeyiCiz);

document.getElementById('onayVazgec').onclick=function(){
  document.getElementById('onayPerde').classList.remove('acik');
};

document.getElementById('onayIndir').onclick=function(){
  const sifir=document.getElementById('sifirla34').checked;
  document.getElementById('onayPerde').classList.remove('acik');
  exportXlsx(sifir);
};

/* Perdeye tıklayınca kapansın; kutunun içine tıklayınca kapanmasın. */
document.getElementById('onayPerde').addEventListener('click', function(e){
  if(e.target.id==='onayPerde') e.currentTarget.classList.remove('acik');
});
