const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/api/user/has-course'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const OLD = `async function requireCourseBuyer(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Prihlás sa.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Neplatná session.' });
    req.userEmail = data.user.email;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatná session.' });
  }
}`;
const NEW = `async function requireCourseBuyer(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Prihlás sa.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Neplatná session.' });
    req.userEmail = data.user.email;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatná session.' });
  }
}

app.get('/api/user/has-course', requireCourseBuyer, async (req, res) => {
  try {
    const { count } = await supabase.from('course_purchases').select('*', { count: 'exact', head: true }).eq('email', req.userEmail);
    res.json({ hasCourse: (count || 0) > 0 });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-has-course-endpoint-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
