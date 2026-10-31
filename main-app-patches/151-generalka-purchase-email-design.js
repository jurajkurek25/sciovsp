// Email po zakupeni SP Generalky (jednorazovy test) bol cisty text bez
// dizajnu. Nahradza inline HTML string za branded sablonu z
// emails/generalka-purchased.html (rovnaky vizualny styl ako existujuce
// emails/generalka-offer.html), cez uz existujuce loadWebinarEmailTemplate
// / fillWebinarTemplate helpery (funkcne deklaracie, hoistnute — funguju
// aj pri volani z riadku 223, hoci su definovane az nizsie v subore).
// Vyzaduje uz nahraty subor emails/generalka-purchased.html.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.151-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("generalka-purchased.html")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

if (!fs.existsSync('emails/generalka-purchased.html')) {
  console.error('emails/generalka-purchased.html chyba — najprv ho treba nahrat (spustaj z korena appky). Nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const OLD = `            sendMail({
              to: generalkaEmail,
              subject: 'SP Generálka — tvoj test je pripravený',
              html: '<p>Ďakujeme za nákup SP Generálky.</p><p>Test spustíš tu: <a href="' + startUrl + '">' + startUrl + '</a></p><p>Máš na neho jeden pokus — over si pripojenie na internet a funkčnú webkameru, a vyhraď si na neho súvislý nerušený čas (cca 90 minút), kým klikneš spustiť.</p>'
            }).catch(() => {});`;
const NEW = `            const generalkaPurchasedHtml = fillWebinarTemplate(loadWebinarEmailTemplate('generalka-purchased.html'), { START_URL: startUrl });
            sendMail({
              to: generalkaEmail,
              subject: 'SP Generálka — tvoj test je pripravený',
              html: generalkaPurchasedHtml
            }).catch(() => {});`;

const patched = replaceOnce(src, OLD, NEW, '1: generalka purchase email -> branded template');

const backup = FILE + '.pre-generalka-purchase-email-design-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
