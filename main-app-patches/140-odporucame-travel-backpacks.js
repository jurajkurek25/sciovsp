// Pridáva druhú kategóriu na /odporucame: batohy na cestovanie
// (BatohyZavazadla.cz, ten istý ehub.cz affiliate partner ako školské
// batohy, len iný cieľový odkaz). SK aj CZ variant stránky.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.140-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('na-cestovani')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;
const TRAVEL_URL = 'https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fna-cestovani%2F';

// ── 1) SK ──
const OLD_SK = `  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na tejto stránke sú affiliate — ak si cez ne niečo kúpiš, môžeme dostať malú províziu. Teba to nič naviac nestojí.</p>`;
const NEW_SK = `  </div>
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🧳 Batohy na cestovanie</h2>
  <div class="course-grid">
    <a class="course-card" href="${TRAVEL_URL}" target="_blank" rel="sponsored noopener">
      <h3>🧳 Batohy na cestovanie</h3>
      <p>BatohyZavazadla.cz — cestovné batohy a ruksaky na výlety aj dlhšie cesty.</p>
      <span class="course-price-tag">Pozrieť ponuku →</span>
    </a>
  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na tejto stránke sú affiliate — ak si cez ne niečo kúpiš, môžeme dostať malú províziu. Teba to nič naviac nestojí.</p>`;
patched = replaceOnce(patched, OLD_SK, NEW_SK, '1: SK travel backpacks');

// ── 2) CZ ──
const OLD_CZ = `  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na této stránce jsou affiliate — pokud si přes ně něco koupíš, můžeme dostat malou provizi. Tebe to nic navíc nestojí.</p>`;
const NEW_CZ = `  </div>
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🧳 Batohy na cestování</h2>
  <div class="course-grid">
    <a class="course-card" href="${TRAVEL_URL}" target="_blank" rel="sponsored noopener">
      <h3>🧳 Batohy na cestování</h3>
      <p>BatohyZavazadla.cz — cestovní batohy a batůžky na výlety i delší cesty.</p>
      <span class="course-price-tag">Podívat se na nabídku →</span>
    </a>
  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na této stránce jsou affiliate — pokud si přes ně něco koupíš, můžeme dostat malou provizi. Tebe to nic navíc nestojí.</p>`;
patched = replaceOnce(patched, OLD_CZ, NEW_CZ, '2: CZ travel backpacks');

const backup = FILE + '.pre-odporucame-travel-backpacks-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
