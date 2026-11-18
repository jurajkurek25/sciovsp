// Rozšíri sendExamGoodluckAndReviewEmails() (patch 107) o: (1) český
// variant emailov podľa users.lang, (2) vynechanie opt-out userov,
// (3) unsubscribe odkaz. Zároveň OPRAVUJE predtým nezistenú chybu:
// GET /recenzia (pridané patchom 107 pred app.listen) bolo registrované
// AŽ ZA "SPA fallback" catch-all routou, takže ho Express nikdy
// nedosiahol — rovnaká chyba, akú patch 91 opravil pre webinár
// confirm/unsubscribe. Presúva ho PRED SPA fallback.
// Vyžaduje patch 126 (getOrCreateUnsubscribeToken) + emails/exam-goodluck-cz.html
// + emails/exam-review-request-cz.html.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.128-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (!src.includes('getOrCreateUnsubscribeToken')) {
  console.error('Patch 126 (getOrCreateUnsubscribeToken) este nie je aplikovany. Spusti ho najprv. Nic som nezmenil.');
  process.exit(1);
}
if (src.includes('exam-review-request-cz.html')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) sendExamGoodluckAndReviewEmails — CZ vetva + opt-out + unsubscribe ──
const OLD_FN = `async function sendExamGoodluckAndReviewEmails() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // (1) Deň testu — veľa šťastia
    const { data: dueGoodluck } = await supabase.from('users')
      .select('email').eq('exam_date', today).is('exam_goodluck_sent_at', null).limit(200);
    for (const u of dueGoodluck || []) {
      const html = fillExamTemplate(loadExamEmailTemplate('exam-goodluck.html'), {
        CTA_URL: EXAM_APP_URL + '/app'
      });
      await sendExamMail({ to: u.email, subject: 'Veľa šťastia na dnešnom teste! 🍀', html });
      await supabase.from('users').update({ exam_goodluck_sent_at: new Date().toISOString() }).eq('email', u.email);
    }

    // (2) Deň po teste — žiadosť o recenziu
    const { data: dueReview } = await supabase.from('users')
      .select('email').eq('exam_date', yesterday).is('exam_review_requested_at', null).limit(200);
    for (const u of dueReview || []) {
      const token = require('crypto').randomBytes(24).toString('hex');
      const html = fillExamTemplate(loadExamEmailTemplate('exam-review-request.html'), {
        REVIEW_URL: EXAM_APP_URL + '/recenzia?token=' + token
      });
      await sendExamMail({ to: u.email, subject: 'Ako to dnes dopadlo? Napíš nám pár slov 🙏', html });
      await supabase.from('users').update({
        exam_review_token: token,
        exam_review_requested_at: new Date().toISOString()
      }).eq('email', u.email);
    }
  } catch (e) {
    console.error('sendExamGoodluckAndReviewEmails error:', e.message);
  }
}`;

const NEW_FN = `async function sendExamGoodluckAndReviewEmails() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // (1) Deň testu — veľa šťastia
    const { data: dueGoodluck } = await supabase.from('users')
      .select('email, lang').eq('exam_date', today).eq('marketing_emails_opt_out', false).is('exam_goodluck_sent_at', null).limit(200);
    for (const u of dueGoodluck || []) {
      const isCz = u.lang === 'cz';
      const unsubToken = await getOrCreateUnsubscribeToken(u.email);
      const html = fillExamTemplate(loadExamEmailTemplate(isCz ? 'exam-goodluck-cz.html' : 'exam-goodluck.html'), {
        CTA_URL: EXAM_APP_URL + '/app',
        UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + unsubToken
      });
      await sendExamMail({ to: u.email, subject: isCz ? 'Hodně štěstí u dnešního testu! 🍀' : 'Veľa šťastia na dnešnom teste! 🍀', html });
      await supabase.from('users').update({ exam_goodluck_sent_at: new Date().toISOString() }).eq('email', u.email);
    }

    // (2) Deň po teste — žiadosť o recenziu
    const { data: dueReview } = await supabase.from('users')
      .select('email, lang').eq('exam_date', yesterday).eq('marketing_emails_opt_out', false).is('exam_review_requested_at', null).limit(200);
    for (const u of dueReview || []) {
      const isCz = u.lang === 'cz';
      const token = require('crypto').randomBytes(24).toString('hex');
      const unsubToken = await getOrCreateUnsubscribeToken(u.email);
      const html = fillExamTemplate(loadExamEmailTemplate(isCz ? 'exam-review-request-cz.html' : 'exam-review-request.html'), {
        REVIEW_URL: EXAM_APP_URL + '/recenzia?token=' + token,
        UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + unsubToken
      });
      await sendExamMail({ to: u.email, subject: isCz ? 'Jak to dneska dopadlo? Napiš nám pár slov 🙏' : 'Ako to dnes dopadlo? Napíš nám pár slov 🙏', html });
      await supabase.from('users').update({
        exam_review_token: token,
        exam_review_requested_at: new Date().toISOString()
      }).eq('email', u.email);
    }
  } catch (e) {
    console.error('sendExamGoodluckAndReviewEmails error:', e.message);
  }
}`;

patched = replaceOnce(patched, OLD_FN, NEW_FN, '1: sendExamGoodluckAndReviewEmails');

// ── 2) Presuň GET /recenzia PRED SPA fallback (bola za nim, nikdy nedosiahnutá) ──
const RECENZIA_ROUTE = `app.get('/recenzia', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recenzia.html'));
});`;

const removedCount = patched.split(RECENZIA_ROUTE).length - 1;
if (removedCount !== 1) { console.error('2: RECENZIA_ROUTE kotva nie je jednoznacna (najdenych: ' + removedCount + '). Nic som nezmenil.'); process.exit(1); }
patched = patched.replace('\n\n' + RECENZIA_ROUTE, '').replace(RECENZIA_ROUTE + '\n\n', '').replace(RECENZIA_ROUTE, '');

const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;
const spaCount = patched.split(SPA_MARKER).length - 1;
if (spaCount !== 1) { console.error('2: SPA fallback kotva nie je jednoznacna (najdenych: ' + spaCount + '). Nic som nezmenil.'); process.exit(1); }
patched = patched.replace(SPA_MARKER, RECENZIA_ROUTE + '\n\n' + SPA_MARKER);

const backup = FILE + '.pre-exam-goodluck-review-lang-unsub-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze emails/exam-goodluck-cz.html a emails/exam-review-request-cz.html existuju.');
console.log('POZOR: /recenzia bolo pravdepodobne od patchu 107 nedosiahnutelne (za SPA fallbackom) - tento patch to opravuje. Over po deployi, ze GET /recenzia?token=... vracia stranku, nie SPA appku.');
