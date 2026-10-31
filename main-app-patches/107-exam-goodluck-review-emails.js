// Automatika okolo osobného termínu testu (users.exam_date, nastavuje si
// ho user v appke — viď patch 105 + app.html "Termín testu"):
//   (1) V DEŇ testu: "veľa šťastia" email.
//   (2) DEŇ PO teste: žiadosť o recenziu s odkazom na /recenzia?token=...
// Recenzia sa uloží do app_reviews (bez prihlásenia — identifikuje usera
// jednorazovým tokenom, rovnaký princíp ako webinar confirm_token).
// Vyžaduje: db/migrate_streak_exam_features.sql (patch 105) +
// emails/exam-goodluck.html + emails/exam-review-request.html +
// public/recenzia.html.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('sendExamGoodluckAndReviewEmails')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const NEW_BLOCK = `const { sendMail: sendExamMail } = require('./mailer');
const EXAM_APP_URL = APP_URL.replace(/\\/+$/, '');

function loadExamEmailTemplate(name) {
  return require('fs').readFileSync(require('path').join(__dirname, 'emails', name), 'utf8');
}
function fillExamTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  return out;
}

async function sendExamGoodluckAndReviewEmails() {
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
}
setInterval(sendExamGoodluckAndReviewEmails, 5 * 60 * 1000);
sendExamGoodluckAndReviewEmails();

app.get('/recenzia', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recenzia.html'));
});

app.post('/api/reviews/submit', rateLimit, async (req, res) => {
  const { token, rating, message } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Chýba token.' });
  try {
    const { data: user } = await supabase.from('users').select('email').eq('exam_review_token', token).maybeSingle();
    if (!user) return res.status(404).json({ error: 'Neplatný alebo už použitý odkaz.' });
    const r = Number(rating);
    await supabase.from('app_reviews').insert({
      email: user.email,
      rating: (r >= 1 && r <= 5) ? r : null,
      message: (message || '').toString().trim().slice(0, 2000) || null
    });
    await supabase.from('users').update({ exam_review_token: null }).eq('email', user.email);
    res.json({ ok: true });
  } catch (err) {
    console.error('review submit:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {`;

const patched = replaceOnce(src, 'app.listen(PORT, () => {', NEW_BLOCK, 'app.listen anchor');

const backup = FILE + '.pre-exam-goodluck-review-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_streak_exam_features.sql uz bezal (patch 105), emails/exam-goodluck.html, emails/exam-review-request.html a public/recenzia.html existuju.');
