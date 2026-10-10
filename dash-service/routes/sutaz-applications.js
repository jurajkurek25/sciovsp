// Prehľad a správa prihlášok do súťaže "/sutaz" (Martinus poukážky) -- len
// pre superadmina (requireDashAuth). Doklad o prijatí sa NIKDY neposkytuje
// priamo (bucket 'sutaz-admission-docs' je súkromný) -- generuje sa
// krátkodobý podpísaný odkaz, rovnaký vzor ako instructor-service/routes/
// submissions.js.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

const ALLOWED_STATUSES = ['pending', 'verified', 'rejected', 'winner'];
const ADMISSION_DOC_BUCKET = 'sutaz-admission-docs';
const SIGNED_URL_TTL_SECONDS = 600;

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
  const update = { status, reviewed_at: new Date().toISOString() };
  if (typeof reviewerNote === 'string') update.reviewer_note = reviewerNote.slice(0, 2000);
  const { error } = await mainDb.from('sutaz_applications').update(update).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

module.exports = router;
