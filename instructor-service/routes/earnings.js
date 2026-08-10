// Zárobky inštruktora + žiadosť o výplatu. Vyplácanie je RUČNÉ, rovnaký
// princíp ako affil partneri v dashi: tento endpoint iba založí
// instructor_payouts riadok so status='pending' a označí zahrnuté nákupy.
// Peniaze posiela Juraj sám vo vlastnej bankovej appke (PAY by square QR
// v dashi) a až potom klikne "vyplatené" — žiadny kód tu sa účtu nedotkne.
const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { requireTermsAccepted } = require('./legal');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/instructor/earnings', requireInstructorAuth, async (req, res) => {
  const instructorId = req.instructor.id;
  const { data: unpaidRows, error } = await mainDb.from('course_purchases')
    .select('instructor_share_cents, purchased_at, via_instructor_referral, courses(title)')
    .eq('instructor_id', instructorId).is('instructor_payout_id', null);
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }

  const unpaidCents = (unpaidRows || []).reduce((sum, r) => sum + (r.instructor_share_cents || 0), 0);
  const { data: payouts, error: payoutErr } = await mainDb.from('instructor_payouts')
    .select('*').eq('instructor_id', instructorId).order('requested_at', { ascending: false });
  if (payoutErr) { console.error(payoutErr); return res.status(500).json({ error: payoutErr.message }); }

  res.json({
    unpaidCents,
    unpaidSaleCount: (unpaidRows || []).length,
    recentSales: (unpaidRows || [])
      .sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))
      .slice(0, 50)
      .map(r => ({ courseTitle: r.courses?.title || '', shareCents: r.instructor_share_cents, viaReferral: r.via_instructor_referral, createdAt: r.purchased_at })),
    payouts: (payouts || []).map(p => ({ id: p.id, amountCents: p.amount_cents, status: p.status, requestedAt: p.requested_at, completedAt: p.completed_at }))
  });
});

router.post('/api/instructor/payouts', requireInstructorAuth, requireTermsAccepted, async (req, res) => {
  const instructorId = req.instructor.id;
  const iban = String(req.body?.iban || req.instructor.iban || '').replace(/\s/g, '').toUpperCase();
  if (!iban) return res.status(400).json({ error: 'Chýba IBAN.' });
  if (iban !== String(req.instructor.iban || '').replace(/\s/g, '').toUpperCase()) {
    await mainDb.from('instructors').update({ iban }).eq('id', instructorId);
  }

  const { data: unpaidRows, error } = await mainDb.from('course_purchases')
    .select('id, instructor_share_cents').eq('instructor_id', instructorId).is('instructor_payout_id', null);
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  const amountCents = (unpaidRows || []).reduce((sum, r) => sum + (r.instructor_share_cents || 0), 0);
  if (!amountCents) return res.status(400).json({ error: 'Nemáš žiadny nevyplatený zárobok.' });

  const { data: payout, error: insErr } = await mainDb.from('instructor_payouts')
    .insert({ instructor_id: instructorId, amount_cents: amountCents, iban }).select().single();
  if (insErr) { console.error(insErr); return res.status(500).json({ error: insErr.message }); }

  const ids = (unpaidRows || []).map(r => r.id);
  await mainDb.from('course_purchases').update({ instructor_payout_id: payout.id }).in('id', ids);

  res.json({ ok: true, payout });
});

module.exports = router;
