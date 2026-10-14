// Bezpečnostná oprava: chýbajúca Permissions-Policy hlavička.
// instructor-service je čistý admin panel -- nikde sa nepoužíva kamera/
// mikrofón/geolokácia/platby a pod. (overené grepom cez getUserMedia/
// mediaDevices/requestFullscreen/navigator.clipboard/geolocation --
// nič), takže sa dá všetko bezpečne zamknúť na "žiadny origin".
//
// Spusti z koreňa instructor-service:
//   node patches/13-permissions-policy.js
// Potom: pm2 restart instructor-service

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'server.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som server.js — spusti z koreňa instructor-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('Permissions-Policy')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = `const app = express();
app.use(express.json({ limit: '2mb' }));`;

const NEW = `const app = express();
app.use((req, res, next) => {
  // Čistý admin panel -- nikde sa nepoužíva kamera/mikrofón/geolokácia a
  // pod., takže sa dá všetko bezpečne zamknúť.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), picture-in-picture=()');
  next();
});
app.use(express.json({ limit: '2mb' }));`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil. Pošli mi aktuálny obsah server.js, over.'); process.exit(1); }

src = src.replace(OLD, () => NEW);

const backup = FILE + '.pre-13-permissions-policy-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ server.js prepísaný (Permissions-Policy pridaná, všetko zamknuté). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Reštart: pm2 restart instructor-service');
