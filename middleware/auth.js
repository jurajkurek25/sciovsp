const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

// Overí JWT a načíta používateľa s predplatným do req.user.
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Nie si prihlásený.' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Prihlásenie vypršalo. Prihlás sa znova.' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.password_changed_at, s.plan, s.status, s.current_period_end
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [payload.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Používateľ neexistuje.' });

    // Token vydaný pred zmenou hesla je neplatný (odhlási ostatné zariadenia).
    if (user.password_changed_at && Math.floor(new Date(user.password_changed_at).getTime() / 1000) > payload.iat) {
      return res.status(401).json({ error: 'Prihlásenie vypršalo. Prihlás sa znova.' });
    }

    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

function isProUser(u) {
  return u.plan === 'pro' && ['active', 'trialing'].includes(u.status) &&
    (!u.current_period_end || new Date(u.current_period_end) > new Date());
}

function requirePro(req, res, next) {
  if (!isProUser(req.user)) return res.status(403).json({ error: 'Táto funkcia je dostupná len v Pro pláne.' });
  next();
}

module.exports = { requireAuth, requirePro, isProUser };
