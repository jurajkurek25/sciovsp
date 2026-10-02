// Webinárový email marketing (nahrádza Ecomail) — zoznam kontaktov z
// webinar_registrations (hlavná appka, Supabase), platený/neplatený stav
// dotiahnutý z users.is_premium/plan podľa emailu. Odosielanie ide priamo
// z dash appky (vlastné SMTP, rovnaké ako v hlavnej appke).
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');
const { sendMail } = require('../lib/mailer');

router.get('/api/dash/webinar/contacts', requireDashAuth, async (req, res) => {
  const { data: regs, error } = await mainDb.from('webinar_registrations').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const emails = (regs || []).map(r => r.email);
  let usersByEmail = {};
  if (emails.length) {
    const { data: users } = await mainDb.from('users').select('email, is_premium, plan').in('email', emails);
    usersByEmail = Object.fromEntries((users || []).map(u => [u.email, u]));
  }
  const contacts = (regs || []).map(r => ({
    id: r.id,
    email: r.email,
    name: r.name,
    slotStartMs: r.slot_start_ms,
    confirmedAt: r.confirmed_at,
    unsubscribedAt: r.unsubscribed_at,
    createdAt: r.created_at,
    isPremium: !!(usersByEmail[r.email] && usersByEmail[r.email].is_premium),
    plan: usersByEmail[r.email] ? usersByEmail[r.email].plan : null
  }));
  res.json({ contacts });
});

router.delete('/api/dash/webinar/contacts/:id', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('webinar_registrations').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.post('/api/dash/webinar/contacts/:id/unsubscribe', requireDashAuth, async (req, res) => {
  const { error } = await mainDb.from('webinar_registrations').update({ unsubscribed_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// targetIds: presný zoznam id kontaktov na odoslanie (dash UI si segment/
// filter vyrieši sám z už načítaného zoznamu a pošle konkrétne id) —
// server tu nerieši žiadnu vlastnú segmentačnú logiku.
router.post('/api/dash/webinar/send', requireDashAuth, async (req, res) => {
  const { targetIds, subject, html } = req.body || {};
  if (!Array.isArray(targetIds) || !targetIds.length) return res.status(400).json({ error: 'Chýbajú príjemcovia.' });
  if (!subject || !html) return res.status(400).json({ error: 'Chýba predmet alebo obsah emailu.' });
  const { data: regs, error } = await mainDb.from('webinar_registrations').select('*').in('id', targetIds);
  if (error) return res.status(500).json({ error: error.message });
  let sent = 0, failed = 0;
  for (const reg of regs || []) {
    if (reg.unsubscribed_at) continue;
    const personalized = html
      .split('[MENO]').join(reg.name || '')
      .split('[UNSUBSCRIBE]').join((process.env.MAIN_APP_URL || 'https://sptrener.online').replace(/\/+$/, '') + '/api/webinar/unsubscribe?token=' + reg.confirm_token);
    try {
      await sendMail({ to: reg.email, subject, html: personalized });
      sent++;
    } catch (e) {
      failed++;
    }
  }
  res.json({ ok: true, sent, failed });
});

function xmlEscape(s) {
  return String(s == null ? '' : s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Plný export všetkých kontaktov do XML — nezávislé od tejto appky, dá sa
// kedykoľvek naimportovať do iného email nástroja (žiadny vendor lock-in).
router.get('/api/dash/webinar/export.xml', requireDashAuth, async (req, res) => {
  const { data: regs, error } = await mainDb.from('webinar_registrations').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const emails = (regs || []).map(r => r.email);
  let usersByEmail = {};
  if (emails.length) {
    const { data: users } = await mainDb.from('users').select('email, is_premium, plan').in('email', emails);
    usersByEmail = Object.fromEntries((users || []).map(u => [u.email, u]));
  }
  const rows = (regs || []).map(r => {
    const u = usersByEmail[r.email];
    return `  <contact>
    <id>${r.id}</id>
    <email>${xmlEscape(r.email)}</email>
    <name>${xmlEscape(r.name)}</name>
    <slotStart>${new Date(r.slot_start_ms).toISOString()}</slotStart>
    <confirmedAt>${xmlEscape(r.confirmed_at)}</confirmedAt>
    <unsubscribedAt>${xmlEscape(r.unsubscribed_at)}</unsubscribedAt>
    <createdAt>${xmlEscape(r.created_at)}</createdAt>
    <isPremium>${u && u.is_premium ? 'true' : 'false'}</isPremium>
    <plan>${xmlEscape(u ? u.plan : null)}</plan>
  </contact>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<contacts exportedAt="${new Date().toISOString()}" count="${(regs || []).length}">\n${rows}\n</contacts>\n`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="webinar-kontakty.xml"');
  res.send(xml);
});

module.exports = router;
