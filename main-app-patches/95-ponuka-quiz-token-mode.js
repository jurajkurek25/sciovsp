// Extends public/ponuka.html (NOT git-synced — patched directly, same as
// server.js) to support arriving via a /kam-na-vysoku discount email link
// (?src=quiz&token=...): server-validated deadline instead of the webinar
// cookie, and checkout without requiring another Google login (the token
// itself, delivered only to the lead's inbox, is the identity proof —
// mirrors how the webinar confirm/unsubscribe links already work).
// The existing webinar-cookie path is completely untouched when no token
// is present.
//
// Anchor confidence: based on the git history of main-app-patches/ponuka.html
// in the sciovsp repo. If any anchor below is not found, this aborts
// cleanly without changing anything — send me `grep -n "startPlanCheckout\|hasWebinarRegistration" public/ponuka.html`
// and I'll adjust.
const fs = require('fs');
const FILE = 'public/ponuka.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('quizToken')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.split(oldStr).join(newStr);
}

let patched = src;

// ── 1) Insert quiz-token mode support right before startPlanCheckout ──
patched = replaceOnce(patched,
`async function startPlanCheckout(tier) {
  const feedback = document.getElementById('planFeedback');
  feedback.textContent = '';
  if (!currentUser) {
    await _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
    return;
  }`,
`// ── /kam-na-vysoku discount-email mode ──────────────────────────────────
// Ak návštevník príde s ?src=quiz&token=..., email aj deadline sa berú
// server-side z career_quiz_results (nie z cookie/localStorage ako pri
// webinári) — netreba ani opätovné prihlásenie cez Google, token z
// e-mailu (doručený len na jeho schránku) je dostatočný dôkaz identity.
let quizToken = null;
let quizDeadlineMs = null;

async function initQuizOfferMode() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (!token || params.get('src') !== 'quiz') return false;
  try {
    const res = await fetch('/api/quiz-offer/validate?token=' + encodeURIComponent(token));
    if (!res.ok) { enterExpiredMode(); return true; }
    const data = await res.json();
    quizToken = token;
    if (data.expired) {
      enterExpiredMode();
    } else {
      quizDeadlineMs = new Date(data.deadline).getTime();
      setInterval(tickClockQuiz, 1000);
      tickClockQuiz();
    }
  } catch (e) {
    enterExpiredMode();
  }
  return true;
}
function tickClockQuiz() {
  const remaining = quizDeadlineMs - Date.now();
  if (remaining <= 0) { enterExpiredMode(); return; }
  const clockEl = document.getElementById('clock');
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  clockEl.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

async function startPlanCheckout(tier) {
  const feedback = document.getElementById('planFeedback');
  feedback.textContent = '';
  if (!quizToken && !currentUser) {
    await _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
    return;
  }`,
  '1: startPlanCheckout / quiz token mode');

// ── 2) Checkout request body: include token, email optional when token present ──
patched = replaceOnce(patched,
`      body: JSON.stringify({ email: currentUser.email, tier, months: duration, pricingMode: offerExpired ? 'classic' : 'promo', refCode: sessionStorage.getItem('partner_ref') || null })`,
`      body: JSON.stringify({ email: quizToken ? undefined : currentUser.email, tier, months: duration, pricingMode: offerExpired ? 'classic' : 'promo', refCode: sessionStorage.getItem('partner_ref') || null, token: quizToken || undefined })`,
  '2: checkout request body');

// ── 3) Init block: try quiz-token mode first, fall back to webinar-cookie mode ──
patched = replaceOnce(patched,
`setLang(lang);

// Spustené až po setLang (nie skôr) — ak návštevník príde na stránku
// s už uplynutým deadlinom (napr. na druhý deň), enterExpiredMode()
// volá t(), ktoré potrebuje T definované vyššie v skripte.
if (hasWebinarRegistration()) {
  setInterval(tickClock, 1000);
  tickClock();
} else {
  enterExpiredMode();
}`,
`setLang(lang);

// Spustené až po setLang (nie skôr) — ak návštevník príde na stránku
// s už uplynutým deadlinom (napr. na druhý deň), enterExpiredMode()
// volá t(), ktoré potrebuje T definované vyššie v skripte.
(async () => {
  const isQuizMode = await initQuizOfferMode();
  if (isQuizMode) return;
  if (hasWebinarRegistration()) {
    setInterval(tickClock, 1000);
    tickClock();
  } else {
    enterExpiredMode();
  }
})();`,
  '3: bottom init block');

const backup = FILE + '.pre-quiz-token-mode-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
