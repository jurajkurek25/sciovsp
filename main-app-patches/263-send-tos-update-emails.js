// JEDNORAZOVÝ skript — NIE je to patch na server.js, iba sa spúšťa PRIAMO
// (node main-app-patches/263-send-tos-update-emails.js), z koreňa hlavnej
// appky (kde je .env, node_modules, mailer.js).
//
// Pošle VŠETKÝM existujúcim userom (users tabuľka) email o zmene
// obchodných podmienok (main-app-patches/261 — telefón + marketing
// bonus-test v legal.html), s 2 tlačidlami: potvrdiť / vymazať účet.
// Kto do TOS_UPDATE_DEADLINE nezareaguje, bude automaticky vymazaný
// (main-app-patches/264 — spúšťaj cez cron).
//
// Bezpečne opakovateľné — každému sa pošle len raz (filter
// tos_update_notice_sent_at IS NULL, oznaci hneď po úspešnom odoslaní).
//
// PRED spustením nastav v .env:
//   TOS_UPDATE_DEADLINE=2026-11-10   (formát YYYY-MM-DD — dátum, dokedy majú
//   ľudia čas reagovať; rovnaký dátum použije aj main-app-patches/264)
//
// Vyžaduje: db/migrate_tos_update_2026.sql už spustený +
// emails/tos-update-2026.html + emails/tos-update-2026-cz.html.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendMail } = require('../mailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APP_URL = process.env.APP_URL || 'https://sptrener.online/app';
const EXAM_APP_URL = APP_URL.replace(/\/+$/, '');
const DEADLINE = process.env.TOS_UPDATE_DEADLINE;

if (!DEADLINE || !/^\d{4}-\d{2}-\d{2}$/.test(DEADLINE)) {
  console.error('❌ Chýba alebo je neplatný TOS_UPDATE_DEADLINE v .env (formát YYYY-MM-DD). Nič som neposlal.');
  process.exit(1);
}

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'emails', name), 'utf8');
}
function fillTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  return out;
}
function formatDateSk(iso) {
  const [y, m, d] = iso.split('-');
  return d + '.' + m + '.' + y;
}
async function getOrCreateTosToken(email) {
  const { data: row } = await supabase.from('users').select('tos_update_token').eq('email', email).maybeSingle();
  if (row?.tos_update_token) return row.tos_update_token;
  const token = require('crypto').randomBytes(24).toString('hex');
  await supabase.from('users').update({ tos_update_token: token }).eq('email', email);
  return token;
}

async function main() {
  const { data: users, error } = await supabase.from('users').select('email, lang').is('tos_update_notice_sent_at', null);
  if (error) { console.error('Chyba načítania users:', error.message); process.exit(1); }
  console.log('Počet na odoslanie:', (users || []).length, '| termín:', DEADLINE);

  let sent = 0, failed = 0;
  for (const u of (users || [])) {
    try {
      const token = await getOrCreateTosToken(u.email);
      const confirmUrl = EXAM_APP_URL + '/api/account/tos-confirm?token=' + token;
      const deleteUrl = EXAM_APP_URL + '/api/account/tos-delete?token=' + token;
      const isCz = u.lang === 'cz';
      const html = fillTemplate(loadTemplate(isCz ? 'tos-update-2026-cz.html' : 'tos-update-2026.html'), {
        CONFIRM_URL: confirmUrl,
        DELETE_URL: deleteUrl,
        DEADLINE_DATE: formatDateSk(DEADLINE)
      });
      const subject = isCz
        ? 'Důležitá změna obchodních podmínek — vyžaduje se tvá reakce'
        : 'Dôležitá zmena obchodných podmienok — vyžaduje sa tvoja reakcia';
      await sendMail({ to: u.email, subject, html });
      await supabase.from('users').update({ tos_update_notice_sent_at: new Date().toISOString() }).eq('email', u.email);
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
