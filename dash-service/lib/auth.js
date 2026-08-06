// Jediný superadmin účet (Juraj) — žiadna registrácia, žiadny druhý účet.
// Heslo je bcrypt hash v env (DASH_ADMIN_PASSWORD_HASH), session token sa
// ukladá do dash_admin_sessions (partner Supabase projekt).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { supabase } = require('./db-partner');

const SESSION_COOKIE = 'dash_session';
const SESSION_DAYS = 7;

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function login(password) {
  const hash = process.env.DASH_ADMIN_PASSWORD_HASH;
  if (!hash) throw new Error('DASH_ADMIN_PASSWORD_HASH nie je nastavený.');
  const ok = await bcrypt.compare(String(password || ''), hash);
  if (!ok) return null;

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('dash_admin_sessions').insert({ token, expires_at: expiresAt });
  if (error) throw new Error(error.message);
  return { token, expiresAt };
}

async function logout(token) {
  if (!token) return;
  await supabase.from('dash_admin_sessions').delete().eq('token', token);
}

async function verifySession(token) {
  if (!token) return false;
  const { data } = await supabase.from('dash_admin_sessions').select('token, expires_at').eq('token', token).single();
  if (!data) return false;
  if (new Date(data.expires_at).getTime() < Date.now()) {
    supabase.from('dash_admin_sessions').delete().eq('token', token).then(() => {}).catch(() => {});
    return false;
  }
  return true;
}

async function requireDashAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const ok = await verifySession(token);
  if (!ok) return res.status(401).json({ error: 'Neautorizované.' });
  req.dashToken = token;
  next();
}

module.exports = { SESSION_COOKIE, SESSION_DAYS, login, logout, verifySession, requireDashAuth, timingSafeEqualStr };
