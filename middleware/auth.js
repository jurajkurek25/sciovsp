const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, s.plan, s.status, s.current_period_end
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Neplatný token.' });

    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  }
}

function requirePro(req, res, next) {
  const isPro = req.user.plan === 'pro' && req.user.status === 'active' &&
    (!req.user.current_period_end || new Date(req.user.current_period_end) > new Date());
  if (!isPro) return res.status(403).json({ error: 'Táto funkcia vyžaduje Pro predplatné.' });
  next();
}

module.exports = { requireAuth, requirePro };
