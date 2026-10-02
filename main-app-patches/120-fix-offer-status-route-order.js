// main-app-patches/114 appended GET /api/webinar/offer-status right after
// the existing POST /api/webinar/register handler — but that handler sits
// AFTER the unconditional SPA fallback (`app.get('*', ...)` that serves
// index.html for any GET). Express matches routes in registration order,
// so the new GET route was dead: every request to it returned the
// homepage HTML instead of JSON. POST /api/webinar/register itself was
// unaffected (the fallback is GET-only). This patch moves ONLY the
// offer-status route to just before the SPA fallback, where every other
// API route lives.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.120-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const MISPLACED_BLOCK =
`// GET /api/webinar/offer-status — jediný zdroj pravdy pre /ponuka (nahrádza
// cookie/localStorage). Neprihlásený alebo nikdy neregistrovaný = 'none',
// čo frontend zobrazí ako bežnú (neakciovú) ponuku.
app.get('/api/webinar/offer-status', rateLimit, async (req, res) => {
  const user = await verifySupabaseToken(req);
  if (!user) return res.json({ state: 'none', expiresAt: null });
  const status = await getWebinarOfferStatus((user.email || '').toString().trim().toLowerCase());
  res.json({ state: status.state, expiresAt: status.expiresAt });
});

`;

if (!src.includes(MISPLACED_BLOCK)) {
  console.error('Povodny (nespravne umiestneny) blok nenajdeny — mozno uz je opravene, alebo iny text. Nic som nezmenil.');
  process.exit(1);
}

const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;

let patched = src;
patched = replaceOnce(patched, MISPLACED_BLOCK, '', '1: odstranit chybne umiestneny offer-status route');
patched = replaceOnce(patched, SPA_MARKER, MISPLACED_BLOCK.trimEnd() + '\n\n' + SPA_MARKER, '2: vlozit offer-status route pred SPA fallback');

const backup = FILE + '.pre-fix-offer-status-route-order-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
