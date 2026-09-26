// Extends the existing sendPendingWebinarReminders() loop (from
// 88-webinar-email-automation.js) with two more touchpoints:
//   - offer_reminder: ~12h after the original post-webinar offer email,
//     still within the 24h offer window — urgency reminder.
//   - post_offer_nurture: ~48h after the original offer email, once the
//     offer has expired — no more discount, just value + normal-price CTA.
// Requires db/add_webinar_followup_columns.sql and
// emails/5-ponuka-pripomienka.html + emails/6-ponuka-po-akcii.html.
// Anchor is 88's exact dueOffer block — if 88 isn't applied yet, run that
// first.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('offer_reminder_sent_at')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = `    const { data: dueOffer } = await supabase.from('webinar_registrations').select('*')
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
}`;

const count = src.split(ANCHOR).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made.`);
  process.exit(1);
}

const NEW = `    const { data: dueOffer } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).is('unsubscribed_at', null).is('offer_sent_at', null)
      .lte('slot_start_ms', now - 60 * 60 * 1000);
    for (const reg of dueOffer || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('4-po-webinari-ponuka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Tvoja ponuka je pripravená', html });
      await supabase.from('webinar_registrations').update({ offer_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }

    // Este stale v 24h okne ponuky — pripomienka s uz nastavenym offer_sent_at.
    const { data: dueOfferReminder } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).not('offer_sent_at', 'is', null).is('unsubscribed_at', null).is('offer_reminder_sent_at', null)
      .lte('slot_start_ms', now - 13 * 60 * 60 * 1000);
    for (const reg of dueOfferReminder || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('5-ponuka-pripomienka.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Zvyšných pár hodín na tvoju ponuku ⏳', html });
      await supabase.from('webinar_registrations').update({ offer_reminder_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }

    // Po vyprsani ponuky — bez zlavy, len hodnota + CTA za beznu cenu.
    const { data: duePostOfferNurture } = await supabase.from('webinar_registrations').select('*')
      .not('confirmed_at', 'is', null).not('offer_sent_at', 'is', null).is('unsubscribed_at', null).is('post_offer_nurture_sent_at', null)
      .lte('slot_start_ms', now - 49 * 60 * 60 * 1000);
    for (const reg of duePostOfferNurture || []) {
      const html = fillWebinarTemplate(loadWebinarEmailTemplate('6-ponuka-po-akcii.html'), {
        MENO: reg.name || '', UNSUBSCRIBE: APP_URL + '/api/webinar/unsubscribe?token=' + reg.confirm_token
      });
      await sendMail({ to: reg.email, subject: 'Akcia skončila, príprava nikam neuteká', html });
      await supabase.from('webinar_registrations').update({ post_offer_nurture_sent_at: new Date().toISOString() }).eq('id', reg.id);
    }
  } catch (e) {
    console.error('sendPendingWebinarReminders error:', e.message);
  }
}`;

const backup = FILE + '.pre-webinar-followup-emails-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(ANCHOR).join(NEW));
console.log('OK - zaloha:', backup);
