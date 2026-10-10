// Žrebovanie súťaže "/sutaz" -- koleso šťastia pre livestream. Posiela
// prehliadaču LEN súťažné kódy (nikdy mená/mestá vopred) -- to isté
// koleso potom animuje na server-vybraný výsledok. Výber je
// kryptograficky náhodný (crypto.randomInt), nie Math.random().
//
// Poradie žrebov: 1 = výherca (status -> 'winner'), 2+ = náhradníci
// (status ostáva 'verified', len draw_position sa zapíše) -- presne
// podľa čl. VI ods. 1 štatútu. Každý žreb sa zapisuje do sutaz_draws
// (zápisnica, čl. VI ods. 2 -- dátum, počet platných vstupov, spôsob).
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

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

// Platný, ešte nevyžrebovaný vstup -- rovnaký filter na /pool aj na
// začiatku /spin (fresh fetch, nie cache), aby koleso na obrazovke
// zodpovedalo presne tomu, z čoho sa reálne žrebuje.
async function fetchEligiblePool() {
  const { data, error } = await mainDb.from('sutaz_applications')
    .select('id, participant_code, full_name, residence_municipality')
    .eq('status', 'verified')
    .is('draw_position', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  // Defenzívne: ak by platný účastník nemal kód (napr. starý záznam
  // spred tejto funkcie), koleso ho nemôže zobraziť ani vyžrebovať --
  // dožrebuje sa mu kód na mieste, nie je dôvod ho vynechávať.
  for (const row of data || []) {
    if (!row.participant_code) {
      row.participant_code = await generateUniqueParticipantCode();
      await mainDb.from('sutaz_applications').update({ participant_code: row.participant_code }).eq('id', row.id);
    }
  }
  return data || [];
}

router.get('/api/dash/sutaz-draw/pool', requireDashAuth, async (req, res) => {
  try {
    const pool = await fetchEligiblePool();
    res.json({ codes: pool.map(p => p.participant_code) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/dash/sutaz-draw/spin', requireDashAuth, async (req, res) => {
  try {
    const pool = await fetchEligiblePool();
    if (!pool.length) return res.status(400).json({ error: 'Žiadni ďalší oprávnení účastníci na vyžrebovanie.' });

    const idx = crypto.randomInt(pool.length);
    const chosen = pool[idx];

    const { count } = await mainDb.from('sutaz_applications').select('id', { count: 'exact', head: true }).not('draw_position', 'is', null);
    const position = (count || 0) + 1;

    const update = { draw_position: position };
    if (position === 1) update.status = 'winner';
    const { error: updErr } = await mainDb.from('sutaz_applications').update(update).eq('id', chosen.id);
    if (updErr) throw new Error(updErr.message);

    await mainDb.from('sutaz_draws').insert({
      application_id: chosen.id, code: chosen.participant_code, position, eligible_pool_size: pool.length
    });

    res.json({
      wheelCodes: pool.map(p => p.participant_code),
      code: chosen.participant_code,
      position,
      firstName: (chosen.full_name || '').trim().split(' ')[0] || '—',
      municipality: chosen.residence_municipality || '—'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/dash/sutaz-draw/history', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('sutaz_draws')
    .select('id, code, position, eligible_pool_size, drawn_at, application_id')
    .order('position', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const appIds = [...new Set((data || []).map(d => d.application_id))];
  let namesByAppId = {};
  if (appIds.length) {
    const { data: apps } = await mainDb.from('sutaz_applications').select('id, full_name, residence_municipality').in('id', appIds);
    namesByAppId = Object.fromEntries((apps || []).map(a => [a.id, a]));
  }

  const draws = (data || []).map(d => {
    const app = namesByAppId[d.application_id];
    return {
      position: d.position,
      code: d.code,
      firstName: app ? ((app.full_name || '').trim().split(' ')[0] || '—') : '—',
      municipality: app ? (app.residence_municipality || '—') : '—',
      eligiblePoolSize: d.eligible_pool_size,
      drawnAt: d.drawn_at
    };
  });
  res.json({ draws });
});

module.exports = router;
