// Bezpečnostná oprava: instructor-service nemá samostatný backend login
// endpoint (prihlásenie je Google OAuth priamo cez Supabase na klientovi),
// ale requireInstructorAuth overuje Bearer token pri KAŽDOM requeste na
// chránené endpointy -- bez limitu sa dalo zahltiť overovanie neplatnými
// tokenmi. Pridáva globálny limiter, ktorý počíta LEN neúspešné requesty
// (status >= 400) na IP -- 20 / 15 minút, rovnaké hodnoty ako authLimiter
// v hlavnej appke. Úspešné requesty (bežné používanie inštruktora) sa
// nepočítajú, takže nič legitímne neobmedzí.
//
// Pred spustením treba nainštalovať závislosť:
//   npm install express-rate-limit
//
// Spusti z koreňa instructor-service:
//   node patches/11-login-rate-limit.js
// Potom: pm2 restart <meno instructor procesu>

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa instructor-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('authFailureLimiter')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.use(require('./routes/auth'));`;

const NEW = `require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));

// Tu nie je samostatný backend login (prihlásenie je Google OAuth priamo
// cez Supabase na klientovi) -- requireInstructorAuth overuje Bearer token
// pri KAŽDOM requeste, takže namiesto limitu na jeden login endpoint
// limitujeme neúspešné requesty (neplatný/expirovaný token, chyby) na IP,
// aby sa nedalo zahltiť overovanie tokenov. Úspešné requesty sa nepočítajú,
// takže bežné používanie inštruktora nič neobmedzí.
const authFailureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { error: 'Príliš veľa neplatných požiadavok. Skús znova za 15 minút.' }
});
app.use(authFailureLimiter);

app.use(require('./routes/auth'));`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah server.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-11-login-rate-limit-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (neúspešné requesty teraz majú rate limit 20/15min na IP). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Ak ešte nemáš nainštalované: npm install express-rate-limit');
console.log('Reštart: pm2 restart <meno instructor procesu>');
