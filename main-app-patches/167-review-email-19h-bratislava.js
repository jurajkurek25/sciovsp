// Presúva odoslanie "ako to dnes dopadlo" (recenzia) emailu z "deň PO
// skúške, UTC polnoc" na "VEČER V DEŇ SKÚŠKY, okolo 19:00 podľa
// bratislavského času" (Europe/Bratislava, automaticky rieši
// letný/zimný čas cez Intl API — žiadna rucna +1/+2 aritmetika).
//
// Podmienka je hourBratislava >= 19 (nie presne ===19), zámerne — ak by
// appka spadla/reštartovala práve v 19:xx, odošle sa to hocikedy zvyšok
// večera namiesto toho, aby dotyčný email nedostal vôbec (queries su aj
// tak chránené is('exam_review_requested_at', null), takže sa nikdy
// neposiela duplicitne).
//
// Predpoklad: presny ziva text funkcie sendExamGoodluckAndReviewEmails()
// v server.js (over cez sed -n '5980,5998p' server.js pred behom, ak
// tento patch zlyha na "kotva nie je jednoznačná").
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/167-review-email-19h-bratislava.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.167-review-email-19h-bratislava-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('todayBratislava')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = [
  "    // (2) Deň po teste — žiadosť o recenziu",
  "    const { data: dueReview } = await supabase.from('users')",
  "      .select('email, lang').eq('exam_date', yesterday).eq('marketing_emails_opt_out', false).is('exam_review_requested_at', null).limit(200);",
  "    for (const u of dueReview || []) {",
  "      const isCz = u.lang === 'cz';",
  "      const token = require('crypto').randomBytes(24).toString('hex');",
  "      const unsubToken = await getOrCreateUnsubscribeToken(u.email);",
  "      const html = fillExamTemplate(loadExamEmailTemplate(isCz ? 'exam-review-request-cz.html' : 'exam-review-request.html'), {",
  "        REVIEW_URL: EXAM_APP_URL + '/recenzia?token=' + token,",
  "        UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + unsubToken",
  "      });",
  "      await sendExamMail({ to: u.email, subject: isCz ? 'Jak to dneska dopadlo? Napiš nám pár slov 🙏' : 'Ako to dnes dopadlo? Napíš nám pár slov 🙏', html });",
  "      await supabase.from('users').update({",
  "        exam_review_token: token,",
  "        exam_review_requested_at: new Date().toISOString()",
  "      }).eq('email', u.email);",
  "    }"
].join('\n');

const NEW = [
  "    // (2) Večer v deň skúšky (od ~19:00 bratislavského času) — žiadosť o recenziu",
  "    const bratislavaParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bratislava', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date());",
  "    const getBratislavaPart = (type) => bratislavaParts.find(p => p.type === type).value;",
  "    const todayBratislava = getBratislavaPart('year') + '-' + getBratislavaPart('month') + '-' + getBratislavaPart('day');",
  "    const hourBratislava = Number(getBratislavaPart('hour')) % 24;",
  "    if (hourBratislava >= 19) {",
  "      const { data: dueReview } = await supabase.from('users')",
  "        .select('email, lang').eq('exam_date', todayBratislava).eq('marketing_emails_opt_out', false).is('exam_review_requested_at', null).limit(200);",
  "      for (const u of dueReview || []) {",
  "        const isCz = u.lang === 'cz';",
  "        const token = require('crypto').randomBytes(24).toString('hex');",
  "        const unsubToken = await getOrCreateUnsubscribeToken(u.email);",
  "        const html = fillExamTemplate(loadExamEmailTemplate(isCz ? 'exam-review-request-cz.html' : 'exam-review-request.html'), {",
  "          REVIEW_URL: EXAM_APP_URL + '/recenzia?token=' + token,",
  "          UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + unsubToken",
  "        });",
  "        await sendExamMail({ to: u.email, subject: isCz ? 'Jak to dneska dopadlo? Napiš nám pár slov 🙏' : 'Ako to dnes dopadlo? Napíš nám pár slov 🙏', html });",
  "        await supabase.from('users').update({",
  "          exam_review_token: token,",
  "          exam_review_requested_at: new Date().toISOString()",
  "        }).eq('email', u.email);",
  "      }",
  "    }"
].join('\n');

server = replaceOnce(server, OLD, NEW, 'sendExamGoodluckAndReviewEmails() -> 19:00 Bratislava, deň skúšky');

const backup = SERVER_PATH + '.pre-review-email-19h-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Recenzný email sa teraz posiela večer v deň skúšky (od ~19:00 bratislavského času), nie deň po nej o polnoci UTC.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
