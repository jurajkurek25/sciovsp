// Dakovny email po KUPE Premium/Elite predplatneho -- osobitny pre kazdy
// tier, a POSLE SA LEN RAZ, pri prvom checkout.session.completed evente
// (Stripe ho pri automatickom mesacnom obnoveni predplatneho nikdy znova
// nevystavi -- obnovenie ide cez invoice.payment_succeeded/invoice.paid,
// ktore tento webhook vobec nespracuje). Takze vlozenim priamo do tejto
// vetvy je "len pri nakupe, nie pri obnove" zarucene bez dalsej podmienky.
//
// Nadvazuje na uz existujuci main-app-patches/218 (dakovny email za kurz)
// -- rovnaky vzor (sendMail + loadWebinarEmailTemplate + fillWebinarTemplate
// + getOrCreateUnsubscribeToken), len pre bezne mesacne predplatne vetvu
// (nie course_purchase/generalka_purchase/membership_purchase, tie uz svoj
// email maju).
//
// Kotva a cely kontext overene naziva (sed -n '400,520p' server.js).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/247-premium-elite-purchase-email.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const EMAILS_DIR = path.join(process.cwd(), 'emails');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
if (!fs.existsSync(EMAILS_DIR)) {
  console.error('❌ Nenašiel som priečinok:', EMAILS_DIR);
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.247-premium-elite-purchase-email-lock');
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

// ── 1) Email šablóny (rovnaký vzor ako emails/course-purchased.html) ────
const PREMIUM_TEMPLATE_PATH = path.join(EMAILS_DIR, 'premium-purchased.html');
const ELITE_TEMPLATE_PATH = path.join(EMAILS_DIR, 'elite-purchased.html');

const PREMIUM_HTML = `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#14100D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14100D;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#241c14;border:1px solid rgba(246,241,231,.14);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 28px 8px;">
<div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.15em;color:#c8ff00;text-transform:uppercase;margin-bottom:12px;">Predplatné aktivované</div>
<h1 style="margin:0 0 14px;color:#F6F1E7;font-size:24px;line-height:1.25;">Vitaj v Premium</h1>
<p style="margin:0 0 18px;color:rgba(246,241,231,.75);font-size:15px;line-height:1.6;">
Ďakujeme za dôveru. Premium prístup je odteraz aktívny — neobmedzené VŠP simulácie, AI generátor úloh aj AI Coach analýza ťa odteraz čakajú po každom teste.
</p>
<div style="background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.2);border-radius:10px;padding:14px 16px;margin-bottom:20px;">
<p style="margin:0 0 8px;color:#F6F1E7;font-size:13px;line-height:1.55;font-weight:600;">Čo máš teraz k dispozícii:</p>
<p style="margin:0;color:rgba(246,241,231,.75);font-size:13px;line-height:1.7;">
✓ Neobmedzené VŠP simulácie s časomierou<br>
✓ AI generátor — nové úlohy každý deň<br>
✓ AI Coach analýza po každom teste<br>
✓ Percentilový tracker + história výsledkov<br>
✓ Cielené precvičovanie slabých miest
</p>
</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td style="border-radius:10px;background:#c8ff00;">
<a href="[APP_URL]" style="display:inline-block;padding:14px 26px;color:#14100D;font-weight:700;font-family:'Courier New',monospace;font-size:14px;text-decoration:none;border-radius:10px;">Spustiť tréning →</a>
</td></tr>
</table>
<p style="margin:18px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
Predplatné sa mesačne automaticky obnovuje a môžeš ho kedykoľvek zrušiť cez zákaznícky portál v appke. Veľa šťastia na percentil 85!
</p>
<p style="margin:14px 0 0;color:rgba(246,241,231,.45);font-size:11px;line-height:1.5;">
ℹ️ Platba sa na výpise z karty alebo bankového účtu zobrazí ako <b>NEOWORKLY.COM</b> — ide o rovnakého prevádzkovateľa platobnej brány, nie o inú firmu.
</p>
<p style="margin:14px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
<a href="[UNSUBSCRIBE]" style="color:rgba(246,241,231,.4);">Odhlásiť tieto emaily</a>
</p>
<p style="margin:10px 0 0;color:rgba(246,241,231,.28);font-size:10px;line-height:1.5;">SP Tréner · Ngroup, s. r. o. · Dunajská 8, 811 08 Bratislava · IČO 53813189 · <a href="https://sptrener.online/legal.html#vop" style="color:rgba(246,241,231,.32);">Obchodné podmienky</a> · <a href="https://sptrener.online/legal.html#privacy" style="color:rgba(246,241,231,.32);">Ochrana osobných údajov</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

const ELITE_HTML = `<!DOCTYPE html>
<html lang="sk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#14100D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14100D;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#241c14;border:1px solid rgba(246,241,231,.14);border-radius:16px;overflow:hidden;">
<tr><td style="padding:32px 28px 8px;">
<div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.15em;color:#ff3f5e;text-transform:uppercase;margin-bottom:12px;">🔥 Elite aktivovaný</div>
<h1 style="margin:0 0 14px;color:#F6F1E7;font-size:24px;line-height:1.25;">Vitaj v Elite. Nesmieš zlyhať.</h1>
<p style="margin:0 0 18px;color:rgba(246,241,231,.75);font-size:15px;line-height:1.6;">
Ďakujeme za dôveru. Elite prístup je odteraz aktívny — všetko z Premium plus AI Mentor, ktorý ti odpovie priamo pod úlohou, a nástroje, ktoré sledujú každú tvoju slabinu.
</p>
<div style="background:rgba(255,63,94,.06);border:1px solid rgba(255,63,94,.2);border-radius:10px;padding:14px 16px;margin-bottom:20px;">
<p style="margin:0 0 8px;color:#F6F1E7;font-size:13px;line-height:1.55;font-weight:600;">Čo máš teraz navyše oproti Premium:</p>
<p style="margin:0;color:rgba(246,241,231,.75);font-size:13px;line-height:1.7;">
✓ 💬 AI Mentor — pýtaj sa priamo pod každou úlohou<br>
✓ 🪞 Mirror Mode — len tvoje slabiny, -15 % času<br>
✓ ⏱ Time-Kill Alert — kde páliš čas zbytočne<br>
✓ 📊 Týždenný Audit — šanca na prijatie v %<br>
✓ 🧩 Zebra Builder — logika krok za krokom<br>
✓ ⚡ Zlatý Status v klanoch<br>
✓ 🔥 Denný streak + odpočet do termínu (email)
</p>
</div>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
<tr><td style="border-radius:10px;background:linear-gradient(135deg,#7c5cff,#ff3f5e);">
<a href="[APP_URL]" style="display:inline-block;padding:14px 26px;color:#F6F1E7;font-weight:700;font-family:'Courier New',monospace;font-size:14px;text-decoration:none;border-radius:10px;">Spustiť tréning →</a>
</td></tr>
</table>
<p style="margin:18px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
Predplatné sa mesačne automaticky obnovuje a môžeš ho kedykoľvek zrušiť cez zákaznícky portál v appke. Nesmieš zlyhať — a s Elite na to nebudeš sám.
</p>
<p style="margin:14px 0 0;color:rgba(246,241,231,.45);font-size:11px;line-height:1.5;">
ℹ️ Platba sa na výpise z karty alebo bankového účtu zobrazí ako <b>NEOWORKLY.COM</b> — ide o rovnakého prevádzkovateľa platobnej brány, nie o inú firmu.
</p>
<p style="margin:14px 0 0;color:rgba(246,241,231,.4);font-size:12px;line-height:1.5;">
<a href="[UNSUBSCRIBE]" style="color:rgba(246,241,231,.4);">Odhlásiť tieto emaily</a>
</p>
<p style="margin:10px 0 0;color:rgba(246,241,231,.28);font-size:10px;line-height:1.5;">SP Tréner · Ngroup, s. r. o. · Dunajská 8, 811 08 Bratislava · IČO 53813189 · <a href="https://sptrener.online/legal.html#vop" style="color:rgba(246,241,231,.32);">Obchodné podmienky</a> · <a href="https://sptrener.online/legal.html#privacy" style="color:rgba(246,241,231,.32);">Ochrana osobných údajov</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

if (fs.existsSync(PREMIUM_TEMPLATE_PATH) || fs.existsSync(ELITE_TEMPLATE_PATH)) {
  console.error('❌ emails/premium-purchased.html alebo elite-purchased.html už existuje, nič som nezmenil.');
  process.exit(1);
}
fs.writeFileSync(PREMIUM_TEMPLATE_PATH, PREMIUM_HTML);
fs.writeFileSync(ELITE_TEMPLATE_PATH, ELITE_HTML);

// ── 2) server.js -- odoslanie emailu v existujúcej vetve bežného ────────
// mesačného predplatného (checkout.session.completed, bez session.metadata
// .type -- course_purchase/gift_card_purchase/generalka_purchase/
// membership_purchase majú vlastné vetvy a vlastné emaily vyššie a tu sa
// už nedostanú kvôli skorším `break;`).
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('premium-purchased.html') || server.includes('elite-purchased.html')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `        console.log('✅ Premium aktivovaný:', email);

        // Odošli kredit partnerovi ak platba prišla cez partner ref kód
        const partnerRef = session.metadata?.partner_ref || null;`;

const NEW = `        console.log('✅ Premium aktivovaný:', email);

        try {
          const { sendMail } = require('./mailer');
          const subUnsubToken = await getOrCreateUnsubscribeToken(email);
          const subTemplateName = sessionPlan === 'elite' ? 'elite-purchased.html' : 'premium-purchased.html';
          const subSubject = sessionPlan === 'elite' ? '🔥 Vitaj v Elite — SP Tréner' : 'Vitaj v Premium — SP Tréner';
          const subPurchasedHtml = fillWebinarTemplate(loadWebinarEmailTemplate(subTemplateName), {
            APP_URL: 'https://sptrener.online/app',
            UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + subUnsubToken
          });
          sendMail({ to: email, subject: subSubject, html: subPurchasedHtml }).catch(() => {});
        } catch (e) {
          console.error('premium/elite purchase email error:', e.message);
        }

        // Odošli kredit partnerovi ak platba prišla cez partner ref kód
        const partnerRef = session.metadata?.partner_ref || null;`;

if (!server.includes(OLD)) {
  console.error('❌ Nenašiel som presnú kotvu v server.js (checkout.session.completed, Premium aktivovaný). Nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server, OLD, NEW, 'checkout.session.completed -> dakovny email Premium/Elite');

const backup = SERVER_PATH + '.pre-247-premium-elite-purchase-email-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Pridané: emails/premium-purchased.html, emails/elite-purchased.html');
console.log('✅ server.js: dakovny email sa teraz posiela pri PRVOM nakupe Premium/Elite (checkout.session.completed), nie pri obnove.');
console.log('   Záloha server.js:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
