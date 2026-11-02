// generalka-purchased.html (patch 151) teraz ma [UNSUBSCRIBE] aj firemnu
// paticku, ale server.js mu doteraz posielal len START_URL. Doplna
// generovanie/pouzitie unsubscribe tokenu, rovnaky vzor ako
// sendGeneralkaOfferEmails nizsie v subore.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.153-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('generalkaUnsubToken')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const OLD = `            const generalkaPurchasedHtml = fillWebinarTemplate(loadWebinarEmailTemplate('generalka-purchased.html'), { START_URL: startUrl });`;
const NEW = `            const generalkaUnsubToken = await getOrCreateUnsubscribeToken(generalkaEmail);
            const generalkaPurchasedHtml = fillWebinarTemplate(loadWebinarEmailTemplate('generalka-purchased.html'), { START_URL: startUrl, UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + generalkaUnsubToken });`;

const patched = replaceOnce(src, OLD, NEW, '1: generalka-purchased UNSUBSCRIBE wiring');

const backup = FILE + '.pre-generalka-purchased-unsubscribe-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
