// Vyplácanie inštruktorov — rovnaký princíp ako affil partneri
// (routes/payouts.js): PAY by square QR sa vygeneruje z IBAN + sumy,
// Juraj si ho naskenuje vo vlastnej bankovej appke, prevod potvrdí sám,
// a až potom klikne "Označiť ako vyplatené". Žiadny kód tu nemá prístup
// k bankovému účtu. Na rozdiel od partnerov instructor_payouts žije
// priamo v hlavnom Supabase projekte, takže netreba volať cudziu appku
// cez x-admin-key — dash číta/zapisuje priamo cez lib/db-main.
const express = require('express');
const router = express.Router();
const { encode, PaymentOptions, CurrencyCode } = require('bysquare/pay');
const QRCode = require('qrcode');
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

const BENEFICIARY_NAME = process.env.DASH_BENEFICIARY_NAME || 'SP Trener';

router.get('/api/dash/instructor-payouts', requireDashAuth, async (req, res) => {
  const statusFilter = req.query.status || 'pending';
  let query = mainDb.from('instructor_payouts').select('*, instructors(name, email)').order('requested_at', { ascending: false });
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ payouts: data || [] });
});

router.get('/api/dash/instructor-payouts/:id/qr', requireDashAuth, async (req, res) => {
  const { data: payout, error } = await mainDb.from('instructor_payouts')
    .select('*, instructors(name, email)').eq('id', req.params.id).single();
  if (error || !payout) return res.status(404).json({ error: 'Výber sa nenašiel.' });
  if (!payout.iban) return res.status(400).json({ error: 'Tento výber nemá IBAN.' });

  const amount = payout.amount_cents / 100;
  const instructorName = payout.instructors?.name || payout.instructors?.email || 'inštruktor';
  const variableSymbol = String(req.params.id).replace(/\D/g, '').slice(0, 10) || undefined;

  const qrstring = encode({
    payments: [{
      type: PaymentOptions.PaymentOrder,
      amount,
      currencyCode: CurrencyCode.EUR,
      variableSymbol,
      paymentNote: `SP Trener instruktor vyplatenie - ${instructorName}`.slice(0, 140),
      beneficiary: { name: BENEFICIARY_NAME },
      bankAccounts: [{ iban: payout.iban.replace(/\s/g, '').toUpperCase() }]
    }]
  });

  const qrDataUrl = await QRCode.toDataURL(qrstring, { errorCorrectionLevel: 'M', width: 300 });
  res.json({ qrDataUrl, qrstring, amount, iban: payout.iban, instructorName });
});

router.post('/api/dash/instructor-payouts/:id/mark-paid', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('instructor_payouts')
    .update({ status: 'completed', completed_at: new Date().toISOString(), note: req.body?.note || 'Vyplatené cez PAY by square (dash).' })
    .eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, payout: data });
});

module.exports = router;
