// Pridá dlhé Cache-Control hlavičky pre /fonts/*.woff2 (self-hosted fonty).
// Vkladá nový express.static route PRED existujúci všeobecný static middleware,
// takže žiadosti na /fonts/* dostanú 1-ročný immutable cache namiesto default TTL.
// Spusti na serveri z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node main-app-patches/102-fonts-cache-headers-server.js
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const MARKER = "app.use('/fonts', express.static(";
if (src.includes(MARKER)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = "app.use(express.static(path.join(__dirname, 'public')));";
const NEW = `app.use('/fonts', express.static(path.join(__dirname, 'public', 'fonts'), {
  maxAge: '1y',
  immutable: true
}));
app.use(express.static(path.join(__dirname, 'public')));`;

const patched = replaceOnce(src, OLD, NEW, 'static middleware');

const backup = FILE + '.pre-fonts-cache-headers-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK — zálohované do', backup, '— /fonts/* teraz posiela Cache-Control: max-age=31536000, immutable. Reštartni proces.');
