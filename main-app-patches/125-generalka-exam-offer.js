// Keď sa blíži osobný termín testu (users.exam_date, patch 105/107), ponúkni
// SP Generálku: (1) email 4 dni pred termínom (v strede požadovaného 3-5
// dňového okna), (2) app.html si examDate + hasGeneralka číta z
// /api/auth/status a sama rozhodne o zobrazení popupu v tom istom okne —
// žiadny ďalší server endpoint preto netreba.
// Vyžaduje: db/migrate_generalka_offer.sql + emails/generalka-offer.html
// (rovnaký fillExamTemplate/[BRACKET] vzor ako exam-goodluck.html z patchu 107).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.125-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('sendGeneralkaOfferEmails')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) /api/profile/exam-date — pri zmene termínu resetni aj generalka_offer_sent_at ──
const OLD_RESET = `    await supabase.from('users').update({
      exam_date: examDate || null,
      exam_goodluck_sent_at: null,
      exam_review_token: null,
      exam_review_requested_at: null
    }).eq('email', user.email);`;
const NEW_RESET = `    await supabase.from('users').update({
      exam_date: examDate || null,
      exam_goodluck_sent_at: null,
      exam_review_token: null,
      exam_review_requested_at: null,
      generalka_offer_sent_at: null
    }).eq('email', user.email);`;
patched = replaceOnce(patched, OLD_RESET, NEW_RESET, '1: exam-date reset generalka_offer_sent_at');

// ── 2) /api/auth/status — pridaj hasGeneralka (na potlačenie ponuky, ak uz kupil) ──
const OLD_STATUS = `    const { data: user } = await supabase.from('users')
      .select('is_premium, subscription_status, ref_code, premium_expires_at, plan, exam_date')
      .eq('email', email).single();

    // Premium je aktívny ak: is_premium=true (predplatné) ALEBO premium_expires_at je v budúcnosti (bonus dni)
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    const isPremium = (user?.is_premium || bonusActive) || false;

    res.json({
      isPremium,
      status: user?.subscription_status || 'free',
      plan: user?.plan || (isPremium ? 'premium' : 'free'),
      refCode: user?.ref_code || null,
      premiumExpiresAt: user?.premium_expires_at || null,
      examDate: user?.exam_date || null
    });`;
const NEW_STATUS = `    const { data: user } = await supabase.from('users')
      .select('is_premium, subscription_status, ref_code, premium_expires_at, plan, exam_date')
      .eq('email', email).single();

    // Premium je aktívny ak: is_premium=true (predplatné) ALEBO premium_expires_at je v budúcnosti (bonus dni)
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    const isPremium = (user?.is_premium || bonusActive) || false;

    // Ma uz kupenu/rozbehnutu SP Generalku? (na potlacenie ponuky pred testom)
    const { data: generalkaRow } = await supabase.from('generalka_attempts')
      .select('id').eq('email', email).limit(1).maybeSingle();

    res.json({
      isPremium,
      status: user?.subscription_status || 'free',
      plan: user?.plan || (isPremium ? 'premium' : 'free'),
      refCode: user?.ref_code || null,
      premiumExpiresAt: user?.premium_expires_at || null,
      examDate: user?.exam_date || null,
      hasGeneralka: !!generalkaRow
    });`;
patched = replaceOnce(patched, OLD_STATUS, NEW_STATUS, '2: /api/auth/status hasGeneralka');

// ── 3) Nový cron: email s ponukou Generálky 4 dni pred termínom testu ──
const OLD_CRON_END = `setInterval(sendExamGoodluckAndReviewEmails, 5 * 60 * 1000);
sendExamGoodluckAndReviewEmails();`;
const NEW_CRON_END = `setInterval(sendExamGoodluckAndReviewEmails, 5 * 60 * 1000);
sendExamGoodluckAndReviewEmails();

// 4 dni pred termínom (stred požadovaného 3-5 dňového okna) — jeden email na
// jeden termín, preskočí usera, ktorý uz Generálku ma (kúpenú alebo rozbehnutú).
async function sendGeneralkaOfferEmails() {
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
}
setInterval(sendGeneralkaOfferEmails, 5 * 60 * 1000);
sendGeneralkaOfferEmails();`;
patched = replaceOnce(patched, OLD_CRON_END, NEW_CRON_END, '3: sendGeneralkaOfferEmails cron');

const backup = FILE + '.pre-generalka-exam-offer-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_generalka_offer.sql uz bezal a emails/generalka-offer.html existuje.');
