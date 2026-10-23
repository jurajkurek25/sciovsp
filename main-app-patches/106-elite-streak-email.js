// Elite denný email so streakom (Duolingo štýl) + odpočtom do testu.
// Posiela sa LEN userom s plan='elite'. Streak je nezávislý od klanu
// (training_streaks, viď patch 105) — funguje aj pre Elite usera bez klanu.
// Odpočet: ak má user nastavený osobný exam_date (public/app.html), použije
// sa ten; inak padá na najbližší celoplošný termín (rovnaký zoznam ako
// public/index.html candidateDates — udržuj ručne v súlade).
// Vyžaduje: db/migrate_streak_exam_features.sql + emails/elite-streak-daily.html.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('sendEliteStreakEmails')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const NEW_BLOCK = `const { sendMail: sendStreakMail } = require('./mailer');

function loadStreakEmailTemplate() {
  return require('fs').readFileSync(require('path').join(__dirname, 'emails', 'elite-streak-daily.html'), 'utf8');
}
function fillStreakTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  return out;
}
function eliteStreakDaysWord(n) {
  if (n === 1) return 'deň';
  if (n >= 2 && n <= 4) return 'dni';
  return 'dní';
}
// Udržuj ručne v súlade s candidateDates v public/index.html.
const ELITE_STREAK_EXAM_CANDIDATE_DATES = ['2026-12-05'];
function eliteStreakNearestCandidateDate() {
  const now = new Date();
  for (const d of ELITE_STREAK_EXAM_CANDIDATE_DATES) {
    const dt = new Date(d + 'T09:00:00');
    if (dt > now) return dt;
  }
  return null;
}
function eliteStreakDaysUntil(dateObjOrStr) {
  const dt = typeof dateObjOrStr === 'string' ? new Date(dateObjOrStr + 'T09:00:00') : dateObjOrStr;
  if (!dt || isNaN(dt.getTime())) return null;
  return Math.max(0, Math.ceil((dt.getTime() - Date.now()) / 86400000));
}

async function sendEliteStreakEmails() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const { data: eliteUsers } = await supabase.from('users')
      .select('email, exam_date').eq('plan', 'elite').limit(300);
    if (!eliteUsers?.length) return;

    const emails = eliteUsers.map(u => u.email);
    const { data: streakRows } = await supabase.from('training_streaks')
      .select('email, streak_days, last_active_date, best_percentile, last_streak_email_sent_date')
      .in('email', emails);
    const streakByEmail = {};
    for (const row of streakRows || []) streakByEmail[row.email] = row;

    for (const u of eliteUsers) {
      const streakRow = streakByEmail[u.email];
      if (streakRow?.last_streak_email_sent_date === today) continue;

      const trainedToday = streakRow?.last_active_date === today;
      const streakAlive = trainedToday || streakRow?.last_active_date === yesterday;
      const effectiveStreak = streakAlive ? (streakRow?.streak_days || 0) : 0;

      let countdownDays = null;
      if (u.exam_date && new Date(u.exam_date + 'T23:59:59') >= new Date()) {
        countdownDays = eliteStreakDaysUntil(u.exam_date);
      } else {
        const nearest = eliteStreakNearestCandidateDate();
        if (nearest) countdownDays = eliteStreakDaysUntil(nearest);
      }

      let eyebrow, title, bodyHtml;
      if (trainedToday) {
        eyebrow = '🔥 Séria pokračuje';
        title = 'Dnešný tréning máš odškrtnutý — séria ' + effectiveStreak + ' ' + eliteStreakDaysWord(effectiveStreak) + '!';
        bodyHtml = '<p style="margin:0;">Skvelá práca. Zajtra sa vráť a udrž si sériu ďalej.</p>';
      } else if (effectiveStreak > 0) {
        eyebrow = '⚠️ Séria je v ohrození';
        title = 'Tvoja séria ' + effectiveStreak + ' ' + eliteStreakDaysWord(effectiveStreak) + ' dnes zanikne, ak dnes netrénuješ.';
        bodyHtml = '<p style="margin:0;">Stačí jeden test — hocijaký, aj krátky — a sériu si udržíš.</p>';
      } else {
        eyebrow = '💪 Začni novú sériu';
        title = 'Dnes je dobrý deň začať tréningovú sériu.';
        bodyHtml = '<p style="margin:0;">Elite máš presne na toto — AI generátor testov ti pripraví nové otázky presne na mieru.</p>';
      }

      let countdownHtml = '';
      if (countdownDays !== null) {
        countdownHtml = '<p style="margin:14px 0 0;font-weight:600;">📅 Do testu zostáva ' + countdownDays + ' ' + eliteStreakDaysWord(countdownDays) + '.</p>';
      }

      const html = fillStreakTemplate(loadStreakEmailTemplate(), {
        EYEBROW: eyebrow,
        TITLE: title,
        BODY_HTML: bodyHtml + countdownHtml,
        CTA_URL: APP_URL,
        CTA_TEXT: 'Trénovať teraz →'
      });
      await sendStreakMail({ to: u.email, subject: title, html });

      await supabase.from('training_streaks').upsert({
        email: u.email,
        streak_days: streakRow?.streak_days || 0,
        last_active_date: streakRow?.last_active_date || null,
        best_percentile: streakRow?.best_percentile || null,
        last_streak_email_sent_date: today,
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });
    }
  } catch (e) {
    console.error('sendEliteStreakEmails error:', e.message);
  }
}
setInterval(sendEliteStreakEmails, 5 * 60 * 1000);
sendEliteStreakEmails();

app.listen(PORT, () => {`;

const patched = replaceOnce(src, 'app.listen(PORT, () => {', NEW_BLOCK, 'app.listen anchor');

const backup = FILE + '.pre-elite-streak-email-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_streak_exam_features.sql uz bezal (patch 105) a emails/elite-streak-daily.html existuje.');
