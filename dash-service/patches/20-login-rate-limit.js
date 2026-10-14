// Bezpečnostná oprava: POST /api/dash/login (jediný skutočný login
// endpoint v dash-i -- overuje Google ID token) nemal žiadny rate limit.
// Útočník mohol endpoint zahltiť veľkým množstvom požiadaviek (falošné
// tokeny, volumetrické zaťaženie). Pridáva limiter: 20 pokusov / 15 minút
// na IP, rovnaké hodnoty ako authLimiter v hlavnej appke.
//
// Pred spustením treba nainštalovať závislosť:
//   npm install express-rate-limit
//
// Spusti z koreňa dash-service:
//   node patches/20-login-rate-limit.js
// Potom: pm2 restart <meno dash procesu>

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'routes', 'auth.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som routes/auth.js — spusti z koreňa dash-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('loginLimiter')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `const express = require('express');
const router = express.Router();
const { loginWithGoogle, logout, SESSION_COOKIE, SESSION_DAYS, requireDashAuth } = require('../lib/auth');

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
};

router.post('/api/dash/login', async (req, res) => {`;

const NEW = `const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { loginWithGoogle, logout, SESSION_COOKIE, SESSION_DAYS, requireDashAuth } = require('../lib/auth');

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
};

// Ochrana proti brute-force/zahlteniu login endpointu (ten jediný je v
// dash-i chránený heslom/tokenom zvonka, ostatné je OAuth bez samostatného
// backend loginu).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Príliš veľa pokusov o prihlásenie. Skús znova za 15 minút.' }
});

router.post('/api/dash/login', loginLimiter, async (req, res) => {`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah routes/auth.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-20-login-rate-limit-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ routes/auth.js prepísaný (POST /api/dash/login teraz má rate limit 20/15min na IP). Záloha:', backup);
console.log('');
console.log('Over: node -c routes/auth.js');
console.log('Ak ešte nemáš nainštalované: npm install express-rate-limit');
console.log('Reštart: pm2 restart <meno dash procesu>');
