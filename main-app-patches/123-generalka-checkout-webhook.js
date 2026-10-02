// SP Generálka — nový jednorázový produkt (5,90 €, jeden nákup = jeden
// AI-generovaný pokus na kompletný test). Rovnaký vzor ako existujúce
// jednorázové nákupy (course_purchase, main-app-patches/113 a starší kód):
// webhook branch priamo v server.js vytvorí záznam a pošle email s
// odkazom na spustenie. Samotné API pre priebeh pokusu (spustenie,
// trackovanie udalostí, odovzdanie, AI analýza) žije v novom
// routes/generalka.js — vyžaduje ho AŽ ZA express.json() (poučenie z
// main-app-patches/122 — inak by JSON telá requestov neboli naparsované).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.123-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("session.metadata?.type === 'generalka_purchase'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Webhook: nový záznam pokusu + email s odkazom na spustenie ──
const OLD_WEBHOOK = `        if (session.metadata?.type === 'membership_purchase') {`;
const NEW_WEBHOOK = `        if (session.metadata?.type === 'generalka_purchase') {
          const generalkaCustomer = await stripe.customers.retrieve(session.customer);
          const generalkaEmail = generalkaCustomer.email;
          const attemptToken = require('crypto').randomBytes(24).toString('hex');
          await supabase.from('generalka_attempts').insert({
            email: generalkaEmail,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total,
            attempt_token: attemptToken,
            status: 'paid'
          });
          try {
            const { sendMail } = require('./mailer');
            const startUrl = 'https://sptrener.online/generalka?token=' + attemptToken;
            sendMail({
              to: generalkaEmail,
              subject: 'SP Generálka — tvoj test je pripravený',
              html: '<p>Ďakujeme za nákup SP Generálky.</p><p>Test spustíš tu: <a href="' + startUrl + '">' + startUrl + '</a></p><p>Máš na neho jeden pokus — over si pripojenie na internet a funkčnú webkameru, a vyhraď si na neho súvislý nerušený čas (cca 90 minút), kým klikneš spustiť.</p>'
            }).catch(() => {});
          } catch (e) {
            console.error('generalka email error:', e.message);
          }
          console.log('✅ SP Generálka zakúpená:', generalkaEmail);
        }
        if (session.metadata?.type === 'membership_purchase') {`;

patched = replaceOnce(patched, OLD_WEBHOOK, NEW_WEBHOOK, '1: webhook generalka_purchase branch');

// ── 2) Zapoj routes/generalka.js (AŽ ZA express.json(), nie pred ním) ──
const OLD_REQUIRE = `app.use(express.json({ limit: '20kb' }));
require('./routes/community')(app);`;
const NEW_REQUIRE = `app.use(express.json({ limit: '20kb' }));
require('./routes/community')(app);
require('./routes/generalka')(app);`;

patched = replaceOnce(patched, OLD_REQUIRE, NEW_REQUIRE, '2: require routes/generalka po express.json()');

// ── 3) /generalka route — PRED SPA fallback (poučenie z main-app-patches/120) ──
const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;
const NEW_ROUTES = `app.get('/generalka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'generalka.html')); });

` + SPA_MARKER;
patched = replaceOnce(patched, SPA_MARKER, NEW_ROUTES, '3: /generalka route pred SPA fallback');

const backup = FILE + '.pre-generalka-checkout-webhook-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_generalka.sql uz bezal.');
