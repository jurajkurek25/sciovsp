// Jazyk usera (users.lang) + unsubscribe systém pre emaily naviazané na
// users tabuľku (elite streak, exam goodluck/recenzia, generálka ponuka).
// Doteraz unsubscribe existoval len pre webinárové a kvízové (leads) emaily.
// Vyžaduje db/migrate_email_unsubscribe_and_lang.sql.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.126-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('getOrCreateUnsubscribeToken')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) POST /api/profile/lang + getOrCreateUnsubscribeToken() — hneď za /api/profile/exam-date ──
const ANCHOR_LANG = `app.post('/api/profile/exam-date', rateLimit, async (req, res) => {
  const user = await verifySupabaseToken(req);
  if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });

  const { examDate } = req.body;
  if (examDate !== null && examDate !== undefined && !/^\\d{4}-\\d{2}-\\d{2}$/.test(examDate)) {
    return res.status(400).json({ error: 'Neplatný dátum.' });
  }
  try {
    // Zmena termínu resetuje "už odoslané" príznaky — pri posunutí termínu
    // chce user nový good luck / žiadosť o recenziu k NOVÉMU dátumu, nie ticho.
    await supabase.from('users').update({
      exam_date: examDate || null,
      exam_goodluck_sent_at: null,
      exam_review_token: null,
      exam_review_requested_at: null,
      generalka_offer_sent_at: null
    }).eq('email', user.email);
    res.json({ ok: true });
  } catch (err) {
    console.error('exam-date update:', err.message);
    res.status(500).json({ error: err.message });
  }
});`;

const NEW_LANG_BLOCK = ANCHOR_LANG + `

// ── POST /api/profile/lang — synchronizuje jazyk appky (localStorage
// vsp_lang) do users.lang, aby ho vedeli použiť aj cronové emaily bežiace
// na pozadí (elite streak, exam goodluck/recenzia, generálka ponuka),
// nezávisle od toho, aký jazyk má user momentálne v prehliadači ──
app.post('/api/profile/lang', rateLimit, async (req, res) => {
  const user = await verifySupabaseToken(req);
  if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
  const lang = req.body?.lang === 'cz' ? 'cz' : 'sk';
  try {
    await supabase.from('users').update({ lang }).eq('email', user.email);
    res.json({ ok: true });
  } catch (err) {
    console.error('profile lang update:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Vráti existujúci unsubscribe_token usera, alebo mu nový vygeneruje a
// uloží — používajú ho všetky cronové emaily naviazané na users tabuľku.
async function getOrCreateUnsubscribeToken(email) {
  const { data: row } = await supabase.from('users').select('unsubscribe_token').eq('email', email).maybeSingle();
  if (row?.unsubscribe_token) return row.unsubscribe_token;
  const token = require('crypto').randomBytes(24).toString('hex');
  await supabase.from('users').update({ unsubscribe_token: token }).eq('email', email);
  return token;
}`;

patched = replaceOnce(patched, ANCHOR_LANG, NEW_LANG_BLOCK, '1: /api/profile/exam-date anchor');

// ── 2) GET /api/account/unsubscribe — MUSÍ byť PRED SPA fallback catch-all,
// inak ho Express nikdy nedosiahne (rovnaká chyba, akú riešil patch 91 pre
// webinár confirm/unsubscribe) ──
const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;

const UNSUB_ROUTE = `app.get('/api/account/unsubscribe', async (req, res) => {
  const token = (req.query.token || '').toString();
  const { data: user } = token ? await supabase.from('users').select('lang').eq('unsubscribe_token', token).maybeSingle() : { data: null };
  if (user) await supabase.from('users').update({ marketing_emails_opt_out: true }).eq('unsubscribe_token', token);
  const isCz = user?.lang === 'cz';
  const title = isCz ? 'Odhlášeno' : 'Odhlásené';
  const body = isCz
    ? 'Už ti nebudeme posílat automatické e-maily (streak, blížící se termín, generálka).'
    : 'Už ti nebudeme posielať automatické emaily (streak, blížiaci sa termín, generálka).';
  res.set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>' + title + '</h2><p>' + body + '</p></body>');
});

`;

const spaCount = patched.split(SPA_MARKER).length - 1;
if (spaCount !== 1) { console.error('SPA fallback kotva nie je jednoznacna (najdenych: ' + spaCount + '). Nic som nezmenil.'); process.exit(1); }
patched = patched.replace(SPA_MARKER, UNSUB_ROUTE + SPA_MARKER);

const backup = FILE + '.pre-account-lang-unsubscribe-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_email_unsubscribe_and_lang.sql uz bezal.');
