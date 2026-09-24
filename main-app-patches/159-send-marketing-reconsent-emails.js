// JEDNORAZOVY skript — NIE je to patch na server.js, iba sa spusti PRIAMO
// (node main-app-patches/159-send-marketing-reconsent-emails.js), z korena
// hlavnej appky (kde je .env, node_modules, mailer.js).
//
// Posle vsetkym existujucim pouzivatelom (users tabulka) jednorazovy
// re-permission email s otazkou, ci chcu dostavat affiliate/partnerske
// ponuky. Bezpecne spustitelne viackrat — kazdemu sa posle len raz
// (filtruje podla remarketing_consent_email_sent_at IS NULL, oznaci hned
// po uspesnom odoslani).
//
// Vyzaduje uz spustenu db/migrate_marketing_opt_out_default.sql a nahraty
// emails/marketing-reconsent.html + main-app-patches/158-marketing-optin-route.js
// (inak by odkaz v emaile smeroval na neexistujucu routu).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendMail } = require('./mailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APP_URL = process.env.APP_URL || 'https://sptrener.online/app';
const EXAM_APP_URL = APP_URL.replace(/\/+$/, '');

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'emails', name), 'utf8');
}
function fillTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  return out;
}
async function getOrCreateUnsubscribeToken(email) {
  const { data: row } = await supabase.from('users').select('unsubscribe_token').eq('email', email).maybeSingle();
  if (row?.unsubscribe_token) return row.unsubscribe_token;
  const token = require('crypto').randomBytes(24).toString('hex');
  await supabase.from('users').update({ unsubscribe_token: token }).eq('email', email);
  return token;
}

async function main() {
  const { data: users, error } = await supabase.from('users').select('email').is('remarketing_consent_email_sent_at', null);
  if (error) { console.error('Chyba načítania users:', error.message); process.exit(1); }
  console.log('Počet na odoslanie:', (users || []).length);

  let sent = 0, failed = 0;
  for (const u of (users || [])) {
    try {
      // Najprv vypnut (opt_out=true) — ak clovek email ignoruje, ostava
      // vypnuty. Az klik na odkaz v emaile (marketing-optin routa) ho
      // vrati na false. Nastavuje sa PRED odoslanim, nie po — ak by skript
      // zlyhal medzi odoslanim a oznacenim remarketing_consent_email_sent_at,
      // bezpecnejsie je nechat cloveka vypnuteho (skript ho pri dalsom
      // behu skusi znova) nez ho omylom nechat zapnuteho bez suhlasu.
      await supabase.from('users').update({ marketing_emails_opt_out: true }).eq('email', u.email);
      const token = await getOrCreateUnsubscribeToken(u.email);
      const optinUrl = EXAM_APP_URL + '/api/account/marketing-optin?token=' + token;
      const html = fillTemplate(loadTemplate('marketing-reconsent.html'), { OPTIN_URL: optinUrl });
      await sendMail({ to: u.email, subject: 'Chceš od nás aj odporúčania partnerov? (jednorazová otázka)', html });
      await supabase.from('users').update({ remarketing_consent_email_sent_at: new Date().toISOString() }).eq('email', u.email);
      sent++;
      console.log('OK:', u.email);
    } catch (e) {
      failed++;
      console.error('CHYBA pri', u.email, ':', e.message);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log('Hotovo. Odoslané:', sent, 'Zlyhalo:', failed);
}

main().catch(e => { console.error('Fatálna chyba:', e.message); process.exit(1); });
