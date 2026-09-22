// Rozšíri webinárové emaily (1-6, patche 88/96/114) o český variant.
// Webinárová registrácia (patch 114) už vyžaduje Google login, takže jazyk
// NEMUSÍ posielať frontend (ktorý nie je v git repe) — zoberie sa priamo
// z users.lang (rovnaká hodnota, akú appka synchronizuje cez
// POST /api/profile/lang, patch 126) v momente registrácie a uloží sa na
// webinar_registrations.lang. Ak frontend v budúcnosti pribudne do repa,
// dá sa doplniť aj priame nastavenie jazyka vo formulári.
// Vyžaduje db/migrate_email_unsubscribe_and_lang.sql (webinar_registrations.lang)
// + emails/1-potvrdenie-registracie-cz.html .. 6-ponuka-po-akcii-cz.html.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.130-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('1-potvrdenie-registracie-cz.html')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) POST /api/webinar/register — zisti users.lang, ulož na webinar_registrations.lang ──
const OLD_UPSERT_SETUP = `    const { name } = req.body || {};
    const slot = computeNextWebinarSlotMs();
    const confirmToken = require('crypto').randomBytes(24).toString('hex');

    const { data: existingReg } = await supabase.from('webinar_registrations').select('offer_window_expires_at').eq('email', email).maybeSingle();
    const upsertPayload = {
      email,
      name: (name || '').toString().trim() || null,
      slot_start_ms: slot,
      confirm_token: confirmToken,
      confirmed_at: null,
      reminder_24h_sent_at: null,
      reminder_soon_sent_at: null,
      offer_sent_at: null
    };`;
const NEW_UPSERT_SETUP = `    const { name } = req.body || {};
    const slot = computeNextWebinarSlotMs();
    const confirmToken = require('crypto').randomBytes(24).toString('hex');
    const { data: langRow } = await supabase.from('users').select('lang').eq('email', email).maybeSingle();
    const lang = langRow?.lang === 'cz' ? 'cz' : 'sk';

    const { data: existingReg } = await supabase.from('webinar_registrations').select('offer_window_expires_at').eq('email', email).maybeSingle();
    const upsertPayload = {
      email,
      name: (name || '').toString().trim() || null,
      lang,
      slot_start_ms: slot,
      confirm_token: confirmToken,
      confirmed_at: null,
      reminder_24h_sent_at: null,
      reminder_soon_sent_at: null,
      offer_sent_at: null
    };`;
patched = replaceOnce(patched, OLD_UPSERT_SETUP, NEW_UPSERT_SETUP, '1a: register upsertPayload');

const OLD_EMAIL1 = `    const confirmUrl = WEBINAR_APP_URL + '/api/webinar/confirm?token=' + confirmToken;
    const unsubscribeUrl = WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + confirmToken;
    const html = fillWebinarTemplate(loadWebinarEmailTemplate('1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);
    sendMail({ to: email, subject: 'Potvrď účasť na vysielaní — SP Tréner', html }).catch(() => {});`;
const NEW_EMAIL1 = `    const confirmUrl = WEBINAR_APP_URL + '/api/webinar/confirm?token=' + confirmToken;
    const unsubscribeUrl = WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + confirmToken;
    const html = fillWebinarTemplate(loadWebinarEmailTemplate(lang === 'cz' ? '1-potvrdenie-registracie-cz.html' : '1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);
    sendMail({ to: email, subject: lang === 'cz' ? 'Potvrď účast na vysílání — SP Tréner' : 'Potvrď účasť na vysielaní — SP Tréner', html }).catch(() => {});`;
patched = replaceOnce(patched, OLD_EMAIL1, NEW_EMAIL1, '1b: register email1 template+subject');

// ── 2) sendPendingWebinarReminders — emaily 2-6: cz variant podľa reg.lang ──
const OLD_EMAIL2 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('2-pripomienka-24h.html'), {
        MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Zajtra je to tu — pripomienka vysielania', html });`;
const NEW_EMAIL2 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '2-pripomienka-24h-cz.html' : '2-pripomienka-24h.html'), {
        MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Zítra je to tu — připomínka vysílání' : 'Zajtra je to tu — pripomienka vysielania', html });`;
patched = replaceOnce(patched, OLD_EMAIL2, NEW_EMAIL2, '2: email2 (24h)');

const OLD_EMAIL3 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('3-pripomienka-tesne-pred.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Práve teraz začíname', html });`;
const NEW_EMAIL3 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '3-pripomienka-tesne-pred-cz.html' : '3-pripomienka-tesne-pred.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Právě teď začínáme' : 'Práve teraz začíname', html });`;
patched = replaceOnce(patched, OLD_EMAIL3, NEW_EMAIL3, '3: email3 (tesne pred)');

const OLD_EMAIL4 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('4-po-webinari-ponuka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Tvoja ponuka je pripravená', html });`;
const NEW_EMAIL4 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '4-po-webinari-ponuka-cz.html' : '4-po-webinari-ponuka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Tvoje nabídka je připravena' : 'Tvoja ponuka je pripravená', html });`;
patched = replaceOnce(patched, OLD_EMAIL4, NEW_EMAIL4, '4: email4 (ponuka)');

const OLD_EMAIL5 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('5-ponuka-pripomienka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Zvyšných pár hodín na tvoju ponuku ⏳', html });`;
const NEW_EMAIL5 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '5-ponuka-pripomienka-cz.html' : '5-ponuka-pripomienka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Zbývá pár hodin na tvoji nabídku ⏳' : 'Zvyšných pár hodín na tvoju ponuku ⏳', html });`;
patched = replaceOnce(patched, OLD_EMAIL5, NEW_EMAIL5, '5: email5 (ponuka pripomienka)');

const OLD_EMAIL6 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('6-ponuka-po-akcii.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Akcia skončila, príprava nikam neuteká', html });`;
const NEW_EMAIL6 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '6-ponuka-po-akcii-cz.html' : '6-ponuka-po-akcii.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Akce skončila, příprava nikam neutíká' : 'Akcia skončila, príprava nikam neuteká', html });`;
patched = replaceOnce(patched, OLD_EMAIL6, NEW_EMAIL6, '6: email6 (po akcii)');

const backup = FILE + '.pre-webinar-lang-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_email_unsubscribe_and_lang.sql uz bezal (webinar_registrations.lang) a vsetkych 6 -cz.html suborov existuje v emails/.');
