// Žrebovanie súťaže "/sutaz" -- koleso šťastia pre livestream, s
// kryptograficky OVERITEĽNOU náhodnosťou (commit-reveal), nielen
// "ver mi, že server použil crypto.randomInt()".
//
// Princíp (podrobne vysvetlený aj v čl. VI štatútu):
//   1. /commit -- PRED žrebovaním appka vygeneruje tajný 32-bajtový seed
//      a HNEĎ zverejní jeho SHA-256 hash (seed_hash) + presný zoznam
//      všetkých kódov v tom momente (pool_snapshot). Zverejnený hash je
//      dôkaz, že seed sa odvtedy nedá zmeniť -- nikto nevie dopredu
//      nájsť iný text so zhodným SHA-256 hashom.
//   2. /spin -- výber pre pozíciu p sa počíta DETERMINISTICKY ako
//      HMAC-SHA256(seed, "sutaz-draw:" + p) mod (veľkosť zostávajúceho
//      poolu), nie čírym crypto.randomInt() -- seed ostáva v DB tajný,
//      appka ho frontend-u neposiela, len výsledok žrebu.
//   3. /reveal -- PO žrebovaní appka zverejní samotný seed. Ktokoľvek si
//      vie sám overiť SHA-256(seed) == seed_hash a prepočítať z (seed,
//      pool_snapshot) presne tých istých výhercov pomocou toho istého
//      HMAC algoritmu -- žiadna dôvera v appku nie je potrebná, overenie
//      je na GET /api/sutaz/draw-proof (hlavná appka, verejné) +
//      verejná stránka, ktorá prepočet urobí priamo v prehliadači.
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

// Platný, ešte nevyžrebovaný vstup -- použitý na /pool (náhľad pred
// commitom) a pri samotnom /commit (zmrazí presne tento zoznam).
async function fetchEligiblePool() {
  const { data, error } = await mainDb.from('sutaz_applications')
    .select('id, participant_code, full_name, residence_municipality')
    .eq('status', 'verified')
    .is('draw_position', null)
    .order('participant_code', { ascending: true }); // pevné, reprodukovateľné poradie -- nie created_at, nech ho vie zopakovať aj overovateľ len z pool_snapshot
  if (error) throw new Error(error.message);
  for (const row of data || []) {
    if (!row.participant_code) {
      row.participant_code = await generateUniqueParticipantCode();
      await mainDb.from('sutaz_applications').update({ participant_code: row.participant_code }).eq('id', row.id);
    }
  }
  return data || [];
}

// Jediný (najnovší) commitment -- appka rieši jedno kolo žrebovania
// naraz, nie viacero súbežných súťaží.
async function getActiveCommitment() {
  const { data } = await mainDb.from('sutaz_draw_commitment').select('*').order('committed_at', { ascending: false }).limit(1).maybeSingle();
  return data || null;
}

// Rovnaký algoritmus MUSÍ bežať aj v prehliadači pri overovaní (verejná
// stránka overenia v hlavnej appke) -- HMAC-SHA256(seed, "sutaz-draw:p")
// interpretovaný ako veľké celé číslo mod (dĺžka zostávajúceho poolu).
function indexForPosition(seed, position, remainingLength) {
  const digestHex = crypto.createHmac('sha256', seed).update('sutaz-draw:' + position).digest('hex');
  const asBigInt = BigInt('0x' + digestHex);
  return Number(asBigInt % BigInt(remainingLength));
}

