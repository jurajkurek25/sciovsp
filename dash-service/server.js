require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
// Za CloudPanel/Nginx (jeden lokálny reverse proxy hop) -- bez tohto
// express-rate-limit hádže ERR_ERL_UNEXPECTED_X_FORWARDED_FOR na každý
// request s X-Forwarded-For (čiže aj na /api/dash/login), pretože bez
// trust proxy nevie bezpečne určiť klientovu IP z hlavičky.
app.set('trust proxy', 1);
// Express by defaultu posiela X-Powered-By: Express pri res.send()/
// res.json() AJ KEĎ helmet beží skôr -- disable() je jediný spoľahlivý
// spôsob, ako to úplne vypnúť (helmet.hidePoweredBy sa s tým nestíha
// pretekať).
app.disable('x-powered-by');
// Jediná služba so superadmin session (dash_session cookie) nemala VÔBEC
// žiadne bezpečnostné hlavičky -- chýbala napr. clickjacking ochrana
// (X-Frame-Options), takže sa dash dal vložiť do <iframe> na cudzej
// stránke. CSP (nižšie) je zatiaľ v Report-Only režime -- presne ten istý
// dvojfázový postup ako v hlavnej appke (main-app-patches/62 → 231):
// zoznam domén je overený proti VŠETKÝM externým zdrojom v public/*.html
// (cdn.jsdelivr.net -- Supabase SDK + Quill, fonts.googleapis.com/
// fonts.gstatic.com), ale kým to niekto neprejde cez F12 → Console a
// nepotvrdí, že sa nič nehlási ako "Refused to...", nevynucuje sa.
// X-Frame-Options, X-Content-Type-Options a X-XSS-Protection NEnecháva
// nastavovať helmet -- globálny /etc/nginx/nginx.conf na tomto serveri
// (platí pre VŠETKY stránky na stroji, nielen túto appku) ich už posiela
// sám, takže by sa inak zdvojili ("SAMEORIGIN, SAMEORIGIN" a pod.).
// Mazanie z nginx.conf by ovplyvnilo aj ostatné, nesúvisiace stránky na
// tomto serveri -- bezpečnejšie je vypnúť duplicitu tu, v appke.
app.use(helmet({ contentSecurityPolicy: false, xFrameOptions: false, xContentTypeOptions: false, xXssProtection: false }));
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy-Report-Only', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '));
  // Čistý admin panel -- nikde sa nepoužíva kamera/mikrofón/geolokácia a
  // pod., takže sa dá všetko bezpečne zamknúť.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), picture-in-picture=()');
  next();
});
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Všetky /api/* odpovede nesú superadmin dáta -- default Cache-Control
// (public, max-age=0 z express.static/prehliadača) by to mohlo nechať v
// zdieľanej cache/proxy. Statické súbory nižšie si svoj Cache-Control
// riešia samé (express.static), toto sa ich netýka.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(require('./routes/auth'));
app.use(require('./routes/overview'));
app.use(require('./routes/academy'));
app.use(require('./routes/giftcards'));
app.use(require('./routes/payouts'));
app.use(require('./routes/instructorpayouts'));
app.use(require('./routes/discountcodes'));
app.use(require('./routes/instructors'));
app.use(require('./routes/bugs'));
app.use(require('./routes/advisor'));
app.use(require('./routes/aiops'));
app.use(require('./routes/trends'));
app.use(require('./routes/courses'));
app.use(require('./routes/blog'));
app.use(require('./routes/upload'));
app.use(require('./routes/ads'));
app.use(require('./routes/giftcardsales'));
app.use(require('./routes/webinar'));
app.use(require('./routes/maintenance'));
app.use(require('./routes/reviews'));
app.use(require('./routes/community'));
app.use(require('./routes/sutaz-applications'));
app.use(require('./routes/sutaz-draw'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/{*splat}', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Čokoľvek, čo sem dorazí (iná HTTP metóda než GET na neexistujúcu
// cestu), by inak dostalo Express-ovu vlastnú default 404 stránku
// ("Cannot POST /xyz"), ktorá odhaľuje použitý framework.
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// Bez tohto Express padá pri neošetrenej výnimke na svoj vlastný default
// error handler, ktorý vie vypísať celý stack trace do odpovede. Musí
// byť POSLEDNÝ middleware -- presne 4 parametre (err, ...) je pre
// Express signál, že ide o error handler.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Interná chyba servera.' });
});

const PORT = process.env.DASH_PORT || 4000;
app.listen(PORT, () => {
  console.log(`SP Tréner dash beží na porte ${PORT}`);
});
