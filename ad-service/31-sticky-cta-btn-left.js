// Posúva tlačidlo "Začať →" v spodnej plávajúcej lište o kúsok doľava
// (pridáva pravý okraj, aby nebolo úplne nalepené na pravý okraj obrazovky).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/31-sticky-cta-btn-left.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'index.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

const OLD_CSS = `.sticky-cta-btn{flex-shrink:0;padding:.75rem 1.1rem;background:var(--volt);color:var(--black);border:none;border-radius:8px;font-family:var(--mono);font-weight:700;font-size:.8rem;letter-spacing:.03em;cursor:pointer;white-space:nowrap}`;
const NEW_CSS = `.sticky-cta-btn{flex-shrink:0;margin-right:.85rem;padding:.75rem 1.1rem;background:var(--volt);color:var(--black);border:none;border-radius:8px;font-family:var(--mono);font-weight:700;font-size:.8rem;letter-spacing:.03em;cursor:pointer;white-space:nowrap}`;

if (src.includes(NEW_CSS)) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD_CSS)) {
  console.error('❌ Nenašiel som očakávané CSS pre .sticky-cta-btn presne. Nič som nezmenil.');
  process.exit(1);
}

const backupPath = FILE_PATH + '.pre-sticky-btn-left-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
fs.writeFileSync(FILE_PATH, src.replace(OLD_CSS, NEW_CSS));

console.log('✅ Tlačidlo "Začať →" v spodnej lište posunuté doľava (pridaný pravý okraj .85rem).');
console.log('   Záloha pôvodného index.html:', backupPath);
