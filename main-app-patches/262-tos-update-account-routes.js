// Jednorazová zmena obchodných podmienok (main-app-patches/261 — telefón +
// marketing bonus-test v legal.html) — dáva userom možnosť jedným klikom z
// emailu buď "súhlasím, pokračovať", alebo "nesúhlasím, vymaž môj účet".
// Ak do termínu nereagujú, main-app-patches/264 ich vymaže automaticky
// (rovnaká deleteUserAccountCompletely() z delete-account.js).
//
// Vyžaduje: db/migrate_tos_update_2026.sql + delete-account.js (koreň appky).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/262-tos-update-account-routes.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.262-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor (' + LOCK + ') existuje. Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/api/account/tos-delete')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

// MUSÍ byť PRED SPA fallback catch-all, inak ho Express nikdy nedosiahne
// (rovnaká chyba, akú riešil patch 91/126 pre webinár/unsubscribe routy).
const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;

const NEW_ROUTES = `// ── main-app-patches/262: zmena obchodných podmienok — potvrdenie / vymazanie účtu ──
function tosPage(title, body) {
  return '<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>' + title + '</h2><p>' + body + '</p></body>';
}

app.get('/api/account/tos-confirm', async (req, res) => {
  const token = (req.query.token || '').toString();
  const { data: user } = token ? await supabase.from('users').select('email, lang').eq('tos_update_token', token).maybeSingle() : { data: null };
  const isCz = user?.lang === 'cz';
  if (user) {
    await supabase.from('users').update({ tos_update_status: 'confirmed', tos_update_confirmed_at: new Date().toISOString() }).eq('tos_update_token', token);
  }
  const title = user ? 'Ďakujeme' : (isCz ? 'Odkaz už není platný' : 'Odkaz už neplatí');
  const body = user
    ? (isCz ? 'Potvrdil/a jsi nové podmínky. Tvůj účet pokračuje bez omezení.' : 'Potvrdil/a si nové podmienky. Tvoj účet pokračuje bez obmedzení.')
    : (isCz ? 'Tento odkaz už byl použit, nebo účet už neexistuje.' : 'Tento odkaz už bol použitý, alebo účet už neexistuje.');
  res.set('Content-Type', 'text/html; charset=utf-8').send(tosPage(title, body));
});

app.get('/api/account/tos-delete', async (req, res) => {
  const token = (req.query.token || '').toString();
  const { data: user } = token ? await supabase.from('users').select('email, lang').eq('tos_update_token', token).maybeSingle() : { data: null };
  const isCz = user?.lang === 'cz';
  if (user) {
    try {
      const { deleteUserAccountCompletely } = require('./delete-account');
      await deleteUserAccountCompletely(supabase, stripe, user.email);
    } catch (e) {
      console.error('tos-delete:', e.message);
    }
  }
  const title = user ? (isCz ? 'Účet vymazán' : 'Účet vymazaný') : (isCz ? 'Odkaz už není platný' : 'Odkaz už neplatí');
  const body = user
    ? (isCz ? 'Tvůj účet a všechna data s ním spojená byla trvale vymazána.' : 'Tvoj účet a všetky dáta s ním spojené boli trvalo vymazané.')
    : (isCz ? 'Tento odkaz už byl použit, nebo účet už neexistuje.' : 'Tento odkaz už bol použitý, alebo účet už neexistuje.');
  res.set('Content-Type', 'text/html; charset=utf-8').send(tosPage(title, body));
});

`;

const patched = replaceExactCount(src, SPA_MARKER, NEW_ROUTES + SPA_MARKER, 1, 'SPA fallback kotva');

const backup = FILE + '.pre-262-tos-update-account-routes-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('✅ server.js: pridané /api/account/tos-confirm a /api/account/tos-delete.');
console.log('   Záloha:', backup);
console.log('   Over, že db/migrate_tos_update_2026.sql uz bezal a delete-account.js je na serveri, potom:');
console.log('   pm2 restart sptrener-main');
