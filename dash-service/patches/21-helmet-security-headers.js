// Bezpečnostná oprava: dash-service (dash.sptrener.online, superadmin
// session) nemal VÔBEC žiadne bezpečnostné hlavičky -- žiadny helmet,
// žiadny X-Frame-Options. Chýbala napr. clickjacking ochrana: dash sa dal
// vložiť do <iframe> na cudzej stránke. Pridáva helmet (rovnako ako main
// app/instructor-service, s vypnutým CSP -- public/index.html má veľa
// inline <script>, strict CSP by appku rozbil).
//
// Pred spustením treba nainštalovať závislosť:
//   npm install helmet
//
// Spusti z koreňa dash-service:
//   node patches/21-helmet-security-headers.js
// Potom: pm2 restart dash-service

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa dash-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('helmet')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());`;

const NEW = `require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
// Jediná služba so superadmin session (dash_session cookie) nemala VÔBEC
// žiadne bezpečnostné hlavičky -- chýbala napr. clickjacking ochrana
// (X-Frame-Options), takže sa dash dal vložiť do <iframe> na cudzej
// stránke. CSP vypnuté rovnako ako v main app/instructor-service (public/
// index.html má veľa inline <script>, strict CSP by to rozbilo).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah server.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-21-helmet-security-headers-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (helmet pridaný, dash má teraz bezpečnostné hlavičky vrátane X-Frame-Options). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Ak ešte nemáš nainštalované: npm install helmet');
console.log('Reštart: pm2 restart dash-service');
