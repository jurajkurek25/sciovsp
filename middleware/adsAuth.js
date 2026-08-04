const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');

async function requireAdvertiserAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });

  try {
    const { advertiserId } = jwt.verify(token, process.env.JWT_SECRET);
    if (!advertiserId) return res.status(401).json({ error: 'Neplatný token.' });

    const result = await pool.query(
      `SELECT id, email, company_name, status, current_period_end
       FROM advertisers WHERE id = $1`,
      [advertiserId]
    );
    const advertiser = result.rows[0];
    if (!advertiser) return res.status(401).json({ error: 'Neplatný token.' });

    req.advertiser = advertiser;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  }
}

module.exports = { requireAdvertiserAuth };
