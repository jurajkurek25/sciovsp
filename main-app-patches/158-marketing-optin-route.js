// Zrkadlova routa k existujucemu /api/account/unsubscribe — potvrdenie
// (opt-in) marketingovych/affiliate emailov cez klik na odkaz v
// jednorazovom re-permission emaile (159-send-marketing-reconsent-emails.js).
// Pouziva ten isty unsubscribe_token, ziadny novy stlpec netreba.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.158-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/api/account/marketing-optin'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnceRegex(s, regex, buildNew, label) {
  const g = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const matches = s.match(g);
  const count = matches ? matches.length : 0;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(regex, buildNew);
}

const OLD = /res\.set\('Content-Type', 'text\/html; charset=utf-8'\)\.send\('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>'\s*\+\s*title\s*\+\s*'<\/h2><p>'\s*\+\s*body\s*\+\s*'<\/p><\/body>'\);\s*\}\);/;

const patched = replaceOnceRegex(src, OLD, (m) => m + `

app.get('/api/account/marketing-optin', async (req, res) => {
  const token = (req.query.token || '').toString();
  const { data: user } = token ? await supabase.from('users').select('lang').eq('unsubscribe_token', token).maybeSingle() : { data: null };
  if (user) await supabase.from('users').update({ marketing_emails_opt_out: false }).eq('unsubscribe_token', token);
  const isCz = user?.lang === 'cz';
  const title = isCz ? 'Děkujeme!' : 'Ďakujeme!';
  const body = isCz
    ? 'Teď ti budeme posílat i doporučení a nabídky od partnerů. Kdykoliv se můžeš odhlásit.'
    : 'Teraz ti budeme posielať aj odporúčania a ponuky od partnerov. Kedykoľvek sa môžeš odhlásiť.';
  res.set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>' + title + '</h2><p>' + body + '</p></body>');
});`,
  '1: /api/account/marketing-optin route');

const backup = FILE + '.pre-marketing-optin-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
