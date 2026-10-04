require('dotenv').config();
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

const PORT = process.env.INSTRUCTOR_PORT || 4100;
app.listen(PORT, () => {
  console.log(`SP Tréner instructor portál beží na porte ${PORT}`);
});
