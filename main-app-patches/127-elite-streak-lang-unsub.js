// Rozšíri sendEliteStreakEmails() (patch 106) o: (1) český variant obsahu
// podľa users.lang, (2) vynechanie userov s marketing_emails_opt_out,
// (3) unsubscribe odkaz. Vyžaduje patch 126 (getOrCreateUnsubscribeToken)
// a db/migrate_email_unsubscribe_and_lang.sql.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.127-lock';
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
if (src.includes('eliteStreakDaysWord(n, isCz)')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) eliteStreakDaysWord — pridaj CZ vetvu ──
const OLD_WORD = `function eliteStreakDaysWord(n) {
  if (n === 1) return 'deň';
  if (n >= 2 && n <= 4) return 'dni';
  return 'dní';
}`;
const NEW_WORD = `function eliteStreakDaysWord(n, isCz) {
  if (isCz) {
    if (n === 1) return 'den';
    if (n >= 2 && n <= 4) return 'dny';
    return 'dní';
  }
  if (n === 1) return 'deň';
  if (n >= 2 && n <= 4) return 'dni';
  return 'dní';
}`;
patched = replaceOnce(patched, OLD_WORD, NEW_WORD, '1: eliteStreakDaysWord');

// ── 2) query — pridaj lang + preskoč opt-out userov ──
const OLD_QUERY = `    const { data: eliteUsers } = await supabase.from('users')
      .select('email, exam_date').eq('plan', 'elite').limit(300);`;
const NEW_QUERY = `    const { data: eliteUsers } = await supabase.from('users')
      .select('email, exam_date, lang').eq('plan', 'elite').eq('marketing_emails_opt_out', false).limit(300);`;
patched = replaceOnce(patched, OLD_QUERY, NEW_QUERY, '2: eliteUsers query');

// ── 3) obsah emailu — CZ vetva + unsubscribe ──
const OLD_CONTENT = `      let eyebrow, title, bodyHtml;
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
      await sendStreakMail({ to: u.email, subject: title, html });`;

const NEW_CONTENT = `      const isCz = u.lang === 'cz';
      let eyebrow, title, bodyHtml;
      if (trainedToday) {
        eyebrow = isCz ? '🔥 Série pokračuje' : '🔥 Séria pokračuje';
        title = isCz
          ? 'Dnešní trénink máš odškrtnutý — série ' + effectiveStreak + ' ' + eliteStreakDaysWord(effectiveStreak, isCz) + '!'
          : 'Dnešný tréning máš odškrtnutý — séria ' + effectiveStreak + ' ' + eliteStreakDaysWord(effectiveStreak, isCz) + '!';
        bodyHtml = isCz
          ? '<p style="margin:0;">Skvělá práce. Zítra se vrať a udrž si sérii dál.</p>'
          : '<p style="margin:0;">Skvelá práca. Zajtra sa vráť a udrž si sériu ďalej.</p>';
      } else if (effectiveStreak > 0) {
        eyebrow = isCz ? '⚠️ Série je v ohrožení' : '⚠️ Séria je v ohrození';
        title = isCz
          ? 'Tvoje série ' + effectiveStreak + ' ' + eliteStreakDaysWord(effectiveStreak, isCz) + ' dnes zanikne, pokud dnes netrénuješ.'
          : 'Tvoja séria ' + effectiveStreak + ' ' + eliteStreakDaysWord(effectiveStreak, isCz) + ' dnes zanikne, ak dnes netrénuješ.';
        bodyHtml = isCz
          ? '<p style="margin:0;">Stačí jeden test — jakýkoliv, i krátký — a sérii si udržíš.</p>'
          : '<p style="margin:0;">Stačí jeden test — hocijaký, aj krátky — a sériu si udržíš.</p>';
      } else {
        eyebrow = isCz ? '💪 Začni novou sérii' : '💪 Začni novú sériu';
        title = isCz ? 'Dnes je dobrý den začít tréninkovou sérii.' : 'Dnes je dobrý deň začať tréningovú sériu.';
        bodyHtml = isCz
          ? '<p style="margin:0;">Elite máš přesně na tohle — AI generátor testů ti připraví nové otázky přesně na míru.</p>'
          : '<p style="margin:0;">Elite máš presne na toto — AI generátor testov ti pripraví nové otázky presne na mieru.</p>';
      }

      let countdownHtml = '';
      if (countdownDays !== null) {
        countdownHtml = isCz
          ? '<p style="margin:14px 0 0;font-weight:600;">📅 Do testu zbývá ' + countdownDays + ' ' + eliteStreakDaysWord(countdownDays, isCz) + '.</p>'
          : '<p style="margin:14px 0 0;font-weight:600;">📅 Do testu zostáva ' + countdownDays + ' ' + eliteStreakDaysWord(countdownDays, isCz) + '.</p>';
      }

      const unsubToken = await getOrCreateUnsubscribeToken(u.email);
      const html = fillStreakTemplate(loadStreakEmailTemplate(), {
        EYEBROW: eyebrow,
        TITLE: title,
        BODY_HTML: bodyHtml + countdownHtml,
        CTA_URL: APP_URL,
        CTA_TEXT: isCz ? 'Trénovat teď →' : 'Trénovať teraz →',
        FOOTER_NOTE: isCz ? 'Automatický e-mail na základě tvé aktivity v appce.' : 'Automatický email na základe tvojej aktivity v appke.',
        UNSUBSCRIBE_TEXT: isCz ? 'Odhlásit tyto e-maily' : 'Odhlásiť tieto emaily',
        UNSUBSCRIBE: APP_URL + '/api/account/unsubscribe?token=' + unsubToken
      });
      await sendStreakMail({ to: u.email, subject: title, html });`;

patched = replaceOnce(patched, OLD_CONTENT, NEW_CONTENT, '3: email content block');

const backup = FILE + '.pre-elite-streak-lang-unsub-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze emails/elite-streak-daily.html ma placeholdery [FOOTER_NOTE] a [UNSUBSCRIBE]/[UNSUBSCRIBE_TEXT].');
