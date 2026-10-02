// Oprava: GET /api/webinar/confirm a /api/webinar/unsubscribe boli
// registrované AŽ ZA "SPA fallback" catch-all routou (app.get('*', ...)),
// takže Express ich nikdy nedosiahol — catch-all vrátil SPA stránku skôr.
// Presúva oba routy PRED SPA_MARKER (rovnaké miesto ako ostatné stránkové
// routy z patchov 77/79/80/83). POST /api/webinar/register nie je
// dotknutý — catch-all je len app.get, takže ten fungoval už predtým.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const CONFIRM_ROUTE = `app.get('/api/webinar/confirm', async (req, res) => {
  const token = (req.query.token || '').toString();
  if (!token) return res.redirect('/webinar');
  const { data: reg } = await supabase.from('webinar_registrations').select('id').eq('confirm_token', token).maybeSingle();
  if (!reg) return res.redirect('/webinar');
  await supabase.from('webinar_registrations').update({ confirmed_at: new Date().toISOString() }).eq('id', reg.id);
  res.redirect('/webinar/live');
});`;

const UNSUB_ROUTE = `app.get('/api/webinar/unsubscribe', async (req, res) => {
  const token = (req.query.token || '').toString();
  const { data: reg } = token ? await supabase.from('webinar_registrations').select('id').eq('confirm_token', token).maybeSingle() : { data: null };
  if (reg) await supabase.from('webinar_registrations').update({ unsubscribed_at: new Date().toISOString() }).eq('id', reg.id);
  res.set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>Odhlásené</h2><p>Už ti nebudeme posielať pripomienky k webináru.</p></body>');
});`;

const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;

if (!src.includes(CONFIRM_ROUTE) && !src.includes(SPA_MARKER + '\n' + CONFIRM_ROUTE)) {
  if (src.split(SPA_MARKER)[0] && src.split(SPA_MARKER)[0].includes(CONFIRM_ROUTE)) {
    console.error('Uz je aplikovane, nic som nezmenil.');
    process.exit(1);
  }
}

const spaCount = src.split(SPA_MARKER).length - 1;
if (spaCount !== 1) { console.error('SPA fallback kotva nie je jednoznacna (najdenych: ' + spaCount + '). Nic som nezmenil.'); process.exit(1); }

const beforeSpa = src.split(SPA_MARKER)[0];
if (beforeSpa.includes(CONFIRM_ROUTE)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const confirmCount = src.split(CONFIRM_ROUTE).length - 1;
if (confirmCount !== 1) { console.error('CONFIRM_ROUTE kotva nie je jednoznacna (najdenych: ' + confirmCount + '). Nic som nezmenil.'); process.exit(1); }
const unsubCount = src.split(UNSUB_ROUTE).length - 1;
if (unsubCount !== 1) { console.error('UNSUB_ROUTE kotva nie je jednoznacna (najdenych: ' + unsubCount + '). Nic som nezmenil.'); process.exit(1); }

// 1) Odstran oba routy zo starej pozicie (aj s okolitym prazdnym riadkom).
let patched = src;
patched = patched.replace('\n\n' + CONFIRM_ROUTE, '').replace(CONFIRM_ROUTE + '\n\n', '').replace(CONFIRM_ROUTE, '');
patched = patched.replace('\n\n' + UNSUB_ROUTE, '').replace(UNSUB_ROUTE + '\n\n', '').replace(UNSUB_ROUTE, '');

// 2) Vloz ich PRED SPA_MARKER.
const spaCount2 = patched.split(SPA_MARKER).length - 1;
if (spaCount2 !== 1) { console.error('SPA fallback kotva po odstraneni routov nie je jednoznacna (najdenych: ' + spaCount2 + '). Nic som nezmenil.'); process.exit(1); }
patched = patched.replace(SPA_MARKER, CONFIRM_ROUTE + '\n' + UNSUB_ROUTE + '\n\n' + SPA_MARKER);

const backup = FILE + '.pre-webinar-route-order-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('confirm/unsubscribe presunute pred SPA fallback.');
