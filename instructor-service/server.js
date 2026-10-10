require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
// Za CloudPanel/Nginx (jeden lokálny reverse proxy hop) -- bez tohto
// express-rate-limit hádže ERR_ERL_UNEXPECTED_X_FORWARDED_FOR na každý
// request s X-Forwarded-For, pretože bez trust proxy nevie bezpečne
// určiť klientovu IP z hlavičky.
app.set('trust proxy', 1);
// Express by defaultu posiela X-Powered-By: Express pri res.send()/
// res.json() -- disable() je spoľahlivý spôsob, ako to úplne vypnúť.
app.disable('x-powered-by');
// Doteraz nemal VÔBEC žiadny helmet -- chýbal HSTS, X-Content-Type-
// Options aj X-Frame-Options úplne. CSP vypnuté rovnako ako v dash/main
// app (public/index.html má inline <script>, strict CSP by to rozbilo).
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  // Čistý admin panel -- nikde sa nepoužíva kamera/mikrofón/geolokácia a
  // pod., takže sa dá všetko bezpečne zamknúť.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), picture-in-picture=()');
  next();
});
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

// Všetky /api/* odpovede nesú dáta inštruktora -- default Cache-Control
// (public, max-age=0 z express.static/prehliadača) by to mohlo nechať v
// zdieľanej cache/proxy. Statické súbory nižšie si svoj Cache-Control
// riešia samé (express.static), toto sa ich netýka.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(require('./routes/auth'));
app.use(require('./routes/courses'));
app.use(require('./routes/comments'));
app.use(require('./routes/submissions'));
app.use(require('./routes/earnings'));
app.use(require('./routes/upload'));
app.use(require('./routes/discountcodes'));
app.use(require('./routes/legal').router);

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

const PORT = process.env.INSTRUCTOR_PORT || 4100;
app.listen(PORT, () => {
  console.log(`SP Tréner instructor portál beží na porte ${PORT}`);
});
