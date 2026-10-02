// Prepája Supabase Auth "Send SMS Hook" (posiela OTP kódy pre telefónne
// overenie) s smsbrana.cz — jediný SMS provider, ktorý mal Supabase
// natívne podporované (Twilio/MessageBird/Vonage), tak sa toto pripája
// cez VLASTNÝ HTTP hook (Supabase to explicitne podporuje: "You can use
// any HTTP endpoint as a Hook, including an endpoint in your application").
//
// Novú routu /api/auth/send-sms-hook prida hned VEDĽA existujúceho
// /api/stripe/webhook — z rovnakého dôvodu: obe potrebujú SUROVÉ telo
// requestu (nie JSON-parsnuté cez express.json()) kvôli overeniu podpisu.
// Supabase podpisuje payload podľa Standard Webhooks špecifikácie
// (rovnaký princíp ako Stripe, len iný formát) — implementované ručne
// cez Node crypto, žiadna nová závislosť.
//
// smsbrana.cz autentizácia (z ich oficiálnej PHP knižnice
// github.com/smsbrana/sms-connect, source of truth):
//   hash = md5(password + time + salt)
//   request: GET https://api.smsbrana.cz/smsconnect/http.php
//            ?action=send_sms&login=...&time=...&sul=...&hash=...&number=...&message=...
//   úspech: XML odpoveď obsahuje <err>0</err>
//   chyby:  err=2/3 zlý login/heslo, err=4 neplatný čas, err=9 došiel kredit,
//           err=10 zlé číslo, err=11 prázdny text, err=12 text príliš dlhý
//
// ČO MUSÍŠ SPRAVIŤ TY (nie ja — sú to buď tajné údaje, alebo manuálne
// nastavenia v dashboardoch, ktoré nejde spraviť cez patch skript):
//
// 1) Do .env na serveri (RIADOK PO RIADKU, nikde mi ich neposielaj):
//      SMSBRANA_LOGIN=<login z portal.smsbrana.cz → API → Nastavení API
//                       → SMS connect přes HTTP → Aktivní → Ukaž heslo>
//      SMSBRANA_PASSWORD=<heslo z rovnakého miesta>
//      SEND_SMS_HOOK_SECRET=<vygeneruješ v kroku 3, celé vrátane "whsec_">
//
// 2) V Supabase dashboarde: Authentication → Sign In / Providers → Phone
//    → zapnúť "Enable Phone provider", vypnúť "Enable automatic
//    confirmation" (aby sa OTP reálne posielalo, nie auto-potvrdzovalo).
//
// 3) V Supabase dashboarde: Authentication → Hooks → "Send SMS hook"
//    → typ HTTPS → URL: https://sptrener.online/api/auth/send-sms-hook
//    → "Generate secret" → skopírovať CELÝ reťazec (whsec_...) do .env
//    ako SEND_SMS_HOOK_SECRET (krok 1).
//
// Po nasadení a reštarte over cez Supabase dashboard (Send SMS hook má
// tlačidlo na testovací request) alebo skutočným OTP requestom z appky.
//
// Predpoklad: .env s dotenv už existuje (over: require("dotenv").config()
// na začiatku server.js), Stripe webhook routa (/api/stripe/webhook) už
// existuje pred app.use(express.json(...)).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/185-send-sms-hook-smsbrana.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
if (typeof fetch !== 'function') {
  console.error('❌ Tento patch potrebuje globálny fetch() (Node 18+). Over verziu Node: node -v');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.185-send-sms-hook-smsbrana-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('/api/auth/send-sms-hook')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes("app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {")) {
  console.error('❌ Nenašiel som /api/stripe/webhook routu v očakávanom tvare — over, či sa nezmenila. Nič som nezmenil.');
  process.exit(1);
}

const OLD_ANCHOR = `// ── Webhook MUSÍ byť pred express.json() ─────────────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {`;

