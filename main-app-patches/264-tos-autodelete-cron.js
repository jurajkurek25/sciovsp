// AUTOMATICKÉ vymazanie účtov, ktoré do TOS_UPDATE_DEADLINE nereagovali na
// email o zmene obchodných podmienok (main-app-patches/263). Spúšťaj
// PRAVIDELNE cez systémový cron (napr. denne) — PO termíne vymaže každý
// "pending" záznam (ktorému bol email už odoslaný); PRED termínom, a potom,
// čo sú už všetci vyriešení (confirmed/zmazaní), nerobí nič — bezpečne
// opakovateľné.
//
// node main-app-patches/264-tos-autodelete-cron.js
//
// Príklad crontab (raz denne o 4:00 ráno):
//   0 4 * * * cd /cesta/k/appke && /usr/bin/node main-app-patches/264-tos-autodelete-cron.js >> /var/log/tos-autodelete.log 2>&1
//
// Vyžaduje ROVNAKÝ TOS_UPDATE_DEADLINE v .env ako pri main-app-patches/263
// a delete-account.js v koreni appky.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { deleteUserAccountCompletely } = require('../delete-account');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const DEADLINE = process.env.TOS_UPDATE_DEADLINE;

if (!DEADLINE || !/^\d{4}-\d{2}-\d{2}$/.test(DEADLINE)) {
  console.error('❌ Chýba alebo je neplatný TOS_UPDATE_DEADLINE v .env (formát YYYY-MM-DD). Nič som nezmazal.');
  process.exit(1);
}

async function main() {
  // +01:00 (SEČ) — termín sa počíta v slovenskom čase; upraviť na +02:00, ak
  // by termín náhodou padol počas letného času.
  const deadlineReached = new Date() >= new Date(DEADLINE + 'T23:59:59+01:00');
  if (!deadlineReached) {
    console.log('Termín (' + DEADLINE + ') ešte neuplynul, nič nerobím.');
    return;
  }

  const { data: users, error } = await supabase
    .from('users')
    .select('email')
    .eq('tos_update_status', 'pending')
    .not('tos_update_notice_sent_at', 'is', null);
  if (error) { console.error('Chyba načítania users:', error.message); process.exit(1); }
  console.log('Na automatické zmazanie (po termíne, bez reakcie):', (users || []).length);

  let deleted = 0, failed = 0;
  for (const u of (users || [])) {
    try {
      await deleteUserAccountCompletely(supabase, stripe, u.email);
      deleted++;
      console.log('Zmazaný:', u.email);
    } catch (e) {
      failed++;
      console.error('CHYBA pri mazaní', u.email, ':', e.message);
    }
  }
  console.log('Hotovo. Zmazaných:', deleted, 'Zlyhalo:', failed);
}

main().catch(e => { console.error('Fatálna chyba:', e.message); process.exit(1); });
