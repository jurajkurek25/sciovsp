// Bezpečnostná oprava: instructor-service nemal VÔBEC žiadny helmet --
// chýbal HSTS, X-Content-Type-Options aj X-Frame-Options úplne (scan
// potvrdil: HSTS "Missing HSTS header", X-Frame-Options/X-Content-Type-
// Options chýbajú tiež). CSP vypnuté rovnako ako v dash/main app
// (public/index.html má inline <script>, strict CSP by to rozbilo).
//
// Pred spustením treba nainštalovať závislosť:
//   npm install helmet
//
// Spusti z koreňa instructor-service:
//   node patches/16-helmet-security-headers.js
// Potom: pm2 restart instructor-service

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa instructor-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("require('helmet')")) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
// Express by defaultu posiela X-Powered-By: Express pri res.send()/
// res.json() -- disable() je spoľahlivý spôsob, ako to úplne vypnúť.
app.disable('x-powered-by');
app.use((req, res, next) => {`;

const NEW = `require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
// Express by defaultu posiela X-Powered-By: Express pri res.send()/
// res.json() -- disable() je spoľahlivý spôsob, ako to úplne vypnúť.
app.disable('x-powered-by');
// Doteraz nemal VÔBEC žiadny helmet -- chýbal HSTS, X-Content-Type-
// Options aj X-Frame-Options úplne. CSP vypnuté rovnako ako v dash/main
// app (public/index.html má inline <script>, strict CSP by to rozbilo).
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah server.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-16-helmet-security-headers-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (helmet pridaný: HSTS, X-Content-Type-Options, X-Frame-Options). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Ak ešte nemáš nainštalované: npm install helmet');
console.log('Reštart: pm2 restart instructor-service');
