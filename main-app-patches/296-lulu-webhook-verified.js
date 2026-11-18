// BEZPEČNOSTNÁ ZÁPLATA -- main-app-patches/295 pridal POST /api/shop/lulu-webhook
// do routes/shop.js BEZ overenia, že požiadavka skutočne prišla od Lulu.
// Lulu API v skutočnosti podpisuje každý webhook (Lulu-HMAC-SHA256 header,
// HMAC-SHA256 nad SUROVÝM telom requestu, kľúč = Lulu client secret) -- toto
// som pri prvom nasadení prehliadol. Bez overenia mohol ktokoľvek poslať na
// ten endpoint vymyslený stav objednávky (napr. falošné "SHIPPED", "ERROR"...)
// pre akúkoľvek existujúcu objednávku, ktorej lulu_print_job_id uhádne/pozná.
//
// Táto záplata:
//   1. Odstráni starú nezabezpečenú routu z routes/shop.js (musíš mať
//      nasadený commit eed63ce alebo novší -- tam už tá routa nie je,
//      len exportovaná funkcia handleLuluWebhookPayload cez app.locals).
//   2. Zaregistruje POST /api/shop/lulu-webhook v server.js PRED
//      app.use(express.json(...)) s express.raw() middleware, presne ako
//      existujúci Stripe webhook vyššie -- HMAC sa dá overiť len zo
//      SUROVÉHO tela requestu, nie z už JSON.parse-nutého objektu.
//
// Vyžaduje: routes/shop.js s exportovaným app.locals.handleLuluWebhookPayload
// (commit eed63ce+) a lulu.js s verifyWebhookSignature() (tento istý commit).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/296-lulu-webhook-verified.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.296-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
if (!fs.existsSync('lulu.js') || !fs.existsSync('routes/shop.js')) {
  console.error('❌ Chýba lulu.js alebo routes/shop.js -- najprv nasaď commit eed63ce alebo novší (obsahuje verifyWebhookSignature a handleLuluWebhookPayload).');
  process.exit(1);
}
const luluSrc = fs.readFileSync('lulu.js', 'utf8');
if (!luluSrc.includes('verifyWebhookSignature')) {
  console.error('❌ lulu.js nemá verifyWebhookSignature -- nasaď aktuálnu verziu lulu.js (commit eed63ce+) pred spustením tohto patchu.');
  process.exit(1);
}
const shopSrc = fs.readFileSync('routes/shop.js', 'utf8');
if (!shopSrc.includes('handleLuluWebhookPayload')) {
  console.error('❌ routes/shop.js nemá handleLuluWebhookPayload -- nasaď aktuálnu verziu routes/shop.js (commit eed63ce+) pred spustením tohto patchu.');
  process.exit(1);
}
if (shopSrc.includes("app.post('/api/shop/lulu-webhook'")) {
  console.error('❌ routes/shop.js stále obsahuje starú nezabezpečenú /api/shop/lulu-webhook routu -- nasaď aktuálnu verziu routes/shop.js (commit eed63ce+), kde je odstránená.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.post('/api/shop/lulu-webhook'")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `app.use(express.json({ limit: '20kb' }));`;
const NEW = `// Lulu webhook (PRINT_JOB_STATUS_CHANGED) -- MUSÍ byť pred express.json(),
// rovnako ako Stripe webhook vyššie: HMAC overenie (Lulu-HMAC-SHA256 header)
// potrebuje SUROVÉ telo requestu, nie už JSON.parse-nuté. app.locals.handleLuluWebhookPayload
// je nastavené až v routes/shop.js (mountnuté nižšie) -- funguje aj tak, lebo
// sa číta až pri skutočnej požiadavke, nie pri registrácii tejto routy.
app.post('/api/shop/lulu-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const lulu = require('./lulu');
    const signature = req.headers['lulu-hmac-sha256'];
    if (!lulu.verifyWebhookSignature(req.body, signature)) {
      console.error('🚨 Lulu webhook: neplatný alebo chýbajúci Lulu-HMAC-SHA256 podpis, odmietam.');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    let parsed;
    try {
      parsed = JSON.parse(req.body.toString('utf8'));
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
    if (!app.locals.handleLuluWebhookPayload) {
      console.error('Lulu webhook: app.locals.handleLuluWebhookPayload chýba -- je routes/shop.js mountnuté?');
      return res.status(200).json({ ok: true });
    }
    await app.locals.handleLuluWebhookPayload(parsed);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('lulu webhook error:', e.message);
    res.status(200).json({ ok: true });
  }
});

app.use(express.json({ limit: '20kb' }));`;

src = replaceExactCount(src, OLD, NEW, 1, 'lulu-webhook route pred express.json()');

const backup = FILE + '.pre-296-lulu-webhook-verified-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: POST /api/shop/lulu-webhook teraz overuje Lulu-HMAC-SHA256 podpis pred spracovaním.');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ:');
console.log('   1. pm2 restart sptrener-main');
console.log('   2. Ak si už predtým spustil main-app-patches/register-lulu-webhook.js, nič ďalšie netreba --');
console.log('      URL webhooku sa nemení, len appka teraz overuje jeho podpis.');
console.log('   3. Over v Lulu (sandbox aj produkcia) dashboarde / cez test-webhook-submission endpoint,');
console.log('      že appka naozaj prijíma a overuje skutočné Lulu notifikácie (status objednávky sa aktualizuje).');
