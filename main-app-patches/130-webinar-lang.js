// Rozšíri webinárové emaily o český variant. Webinárová registrácia (patch
// 114) už vyžaduje Google login, takže jazyk NEMUSÍ posielať frontend
// (ktorý nie je v git repe) — zoberie sa priamo z users.lang (rovnaká
// hodnota, akú appka synchronizuje cez POST /api/profile/lang, patch 126)
// v momente registrácie a uloží sa na webinar_registrations.lang.
//
// POZOR — zistené pri nasadzovaní: main-app-patches/96 (webinar-followup-
// emails, pridáva emaily 5 a 6) NEBOL na produkcii nikdy spustený, takže
// tento patch ich rovno PRIDÁVA (nie upravuje). Zároveň main-app-patches/90
// premenoval APP_URL na WEBINAR_APP_URL v emailoch 2-4, preto tento patch
// používa WEBINAR_APP_URL všade kvôli konzistencii.
//
// Vyžaduje: db/migrate_email_unsubscribe_and_lang.sql (webinar_registrations.lang)
// + db/add_webinar_followup_columns.sql (offer_reminder_sent_at, post_offer_nurture_sent_at)
// + vsetkych 6 -cz.html suborov + emails/5-ponuka-pripomienka.html a
// emails/6-ponuka-po-akcii.html (uz existuju, len doteraz neboli zapojene).
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

// ── 2) sendPendingWebinarReminders — emaily 2-3: cz variant podľa reg.lang (WEBINAR_APP_URL) ──
const OLD_EMAIL2 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('2-pripomienka-24h.html'), {
        MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Zajtra je to tu — pripomienka vysielania', html });`;
const NEW_EMAIL2 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '2-pripomienka-24h-cz.html' : '2-pripomienka-24h.html'), {
        MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Zítra je to tu — připomínka vysílání' : 'Zajtra je to tu — pripomienka vysielania', html });`;
patched = replaceOnce(patched, OLD_EMAIL2, NEW_EMAIL2, '2: email2 (24h)');

const OLD_EMAIL3 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate('3-pripomienka-tesne-pred.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Práve teraz začíname', html });`;
const NEW_EMAIL3 = `      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '3-pripomienka-tesne-pred-cz.html' : '3-pripomienka-tesne-pred.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Právě teď začínáme' : 'Práve teraz začíname', html });`;
patched = replaceOnce(patched, OLD_EMAIL3, NEW_EMAIL3, '3: email3 (tesne pred)');

// ── 3) email 4 (cz variant) + PRIDAJ chýbajúce emaily 5 a 6 (nikdy neboli nasadené) ──
const OLD_EMAIL4_TAIL = `    for (const reg of dueOffer || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('4-po-webinari-ponuka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Tvoja ponuka je pripravená', html });
      await supabase.from('webinar_registrations').update({ offer_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }
  } catch (e) {
    console.error('sendPendingWebinarReminders error:', e.message);
  }
}`;
const NEW_EMAIL4_PLUS_5_6 = `    for (const reg of dueOffer || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '4-po-webinari-ponuka-cz.html' : '4-po-webinari-ponuka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Tvoje nabídka je připravena' : 'Tvoja ponuka je pripravená', html });
      await supabase.from('webinar_registrations').update({ offer_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }

    // Este stale v 24h okne ponuky — pripomienka s uz nastavenym offer_sent_at.
    const { data: dueOfferReminder } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).not('offer_sent_at', 'is', null).is('unsubscribed_at', null).is('offer_reminder_sent_at', null)
      .lte('slot_start_ms', now - 13 * 60 * 60 * 1000);
    for (const reg of dueOfferReminder || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '5-ponuka-pripomienka-cz.html' : '5-ponuka-pripomienka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Zbývá pár hodin na tvoji nabídku ⏳' : 'Zvyšných pár hodín na tvoju ponuku ⏳', html });
      await supabase.from('webinar_registrations').update({ offer_reminder_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }

    // Po vyprsani ponuky — bez zlavy, len hodnota + CTA za beznu cenu.
    const { data: duePostOfferNurture } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).not('offer_sent_at', 'is', null).is('unsubscribed_at', null).is('post_offer_nurture_sent_at', null)
      .lte('slot_start_ms', now - 49 * 60 * 60 * 1000);
    for (const reg of duePostOfferNurture || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate(reg.lang === 'cz' ? '6-ponuka-po-akcii-cz.html' : '6-ponuka-po-akcii.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: reg.lang === 'cz' ? 'Akce skončila, příprava nikam neutíká' : 'Akcia skončila, príprava nikam neuteká', html });
      await supabase.from('webinar_registrations').update({ post_offer_nurture_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }
  } catch (e) {
    console.error('sendPendingWebinarReminders error:', e.message);
  }
}`;
patched = replaceOnce(patched, OLD_EMAIL4_TAIL, NEW_EMAIL4_PLUS_5_6, '4: email4 + pridanie emailov 5 a 6');

const backup = FILE + '.pre-webinar-lang-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/add_webinar_followup_columns.sql uz bezal (offer_reminder_sent_at, post_offer_nurture_sent_at) a emails/5-ponuka-pripomienka.html + emails/6-ponuka-po-akcii.html existuju.');
