// AI poradca pre Juraja — vidí naprieč celým biznisom (na rozdiel od
// partner appky, kde poradca vidí len jedného partnera). Kontext = live
// overview snapshot, aby vedel odpovedať na konkrétne otázky o číslach.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase } = require('../lib/db-partner');
const { callClaude } = require('../lib/claude');

function buildSystemPrompt(overviewSnapshot) {
  return `Si AI biznis poradca pre Juraja, zakladateľa a jediného prevádzkovateľa SP Tréner — appky na prípravu na vysokoškolské prijímacie testy (VŠP/SCIO), spolu s partnerským (affiliate) programom a reklamným programom pre inzerentov.

Vidíš live snapshot čísel naprieč všetkými 3 systémami (hlavná appka, affil partneri, reklamní partneri):
${JSON.stringify(overviewSnapshot, null, 2)}

Radíš konkrétne, stručne a prakticky — čo si všímať, čo zlepšiť, na čo sa zamerať. Ak dáta chýbajú alebo majú ok:false, priznaj to, nehádaj čísla. Odpovedaj v jazyku otázky (slovenčina/čeština).`;
}

router.get('/api/dash/advisor/history', requireDashAuth, async (req, res) => {
  const { data } = await supabase.from('dash_advisor_messages').select('role, content, created_at').order('created_at', { ascending: true }).limit(100);
  res.json({ messages: data || [] });
});

router.post('/api/dash/advisor/chat', requireDashAuth, async (req, res) => {
  const { message, overviewSnapshot } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: 'Napíš správu.' });

  try {
    const { data: prior } = await supabase.from('dash_advisor_messages')
      .select('role, content').order('created_at', { ascending: true }).limit(20);
    const history = [...(prior || []), { role: 'user', content: message.trim() }];

    const reply = await callClaude({
      system: buildSystemPrompt(overviewSnapshot || {}),
      messages: history.map(m => ({ role: m.role, content: m.content }))
    });

    await supabase.from('dash_advisor_messages').insert([
      { role: 'user', content: message.trim() },
      { role: 'assistant', content: reply }
    ]);

    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
