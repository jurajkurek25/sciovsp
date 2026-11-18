// JEDNORAZOVÝ skript — NIE je to patch na server.js, spúšťa sa PRIAMO
// (node main-app-patches/279-send-shutdown-letter.js) z koreňa hlavnej
// appky (kde je .env, node_modules, mailer.js).
//
// Pošle osobný list o konci modelu predplatného SP TRÉNER + prechode na
// jednorazový 7 EUR Claude Skill (cez Gumroad) VŠETKÝM userom v databáze
// (nielen free tier -- aj existujúcim Premium/Elite predplatiteľom, email
// má pre nich samostatnú poznámku, že ich predplatné sa nemení).
//
// Bezpečne opakovateľné -- každému sa pošle len raz (filter
// shutdown_letter_sent_at IS NULL).
//
// Vyžaduje: db/migrate_shutdown_letter.sql už spustený +
// emails/sp-trener-shutdown-letter.html.
//
// URČENÉ NA SPUSTENIE: zajtra o 10:00 (alebo kedykoľvek, keď budeš chcieť
// list odoslať -- skript nič nekontroluje podľa času, spustenie = okamžité
// odoslanie všetkým, komu ešte nebolo poslané).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { sendMail } = require('../mailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function loadTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'emails', name), 'utf8');
}

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('email')
    .is('shutdown_letter_sent_at', null);
  if (error) { console.error('Chyba načítania users:', error.message); process.exit(1); }
  console.log('Počet na odoslanie (celá databáza):', (users || []).length);

  const html = loadTemplate('sp-trener-shutdown-letter.html');
  let sent = 0, failed = 0;
  for (const u of (users || [])) {
    try {
      await sendMail({ to: u.email, subject: 'Končím s pomocou pre teba. A veľmi ma to bolí. 💔', html });
      await supabase.from('users').update({ shutdown_letter_sent_at: new Date().toISOString() }).eq('email', u.email);
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
