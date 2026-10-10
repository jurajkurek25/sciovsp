// Rýchle vyplácanie affil partnerov cez PAY by square QR/odkaz.
//
// DÔLEŽITÉ (bezpečnostný dizajn): tento endpoint NIKDY nepresúva peniaze.
// bysquare iba zakóduje IBAN + sumu + správu do QR/reťazca, ktorý si Juraj
// naskenuje vo VLASTNEJ bankovej appke a tam prevod sám potvrdí. Až keď to
// urobí, klikne "Označiť ako vyplatené", čo zavolá partnerov existujúci
// /api/partner/admin/payout/:id/process endpoint (ten istý, čo by použil
// ručne v admin.html) — takže žiadny kód v tomto repe nemá prístup k
// bankovému účtu ani nevie iniciovať prevod sám.
const express = require('express');
const router = express.Router();
const { encode, PaymentOptions, CurrencyCode } = require('bysquare/pay');
const QRCode = require('qrcode');
const { requireDashAuth } = require('../lib/auth');
const { supabase, partnerAdminFetch } = require('../lib/db-partner');

const BENEFICIARY_NAME = process.env.DASH_BENEFICIARY_NAME || 'SP Trener';

router.get('/api/dash/payouts', requireDashAuth, async (req, res) => {
  const statusFilter = req.query.status || 'pending';
  let query = supabase.from('partner_payouts')
    .select('*, partners(first_name, last_name, email)').order('requested_at', { ascending: false });
  if (statusFilter !== 'all') query = query.eq('status', statusFilter);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ payouts: data || [] });
});

router.get('/api/dash/payouts/:id/qr', requireDashAuth, async (req, res) => {
  const { data: payout, error } = await supabase.from('partner_payouts')
    .select('*, partners(first_name, last_name)').eq('id', req.params.id).single();
  if (error || !payout) return res.status(404).json({ error: 'Výber sa nenašiel.' });
  if (!payout.iban) return res.status(400).json({ error: 'Tento výber nemá IBAN (možno je to darčeková karta).' });

  const amount = Number(payout.amount);
  const partnerName = payout.partners ? `${payout.partners.first_name} ${payout.partners.last_name}` : 'partner';
  const variableSymbol = String(req.params.id).replace(/\D/g, '').slice(0, 10) || undefined;

  const qrstring = encode({
    payments: [{
      type: PaymentOptions.PaymentOrder,
      amount,
      currencyCode: CurrencyCode.EUR,
      variableSymbol,
      paymentNote: `SP Trener affil vyplatenie - ${partnerName}`.slice(0, 140),
      beneficiary: { name: BENEFICIARY_NAME },
      bankAccounts: [{ iban: payout.iban.replace(/\s/g, '').toUpperCase() }]
    }]
  });

  const qrDataUrl = await QRCode.toDataURL(qrstring, { errorCorrectionLevel: 'M', width: 300 });
  res.json({ qrDataUrl, qrstring, amount, iban: payout.iban, partnerName });
});

router.post('/api/dash/payouts/:id/mark-paid', requireDashAuth, async (req, res) => {
  try {
    const data = await partnerAdminFetch(`/api/partner/admin/payout/${req.params.id}/process`, {
      method: 'POST',
      body: JSON.stringify({ status: 'completed', note: req.body?.note || 'Vyplatené cez PAY by square (dash).' })
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
