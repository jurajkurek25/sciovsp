// Oprava: potvrdzovací email (1-potvrdenie-registracie.html) tiež obsahuje
// [TERMIN] placeholder (zobrazenie termínu vysielania), ale patch 88 mu
// posielal len MENO a UNSUBSCRIBE — [TERMIN] tak zostal v odoslanom
// emaile nevyplnený doslovne.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `    const html = fillWebinarTemplate(loadWebinarEmailTemplate('1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);`;

if (!src.includes(OLD)) {
  if (src.includes('TERMIN: fmtWebinarSlot(reg.slot_start_ms)') && src.includes("loadWebinarEmailTemplate('1-potvrdenie-registracie.html')")) {
    console.error('Uz je aplikovane, nic som nezmenil.');
    process.exit(1);
  }
  console.error('Kotva nie je najdena presne. Nic som nezmenil.');
  process.exit(1);
}

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const NEW = `    const html = fillWebinarTemplate(loadWebinarEmailTemplate('1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);`;

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-webinar-confirm-termin-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('TERMIN teraz vyplneny aj v potvrdzovacom emaile.');
