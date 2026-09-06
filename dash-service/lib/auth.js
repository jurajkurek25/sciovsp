// Jediný superadmin účet (Juraj) — žiadna registrácia, žiadny druhý účet.
// Prihlásenie je cez Google (rovnaký Supabase projekt/OAuth ako hlavná
// appka) obmedzené na presne jeden e-mail (DASH_ALLOWED_EMAIL). Session
// token sa ukladá do dash_admin_sessions (partner Supabase projekt).
const crypto = require('crypto');
const { supabase } = require('./db-partner');
const { supabase: mainDb } = require('./db-main');

const SESSION_COOKIE = 'dash_session';
const SESSION_DAYS = 7;
const ALLOWED_EMAIL = (process.env.DASH_ALLOWED_EMAIL || 'jurajkurek2006@gmail.com').toLowerCase();

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function loginWithGoogle(supabaseAccessToken) {
  if (!supabaseAccessToken) throw new Error('Chýba prihlasovací token.');
  const { data, error } = await mainDb.auth.getUser(supabaseAccessToken);
  if (error || !data?.user?.email) throw new Error('Neplatný alebo expirovaný Google token.');
  if (data.user.email.toLowerCase() !== ALLOWED_EMAIL) {
    throw new Error('Tento Google účet nemá prístup do dash.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: insErr } = await supabase.from('dash_admin_sessions').insert({ token, expires_at: expiresAt });
  if (insErr) throw new Error(insErr.message);
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

module.exports = { SESSION_COOKIE, SESSION_DAYS, loginWithGoogle, logout, verifySession, requireDashAuth, timingSafeEqualStr };
