// Prehľad a správa prihlášok do súťaže "/sutaz" (Martinus poukážky) -- len
// pre superadmina (requireDashAuth). Doklad o prijatí sa NIKDY neposkytuje
// priamo (bucket 'sutaz-admission-docs' je súkromný) -- generuje sa
// krátkodobý podpísaný odkaz, rovnaký vzor ako instructor-service/routes/
// submissions.js.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');
const { sendMail } = require('../lib/mailer');

const ALLOWED_STATUSES = ['pending', 'verified', 'rejected', 'winner'];
const ADMISSION_DOC_BUCKET = 'sutaz-admission-docs';
const SIGNED_URL_TTL_SECONDS = 600;

// Rovnaký vzor ako generateUniqueParticipantCode v hlavnej appke
// (routes/sutaz.js) -- vlastná kópia, iný proces/server. Prideľuje sa
// aj pri RUČNOM prepnutí statusu v Dash (nielen pri AI auto-rozhodnutí),
// aby žiadny platný účastník neostal bez súťažného kódu (čl. VI ods. 1).
const PARTICIPANT_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
async function generateUniqueParticipantCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += PARTICIPANT_CODE_ALPHABET[crypto.randomInt(PARTICIPANT_CODE_ALPHABET.length)];
    const { data } = await mainDb.from('sutaz_applications').select('id').eq('participant_code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Nepodarilo sa vygenerovať unikátny súťažný kód.');
}

function escapeHtmlDashRoute(s) { return (s == null ? '' : String(s)).replace(/</g, '&lt;'); }

async function sendManualVerifiedEmail(application, code) {
  const firstName = escapeHtmlDashRoute((application.full_name || '').trim().split(' ')[0] || 'tam');
  const html = `<!DOCTYPE html><html lang="sk"><body style="margin:0;padding:0;background:#08080d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08080d;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0f0f18;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;"><tr><td style="padding:32px 28px 8px;">
<div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:.15em;color:#36e896;text-transform:uppercase;margin-bottom:12px;">Prihláška overená</div>
<h1 style="margin:0 0 14px;color:#eeeef5;font-size:22px;line-height:1.3;">Ahoj ${firstName},</h1>
<p style="margin:0 0 18px;color:#a0a0c0;font-size:15px;line-height:1.6;">tvoja prihláška do súťaže SP Tréner o darčekovú poukážku Martinus bola <b style="color:#eeeef5;">overená a zaradená do žrebovania</b>.</p>
<div style="background:rgba(54,232,150,.04);border:1px solid rgba(54,232,150,.25);border-radius:12px;padding:18px 16px;margin-bottom:20px;text-align:center;">
<div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:.2em;color:#5c5c7a;text-transform:uppercase;margin-bottom:6px;">Tvoj súťažný kód</div>
<div style="font-family:'Courier New',monospace;font-size:28px;font-weight:700;letter-spacing:.12em;color:#36e896;">${escapeHtmlDashRoute(code)}</div>
</div>
<p style="margin:0 0 20px;color:#a0a0c0;font-size:14px;line-height:1.6;">Pri žrebovaní sa zverejňuje len tento kód — ulož si ho. Úplné znenie štatútu nájdeš na <a href="https://sptrener.online/sutaz" style="color:#b09bff;text-decoration:none;">sptrener.online/sutaz</a>.</p>
<p style="margin:0 0 4px;color:#5c5c7a;font-size:12px;line-height:1.6;">SP Tréner</p>
</td></tr></table></td></tr></table></body></html>`;
  await sendMail({ to: application.email, subject: 'Prihláška do súťaže SP Tréner — zaradená do žrebovania', html });
}

router.get('/api/dash/sutaz-applications', requireDashAuth, async (req, res) => {
  const statusFilter = req.query.status;
  let query = mainDb.from('sutaz_applications').select('*').order('created_at', { ascending: false });
  if (statusFilter && ALLOWED_STATUSES.includes(statusFilter)) query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const applications = await Promise.all((data || []).map(async a => {
    const { data: signed } = await mainDb.storage.from(ADMISSION_DOC_BUCKET).createSignedUrl(a.admission_doc_path, SIGNED_URL_TTL_SECONDS);
    return {
      id: a.id,
      email: a.email,
      fullName: a.full_name,
      contactEmail: a.contact_email,
      residenceMunicipality: a.residence_municipality,
      residenceCountry: a.residence_country,
      schoolName: a.school_name,
      studyProgram: a.study_program,
      admissionDecisionDate: a.admission_decision_date,
      admissionDocMime: a.admission_doc_mime,
      admissionDocUrl: signed?.signedUrl || null,
      ageConfirmed: a.age_confirmed,
      statuteAck: a.statute_ack,
      verifiedTestsCount: a.verified_tests_count,
      verifiedIsPremium: a.verified_is_premium,
      verifiedPlan: a.verified_plan,
      verifiedSubscriptionStatus: a.verified_subscription_status,
      status: a.status,
      participantCode: a.participant_code,
      drawPosition: a.draw_position,
      aiVerdict: a.ai_verdict,
      aiReason: a.ai_reason,
      reviewerNote: a.reviewer_note,
      createdAt: a.created_at,
      reviewedAt: a.reviewed_at
    };
  }));
  res.json({ applications });
});

router.put('/api/dash/sutaz-applications/:id', requireDashAuth, async (req, res) => {
  const { status, reviewerNote } = req.body || {};
  if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: 'Neplatný status.' });

  const { data: application } = await mainDb.from('sutaz_applications').select('*').eq('id', req.params.id).maybeSingle();
  if (!application) return res.status(404).json({ error: 'Prihláška sa nenašla.' });

  const update = { status, reviewed_at: new Date().toISOString() };
  if (typeof reviewerNote === 'string') update.reviewer_note = reviewerNote.slice(0, 2000);

  // Súťažný kód (čl. VI ods. 1) sa prideľuje pri prechode do 'verified'
  // alebo 'winner' (admin môže preskočiť rovno na 'winner'), ak ho
  // prihláška ešte nemá -- nielen cez AI auto-rozhodnutie v hlavnej appke.
  let newlyAssignedCode = null;
  if ((status === 'verified' || status === 'winner') && !application.participant_code) {
    newlyAssignedCode = await generateUniqueParticipantCode();
    update.participant_code = newlyAssignedCode;
  }

  const { error } = await mainDb.from('sutaz_applications').update(update).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  if (newlyAssignedCode) {
    try {
      await sendManualVerifiedEmail(application, newlyAssignedCode);
    } catch (e) {
      console.error('sutaz manual-verify email error:', application.email, e.message);
    }
  }

  res.json({ ok: true, participantCode: newlyAssignedCode || application.participant_code });
});

module.exports = router;
