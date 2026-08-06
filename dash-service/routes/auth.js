const express = require('express');
const router = express.Router();
const { login, logout, SESSION_COOKIE, SESSION_DAYS, requireDashAuth } = require('../lib/auth');

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000
};

router.post('/api/dash/login', async (req, res) => {
  try {
    const session = await login(req.body?.password);
    if (!session) return res.status(401).json({ error: 'Nesprávne heslo.' });
    res.cookie(SESSION_COOKIE, session.token, COOKIE_OPTS);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/dash/logout', async (req, res) => {
  await logout(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

router.get('/api/dash/me', requireDashAuth, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
