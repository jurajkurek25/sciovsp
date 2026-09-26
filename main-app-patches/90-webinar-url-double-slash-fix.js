// Oprava: APP_URL v .env má na konci lomku ("https://sptrener.online/"),
// takže APP_URL + '/api/webinar/...' vytváralo dvojitú lomku
// (".online//api/webinar/...") a Express na taký request nemal
// zaregistrovanú routu — odkazy na potvrdenie aj odhlásenie boli nefunkčné.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('WEBINAR_APP_URL')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `const { sendMail } = require('./mailer');`;
const anchorCount = src.split(ANCHOR).length - 1;
if (anchorCount !== 1) { console.error('Kotva require(./mailer) nie je jednoznacna (najdenych: ' + anchorCount + '). Nic som nezmenil.'); process.exit(1); }

const withConst = src.replace(ANCHOR, ANCHOR + `\nconst WEBINAR_APP_URL = APP_URL.replace(/\\/+$/, '');`);

const OLD_SNIPPET = `APP_URL + '/api/webinar/`;
const count = withConst.split(OLD_SNIPPET).length - 1;
if (count < 1) { console.error('Ziadny vyskyt APP_URL pre webinar routy. Nic som nezmenil.'); process.exit(1); }

const patched = withConst.split(OLD_SNIPPET).join(`WEBINAR_APP_URL + '/api/webinar/`);

const backup = FILE + '.pre-webinar-url-fix-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Opravenych vyskytov:', count);
