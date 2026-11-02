// Autentifikácia inštruktorov — rovnaký Supabase Auth (Google) projekt ako
// hlavná appka, žiadny samostatný účet/heslo. Prvé prihlásenie automaticky
// založí riadok v `instructors` podľa e-mailu zo Supabase tokenu ("voľná
// registrácia" — publikovanie kurzu je čo schvaľuje Juraj cez dash, nie
// samotný vznik účtu).
const { supabase: mainDb } = require('./db-main');

async function requireInstructorAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });

  const { data, error } = await mainDb.auth.getUser(token);
  if (error || !data?.user?.email) return res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  const email = data.user.email.toLowerCase();

  const { data: existing, error: selErr } = await mainDb.from('instructors').select('*').eq('email', email).maybeSingle();
  if (selErr) return res.status(500).json({ error: selErr.message });

  let instructor = existing;
  if (!instructor) {
    const meta = data.user.user_metadata || {};
    const { data: created, error: insErr } = await mainDb.from('instructors').insert({
      email, name: meta.full_name || meta.name || null, photo_url: meta.avatar_url || null
    }).select().single();
    if (insErr) return res.status(500).json({ error: insErr.message });
    instructor = created;
  }

  req.instructor = instructor;
  next();
}

module.exports = { requireInstructorAuth };