router.get('/api/dash/sutaz-draw/pool', requireDashAuth, async (req, res) => {
  try {
    const commitment = await getActiveCommitment();
    if (commitment) {
      // Po commite je "pool" vždy ten zmrazený snapshot mínus už
      // vyžrebovaní -- nie nový live dotaz (ten by sa mohol odchýliť).
      const { data: draws } = await mainDb.from('sutaz_draws').select('code').order('position', { ascending: true });
      const drawnCodes = new Set((draws || []).map(d => d.code));
      const remaining = commitment.pool_snapshot.filter(c => !drawnCodes.has(c));
      return res.json({ codes: remaining, committed: true, seedHash: commitment.seed_hash, revealed: !!commitment.revealed_at });
    }
    const pool = await fetchEligiblePool();
    res.json({ codes: pool.map(p => p.participant_code), committed: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Zmrazí zoznam platných vstupov a zverejní hash tajného seedu -- MUSÍ
// prebehnúť PRED prvým /spin. Dá sa spustiť len raz za kolo (ak
// commitment už existuje, appka ho len vráti, nevytvorí nový -- inak by
// sa dal seed "prestrihnúť" po tom, čo niekto videl pool).
router.post('/api/dash/sutaz-draw/commit', requireDashAuth, async (req, res) => {
  try {
    const existing = await getActiveCommitment();
    if (existing) return res.json({ alreadyCommitted: true, seedHash: existing.seed_hash, poolSnapshot: existing.pool_snapshot, committedAt: existing.committed_at });

    const pool = await fetchEligiblePool();
    if (!pool.length) return res.status(400).json({ error: 'Žiadni oprávnení účastníci na zmrazenie poolu.' });

    const seed = crypto.randomBytes(32).toString('hex');
    const seedHash = crypto.createHash('sha256').update(seed).digest('hex');
    const poolSnapshot = pool.map(p => p.participant_code);

    const { data, error } = await mainDb.from('sutaz_draw_commitment').insert({
      seed, seed_hash: seedHash, pool_snapshot: poolSnapshot
    }).select().maybeSingle();
    if (error) throw new Error(error.message);

    res.json({ alreadyCommitted: false, seedHash: data.seed_hash, poolSnapshot: data.pool_snapshot, committedAt: data.committed_at });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/dash/sutaz-draw/spin', requireDashAuth, async (req, res) => {
  try {
    const commitment = await getActiveCommitment();
    if (!commitment) return res.status(400).json({ error: 'Pred žrebovaním treba najprv zmraziť zoznam (commit) -- pozri tlačidlo vyššie.' });

    const { data: existingDraws } = await mainDb.from('sutaz_draws').select('code, position').order('position', { ascending: true });
    const drawnCodes = new Set((existingDraws || []).map(d => d.code));
    const remaining = commitment.pool_snapshot.filter(c => !drawnCodes.has(c));
    if (!remaining.length) return res.status(400).json({ error: 'Žiadni ďalší oprávnení účastníci na vyžrebovanie.' });

    const position = (existingDraws || []).length + 1;
    const idx = indexForPosition(commitment.seed, position, remaining.length);
    const chosenCode = remaining[idx];

    const { data: chosen } = await mainDb.from('sutaz_applications').select('id, full_name, residence_municipality').eq('participant_code', chosenCode).maybeSingle();
    if (!chosen) throw new Error('Vyžrebovaný kód sa nenašiel v databáze prihlášok (nemalo by sa stať).');

    const update = { draw_position: position };
    if (position === 1) update.status = 'winner';
    const { error: updErr } = await mainDb.from('sutaz_applications').update(update).eq('id', chosen.id);
    if (updErr) throw new Error(updErr.message);

    await mainDb.from('sutaz_draws').insert({
      application_id: chosen.id, code: chosenCode, position, eligible_pool_size: remaining.length
    });

    res.json({
      wheelCodes: remaining,
      code: chosenCode,
      position,
      firstName: (chosen.full_name || '').trim().split(' ')[0] || '—',
      municipality: chosen.residence_municipality || '—'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Zverejní samotný seed -- odporúčanie: spusti AŽ keď sú hotové všetky
// žreby tohto kola (výherca + všetci náhradníci, koľkých chceš mať).
router.post('/api/dash/sutaz-draw/reveal', requireDashAuth, async (req, res) => {
  try {
    const commitment = await getActiveCommitment();
    if (!commitment) return res.status(400).json({ error: 'Žiadny commitment na odhalenie.' });
    if (commitment.revealed_at) return res.json({ seed: commitment.seed, revealedAt: commitment.revealed_at });

    const { data, error } = await mainDb.from('sutaz_draw_commitment').update({ revealed_at: new Date().toISOString() }).eq('id', commitment.id).select().maybeSingle();
    if (error) throw new Error(error.message);
    res.json({ seed: data.seed, revealedAt: data.revealed_at });
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
