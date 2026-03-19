require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Bezpečnosť ─────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : ['http://localhost:3000', 'http://localhost:5500'],
  credentials: true
}));

// Rate limiting — ochrana pred brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minút
  max: 20,
  message: { error: 'Príliš veľa pokusov. Skús znova za 15 minút.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hodina
  max: 30,
  message: { error: 'Dosiahol si hodinový limit generovania úloh.' }
});

// ─── Body parsing ──────────────────────────────────────────
// Webhook musí dostať raw body — registrujeme PRED express.json()
const stripeRoutes = require('./routes/stripe');
app.use('/api/stripe/webhook', stripeRoutes);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/ai', aiLimiter, require('./routes/ai'));

// Health check
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  time: new Date().toISOString(),
  env: process.env.NODE_ENV
}));

// ─── Statický frontend ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Globálne error handler ───────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Interná chyba servera.' });
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 VSP Tréner server beží na porte ${PORT}`);
  console.log(`   Prostredie: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB: ${process.env.DATABASE_URL?.split('@')[1] || 'not configured'}`);
  console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌ chýba'}`);
  console.log(`   Claude API: ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ chýba'}\n`);
});

module.exports = app;
