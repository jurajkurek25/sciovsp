// Darčekové karty v affil obchode — dash volá existujúce partner admin
// endpointy (nie priamy insert), aby zápis prešiel presne tou istou
// validáciou/logikou ako keby to robil admin priamo v partner appke.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase } = require('../lib/db-partner');
const { partnerAdminFetch } = require('../lib/db-partner');

router.get('/api/dash/giftcards', requireDashAuth, async (req, res) => {
  const { data, error } = await supabase.from('partner_gift_cards').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ cards: data || [] });
});

router.post('/api/dash/giftcards', requireDashAuth, async (req, res) => {
  try {
    const data = await partnerAdminFetch('/api/partner/admin/cards', {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/dash/giftcards/:id/codes', requireDashAuth, async (req, res) => {
  try {
    const data = await partnerAdminFetch(`/api/partner/admin/cards/${req.params.id}/codes`, {
      method: 'POST',
      body: JSON.stringify(req.body)
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