const NEW_ANCHOR = `// ── Supabase "Send SMS hook" (telefónne overenie cez smsbrana.cz) —
// MUSÍ byť pred express.json() z rovnakého dôvodu ako Stripe webhook:
// overenie podpisu potrebuje surové (neparsnuté) telo requestu.
app.post('/api/auth/send-sms-hook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body.toString('utf8');
    const webhookId = req.headers['webhook-id'];
    const webhookTimestamp = req.headers['webhook-timestamp'];
    const webhookSignature = req.headers['webhook-signature'];
    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      return res.status(400).json({ error: { http_code: 400, message: 'Chýbajúce webhook hlavičky' } });
    }

    const tsNum = Number(webhookTimestamp);
    if (!tsNum || Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return res.status(400).json({ error: { http_code: 400, message: 'Neplatný alebo starý timestamp' } });
    }

    const secretEnv = process.env.SEND_SMS_HOOK_SECRET || '';
    const secretBytes = Buffer.from(secretEnv.replace(/^whsec_/, ''), 'base64');
    const signedContent = webhookId + '.' + webhookTimestamp + '.' + rawBody;
    const expectedSig = crypto.createHmac('sha256', secretBytes).update(signedContent, 'utf8').digest('base64');
    const expectedSigBuf = Buffer.from(expectedSig, 'base64');

    const providedSigs = webhookSignature.split(' ').map(function (s) { return s.split(',')[1]; }).filter(Boolean);
    const validSig = providedSigs.some(function (sig) {
      try {
        const sigBuf = Buffer.from(sig, 'base64');
        return sigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(sigBuf, expectedSigBuf);
      } catch (e) { return false; }
    });
    if (!validSig) {
      return res.status(401).json({ error: { http_code: 401, message: 'Neplatný podpis' } });
    }

    let payload;
    try { payload = JSON.parse(rawBody); } catch (e) {
      return res.status(400).json({ error: { http_code: 400, message: 'Neplatné JSON telo' } });
    }
    const phone = payload.user && payload.user.phone;
    const otp = payload.sms && payload.sms.otp;
    if (!phone || !otp) {
      return res.status(400).json({ error: { http_code: 400, message: 'Chýba telefón alebo OTP kód' } });
    }

    await sendSmsViaSmsbrana(phone, 'Tvoj overovací kód pre SP Tréner: ' + otp);
    return res.status(200).send();
  } catch (e) {
    console.error('send-sms-hook error:', e);
    return res.status(500).json({ error: { http_code: 500, message: 'Odoslanie SMS zlyhalo' } });
  }
});

function smsbranaIso8601(date) {
  function pad(n) { return String(n).padStart(2, '0'); }
  return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate())
    + 'T' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) + '+00:00';
}

function smsbranaSalt(len) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.randomBytes(len || 10);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

const SMSBRANA_ERR_MESSAGES = {
  '1': 'Neznáma chyba', '2': 'Nesprávny login alebo heslo', '3': 'Nesprávny login alebo heslo',
  '4': 'Neplatný časový údaj požiadavky', '9': 'Na účte smsbrana.cz došiel kredit',
  '10': 'Neplatné telefónne číslo príjemcu', '11': 'Prázdny text SMS', '12': 'Text SMS je príliš dlhý'
};

async function sendSmsViaSmsbrana(number, message) {
  const login = process.env.SMSBRANA_LOGIN;
  const password = process.env.SMSBRANA_PASSWORD;
  if (!login || !password) throw new Error('SMSBRANA_LOGIN / SMSBRANA_PASSWORD nie sú nastavené v .env');

  const time = smsbranaIso8601(new Date());
  const salt = smsbranaSalt(10);
  const hash = crypto.createHash('md5').update(password + time + salt).digest('hex');
  const cleanNumber = String(number || '').replace(/^\\+/, '').replace(/[^0-9]/g, '');

  const params = new URLSearchParams({
    action: 'send_sms', login: login, time: time, sul: salt, hash: hash,
    number: cleanNumber, message: message
  });
  const url = 'https://api.smsbrana.cz/smsconnect/http.php?' + params.toString();
  const resp = await fetch(url);
  const text = await resp.text();

  const errMatch = text.match(/<err>(\\d+)<\\/err>/);
  const errCode = errMatch ? errMatch[1] : null;
  if (errCode && errCode !== '0') {
    throw new Error('smsbrana.cz chyba ' + errCode + ': ' + (SMSBRANA_ERR_MESSAGES[errCode] || 'neznáma chyba') + ' — ' + text);
  }
  if (!errCode) {
    throw new Error('smsbrana.cz neočakávaná odpoveď: ' + text);
  }
}

// ── Webhook MUSÍ byť pred express.json() ─────────────────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {`;

server = replaceOnce(server, OLD_ANCHOR, NEW_ANCHOR, 'pridanie /api/auth/send-sms-hook routy + smsbrana.cz integrácie');

if (!server.includes("const crypto = require('crypto')") && !server.includes('const crypto = require("crypto")')) {
  server = replaceOnce(server,
    `require("dotenv").config();`,
    `require("dotenv").config();\nconst crypto = require('crypto');`,
    'pridanie require("crypto") na začiatok súboru');
}

const backup = SERVER_PATH + '.pre-send-sms-hook-smsbrana-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /api/auth/send-sms-hook pridaná — Supabase Send SMS Hook → smsbrana.cz.');
console.log('   Záloha:', backup);
console.log('');
console.log('   EŠTE MUSÍŠ (pozri komentár na začiatku tohto súboru pre presné kroky):');
console.log('   1) Do .env pridať SMSBRANA_LOGIN, SMSBRANA_PASSWORD, SEND_SMS_HOOK_SECRET');
console.log('   2) V Supabase dashboarde zapnúť Phone provider (Auth → Providers → Phone)');
console.log('   3) V Supabase dashboarde vytvoriť Send SMS hook → HTTPS →');
console.log('      https://sptrener.online/api/auth/send-sms-hook → skopírovať secret do .env');
console.log('');
console.log('   Over syntax pred reštartom: node -c server.js');
