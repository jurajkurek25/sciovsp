const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email a heslo sú povinné.' });
  if (password.length < 8) return res.status(400).json({ error: 'Heslo musí mať aspoň 8 znakov.' });
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Neplatný email.' });

  let client;
  try {
    client = await pool.connect();
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Tento email je už zaregistrovaný.' });

    const hash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Používateľ aj jeho free predplatné vzniknú spolu, alebo vôbec.
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO users (id, email, password_hash, name, verified) VALUES ($1, $2, $3, $4, $5)',
      [userId, email.toLowerCase(), hash, name || null, true]
    );

    // Vytvor free subscription
    await client.query(
      'INSERT INTO subscriptions (user_id, plan, status) VALUES ($1, $2, $3)',
      [userId, 'free', 'active']
    );
    await client.query('COMMIT');

    const token = signToken(userId);
    res.status(201).json({ token, user: { id: userId, email: email.toLowerCase(), name, plan: 'free' } });
  } catch (e) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (e.code === '23505') return res.status(409).json({ error: 'Tento email je už zaregistrovaný.' });
    console.error('Register error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  } finally {
    if (client) client.release();
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return res.status(400).json({ error: 'Vyplň email a heslo.' });

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.password_hash, s.plan, s.status, s.current_period_end
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Nesprávny email alebo heslo.' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Nesprávny email alebo heslo.' });

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan || 'free',
        status: user.status
      }
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// GET /api/auth/me — aktuálny používateľ
router.get('/me', requireAuth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      plan: req.user.plan || 'free',
      status: req.user.status,
      periodEnd: req.user.current_period_end
    }
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Vyplň obe polia.' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Nové heslo musí mať aspoň 8 znakov.' });

  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Súčasné heslo je nesprávne.' });

    const hash = await bcrypt.hash(newPassword, 12);
    // password_changed_at zneplatní všetky staršie tokeny (ostatné zariadenia);
    // toto zariadenie dostane nový token.
    await pool.query('UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true, token: signToken(req.user.id) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

module.exports = router;
