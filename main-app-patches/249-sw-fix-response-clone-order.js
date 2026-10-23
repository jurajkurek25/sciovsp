// public/sw.js — vetva "Fonty a statické assets — Cache first" volala
// response.clone() AZ vnutri caches.open(...).then(...), teda neskoro:
// medzitym uz mohol prehliadac zacat citat telo povodnej response (tu sa
// vracia synchronne cez `return response;` o riadok nizsie), cim sa
// response.clone() stane neplatnym -> "TypeError: Failed to execute
// 'clone' on 'Response': Response body is already used" (potvrdene
// naziva v Console, presne na tomto riadku).
//
// Opravene na rovnaky vzor, aky uz spravne pouziva vetva "/app" o par
// riadkov vyssie: clone() hned synchronne pri prijati response, PRED
// return.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/249-sw-fix-response-clone-order.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'public', 'sw.js');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.249-sw-fix-response-clone-order-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('vsp-v4')) {
  console.error('❌ sw.js: už je aplikované (nájdené vsp-v4), nič som nezmenil.');
  process.exit(1);
}

src = replaceOnce(src, `const CACHE_VERSION = 'vsp-v3';`, `const CACHE_VERSION = 'vsp-v4';`, 'CACHE_VERSION bump');

const OLD = `        return fetch(request).then(response => {
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, response.clone()));
          return response;
        });`;

const NEW = `        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(request, clone));
          return response;
        });`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (fonty/statické assety vetva). Nič som nezmenil.');
  process.exit(1);
}

src = replaceOnce(src, OLD, NEW, 'sw.js: clone() hneď synchrónne, nie neskoro vnútri caches.open().then()');

const backup = FILE + '.pre-249-sw-fix-response-clone-order-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ sw.js opravený — clone() sa teraz volá hneď, kým je telo response ešte nedotknuté.');
console.log('   Verzia cache: vsp-v3 -> vsp-v4');
console.log('   Záloha:', backup);
console.log('   Statický súbor -- žiadny pm2 restart netreba. Tvrdý refresh (Ctrl+Shift+R) vynúti aktiváciu novej verzie.');
