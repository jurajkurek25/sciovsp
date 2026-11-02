// Rozšíri sendGeneralkaOfferEmails() (patch 125) o: (1) český variant emailu
// podľa users.lang, (2) vynechanie opt-out userov, (3) unsubscribe odkaz.
// Vyžaduje patch 126 (getOrCreateUnsubscribeToken) + emails/generalka-offer-cz.html.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.129-lock';
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
if (src.includes('generalka-offer-cz.html')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD_FN = `async function sendGeneralkaOfferEmails() {
  try {
    const target = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
    const { data: due } = await supabase.from('users')
      .select('email, exam_date').eq('exam_date', target).is('generalka_offer_sent_at', null).limit(200);
    for (const u of due || []) {
      const { data: existing } = await supabase.from('generalka_attempts').select('id').eq('email', u.email).limit(1).maybeSingle();
      if (existing) {
        await supabase.from('users').update({ generalka_offer_sent_at: new Date().toISOString() }).eq('email', u.email);
        continue;
      }
      const html = fillExamTemplate(loadExamEmailTemplate('generalka-offer.html'), {
        EXAM_DATE: new Date(u.exam_date).toLocaleDateString('sk-SK'),
        CTA_URL: EXAM_APP_URL + '/generalka'
      });
      await sendExamMail({ to: u.email, subject: 'Tvoj test sa blíži — vyskúšaj si ho naostro', html });
      await supabase.from('users').update({ generalka_offer_sent_at: new Date().toISOString() }).eq('email', u.email);
    }
  } catch (e) {
    console.error('sendGeneralkaOfferEmails error:', e.message);
  }
}`;

const NEW_FN = `async function sendGeneralkaOfferEmails() {
  try {
    const target = new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0];
    const { data: due } = await supabase.from('users')
      .select('email, exam_date, lang').eq('exam_date', target).eq('marketing_emails_opt_out', false).is('generalka_offer_sent_at', null).limit(200);
    for (const u of due || []) {
      const { data: existing } = await supabase.from('generalka_attempts').select('id').eq('email', u.email).limit(1).maybeSingle();
      if (existing) {
        await supabase.from('users').update({ generalka_offer_sent_at: new Date().toISOString() }).eq('email', u.email);
        continue;
      }
      const isCz = u.lang === 'cz';
      const unsubToken = await getOrCreateUnsubscribeToken(u.email);
      const html = fillExamTemplate(loadExamEmailTemplate(isCz ? 'generalka-offer-cz.html' : 'generalka-offer.html'), {
        EXAM_DATE: new Date(u.exam_date).toLocaleDateString(isCz ? 'cs-CZ' : 'sk-SK'),
        CTA_URL: EXAM_APP_URL + '/generalka',
        UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + unsubToken
      });
      await sendExamMail({ to: u.email, subject: isCz ? 'Tvůj test se blíží — vyzkoušej si ho naostro' : 'Tvoj test sa blíži — vyskúšaj si ho naostro', html });
      await supabase.from('users').update({ generalka_offer_sent_at: new Date().toISOString() }).eq('email', u.email);
    }
  } catch (e) {
    console.error('sendGeneralkaOfferEmails error:', e.message);
  }
}`;

const patched = replaceOnce(src, OLD_FN, NEW_FN, 'sendGeneralkaOfferEmails');

const backup = FILE + '.pre-generalka-offer-lang-unsub-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze emails/generalka-offer-cz.html existuje.');
