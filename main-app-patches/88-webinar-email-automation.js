// Vlastný email systém pre webinár namiesto Ecomailu: potvrdzovací email
// (double opt-in, link rovno vedie na /webinar/live), automatické
// pripomienky (24h pred, tesne pred) a ponuka po webinári — bežia cez
// interný časovač (rovnaký princíp ako expireMemberships() v
// 78-membership-checkout.js). Vyžaduje najprv spustenú migráciu
// db/create_webinar_registrations.sql a SMTP_* premenné v .env (rovnaké
// ako v ad-service — pozri mailer.js).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('webinar_registrations')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const NEW_BLOCK = `const { sendMail } = require('./mailer');

function loadWebinarEmailTemplate(name) {
  return require('fs').readFileSync(require('path').join(__dirname, 'emails', name), 'utf8');
}
function fillWebinarTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) {
    out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  }
  return out;
}
function fmtWebinarSlot(slotStartMs) {
  const d = new Date(Number(slotStartMs));
  const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return days[d.getDay()] + ' ' + dd + '.' + mm + ' o ' + hh + ':00';
}

app.post('/api/webinar/register', rateLimit, async (req, res) => {
  try {
    const { name, email: rawEmail, slotStartMs } = req.body || {};
    const email = (rawEmail || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
    const slot = Number(slotStartMs);
    if (!slot || Math.abs(slot - Date.now()) > 9 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'Neplatný termín.' });
    const confirmToken = require('crypto').randomBytes(24).toString('hex');
    const { data: reg, error } = await supabase.from('webinar_registrations').upsert({
      email,
      name: (name || '').toString().trim() || null,
      slot_start_ms: slot,
      confirm_token: confirmToken,
      confirmed_at: null,
      reminder_24h_sent_at: null,
      reminder_soon_sent_at: null,
      offer_sent_at: null
    }, { onConflict: 'email' }).select().single();
    if (error) throw error;
    const confirmUrl = APP_URL + '/api/webinar/confirm?token=' + confirmToken;
    const unsubscribeUrl = APP_URL + '/api/webinar/unsubscribe?token=' + confirmToken;
    const html = fillWebinarTemplate(loadWebinarEmailTemplate('1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);
    sendMail({ to: email, subject: 'Potvrď účasť na vysielaní — SP Tréner', html }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('webinar register error:', err.message);
    res.status(500).json({ error: 'Chyba registrácie.' });
  }
});

app.get('/api/webinar/confirm', async (req, res) => {
  const token = (req.query.token || '').toString();
  if (!token) return res.redirect('/webinar');
  const { data: reg } = await supabase.from('webinar_registrations').select('id').eq('confirm_token', token).maybeSingle();
  if (!reg) return res.redirect('/webinar');
  await supabase.from('webinar_registrations').update({ confirmed_at: new Date().toISOString() }).eq('id', reg.id);
  res.redirect('/webinar/live');
});

app.get('/api/webinar/unsubscribe', async (req, res) => {
  const token = (req.query.token || '').toString();
  const { data: reg } = token ? await supabase.from('webinar_registrations').select('id').eq('confirm_token', token).maybeSingle() : { data: null };
  if (reg) await supabase.from('webinar_registrations').update({ unsubscribed_at: new Date().toISOString() }).eq('id', reg.id);
  res.set('Content-Type', 'text/html; charset=utf-8').send('<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;"><h2>Odhlásené</h2><p>Už ti nebudeme posielať pripomienky k webináru.</p></body>');
});

async function sendPendingWebinarReminders() {
  try {
    const now = Date.now();
    const { data: due24h } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).is('unsubscribed_at', null).is('reminder_24h_sent_at', null)
      .lte('slot_start_ms', now + 24 * 60 * 60 * 1000).gt('slot_start_ms', now);
    for (const reg of due24h || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('2-pripomienka-24h.html'), {
        MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Zajtra je to tu — pripomienka vysielania', html });
      await supabase.from('webinar_registrations').update({ reminder_24h_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }

    const { data: dueSoon } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).is('unsubscribed_at', null).is('reminder_soon_sent_at', null)
      .lte('slot_start_ms', now + 20 * 60 * 1000).gt('slot_start_ms', now);
    for (const reg of dueSoon || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('3-pripomienka-tesne-pred.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Práve teraz začíname', html });
      await supabase.from('webinar_registrations').update({ reminder_soon_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }

    const { data: dueOffer } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).is('unsubscribed_at', null).is('offer_sent_at', null)
      .lte('slot_start_ms', now - 60 * 60 * 1000);
    for (const reg of dueOffer || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('4-po-webinari-ponuka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Tvoja ponuka je pripravená', html });
      await supabase.from('webinar_registrations').update({ offer_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }
  } catch (e) {
    console.error('sendPendingWebinarReminders error:', e.message);
  }
}
setInterval(sendPendingWebinarReminders, 5 * 60 * 1000);
sendPendingWebinarReminders();

app.listen(PORT, () => {`;

const patched = replaceOnce(src, 'app.listen(PORT, () => {', NEW_BLOCK, 'app.listen anchor');

const backup = FILE + '.pre-webinar-email-automation-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze SMTP_HOST/SMTP_USER/SMTP_PASS su v .env a ze zlozka emails/ existuje vedla server.js.');
