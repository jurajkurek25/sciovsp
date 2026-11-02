// Pridava na courseAuthSlot data-atributy o access_mode/tieroch, aby
// kurz-detail.js vedel pre kurzy zaradene do predplatneho (access_mode
// = 'subscription') ponuknut prihlasenemu pouzivatelovi DVE moznosti:
// stat sa clenom prislusneho (najlacnejsieho dostupneho) tieru, alebo
// kurz rovno kupit. Kotva je presne to, co ostalo po patchi 47
// (kurzy-czech-lang) — jediny vyskyt tohoto riadku v sablone.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('data-access-mode')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const OLD = "        <div class=\"courseAuthSlot\" data-free=\"${course.price_cents === 0 ? '1' : '0'}\"><span style=\"color:var(--text3);font-size:.85rem\">${T.loading}</span></div>";
const NEW = "        <div class=\"courseAuthSlot\" data-free=\"${course.price_cents === 0 ? '1' : '0'}\" data-access-mode=\"${course.access_mode || 'paid'}\" data-included-premium=\"${course.included_in_premium ? '1' : '0'}\" data-included-elite=\"${course.included_in_elite ? '1' : '0'}\"><span style=\"color:var(--text3);font-size:.85rem\">${T.loading}</span></div>";

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-subscription-course-cta-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
