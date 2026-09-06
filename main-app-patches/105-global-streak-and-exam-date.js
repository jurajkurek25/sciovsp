// Dátová vrstva pre dve nové emailové automatizácie:
// (1) Elite denný email so streakom + odpočtom do testu — potrebuje
//     tréningový streak nezávislý od členstva v klane (clan_stats funguje
//     len pre členov klanu, viď POST /api/clans/sync-stats nižšie).
// (2) "Veľa šťastia" email v deň testu + žiadosť o recenziu deň po teste —
//     potrebuje osobný termín testu, ktorý si user nastaví v appke.
//
// Konkrétne emailové crony sú v samostatných patchoch (106, 107) — tento
// patch len ukladá dáta, na ktorých tie crony stavajú. Vyžaduje najprv
// spustenú migráciu db/migrate_streak_exam_features.sql.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('training_streaks')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

// ── 1) sync-stats: presunúť percentil/tests_count save PRED early-return
//    a pridať globálny streak, nech bežia pre KAŽDÉHO usera, nie len
//    členov klanu. Samotný klanový cyklus nižšie ostáva nezmenený.
const OLD_SYNC = `    if (!memberships?.length) return res.json({ synced: 0 });

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Ulož percentil + increment tests_count do users (pre denné emaily)
    const { estimatedV, estimatedA } = req.body;
    if (estimatedV !== undefined || estimatedA !== undefined) {
      const updateData = {};
      if (estimatedV !== undefined) updateData.last_percentile_v = estimatedV;
      if (estimatedA !== undefined) updateData.last_percentile_a = estimatedA;
      await supabase.rpc('increment_tests_count', { user_email: user.email })
        .catch(() => {});
      await supabase.from('users').update(updateData).eq('email', user.email)
        .catch(() => {});
    }`;

const NEW_SYNC = `    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Ulož percentil + increment tests_count do users (pre denné emaily) —
    // beží pre KAŽDÉHO usera, nie len členov klanu.
    const { estimatedV, estimatedA } = req.body;
    if (estimatedV !== undefined || estimatedA !== undefined) {
      const updateData = {};
      if (estimatedV !== undefined) updateData.last_percentile_v = estimatedV;
      if (estimatedA !== undefined) updateData.last_percentile_a = estimatedA;
      await supabase.rpc('increment_tests_count', { user_email: user.email })
        .catch(() => {});
      await supabase.from('users').update(updateData).eq('email', user.email)
        .catch(() => {});
    }

    // Globálny (na klane nezávislý) tréningový streak — používa ho Elite
    // denný email so streakom + odpočtom, funguje aj pre usera bez klanu.
    try {
      const { data: curStreak } = await supabase.from('training_streaks')
        .select('streak_days, last_active_date, best_percentile')
        .eq('email', user.email).maybeSingle();
      let globalStreak = curStreak?.streak_days || 0;
      if (!curStreak || curStreak.last_active_date !== today) {
        globalStreak = curStreak?.last_active_date === yesterday ? globalStreak + 1 : 1;
      }
      await supabase.from('training_streaks').upsert({
        email: user.email,
        streak_days: globalStreak,
        last_active_date: today,
        best_percentile: Math.max(curStreak?.best_percentile || 0, estimatedPercentile),
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' });
    } catch (e) {
      console.error('training_streaks sync:', e.message);
    }

    if (!memberships?.length) return res.json({ synced: 0 });`;

let patched = replaceOnce(src, OLD_SYNC, NEW_SYNC, 'sync-stats blok');

// ── 2) /api/auth/status: pridaj examDate do odpovede (appka podľa toho
//    predvyplní dátumový picker).
const OLD_STATUS = `    const { data: user } = await supabase.from('users')
      .select('is_premium, subscription_status, ref_code, premium_expires_at, plan')
      .eq('email', email).single();

    // Premium je aktívny ak: is_premium=true (predplatné) ALEBO premium_expires_at je v budúcnosti (bonus dni)
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    const isPremium = (user?.is_premium || bonusActive) || false;

    res.json({
      isPremium,
      status: user?.subscription_status || 'free',
      plan: user?.plan || (isPremium ? 'premium' : 'free'),
      refCode: user?.ref_code || null,
      premiumExpiresAt: user?.premium_expires_at || null
    });`;

const NEW_STATUS = `    const { data: user } = await supabase.from('users')
      .select('is_premium, subscription_status, ref_code, premium_expires_at, plan, exam_date')
      .eq('email', email).single();

    // Premium je aktívny ak: is_premium=true (predplatné) ALEBO premium_expires_at je v budúcnosti (bonus dni)
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    const isPremium = (user?.is_premium || bonusActive) || false;

    res.json({
      isPremium,
      status: user?.subscription_status || 'free',
      plan: user?.plan || (isPremium ? 'premium' : 'free'),
      refCode: user?.ref_code || null,
      premiumExpiresAt: user?.premium_expires_at || null,
      examDate: user?.exam_date || null
    });`;

patched = replaceOnce(patched, OLD_STATUS, NEW_STATUS, '/api/auth/status blok');

// ── 3) Nový endpoint: user si sám nastaví/zmaže termín testu.
const ANCHOR = `// ── POST /api/clans/:id/leave — opusti klan ──────────────────`;
const NEW_ROUTE = `// ── POST /api/profile/exam-date — user si nastaví/zmaže termín testu ──
app.post('/api/profile/exam-date', rateLimit, async (req, res) => {
  const user = await verifySupabaseToken(req);
  if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });

  const { examDate } = req.body;
  if (examDate !== null && examDate !== undefined && !/^\\d{4}-\\d{2}-\\d{2}$/.test(examDate)) {
    return res.status(400).json({ error: 'Neplatný dátum.' });
  }
  try {
    // Zmena termínu resetuje "už odoslané" príznaky — pri posunutí termínu
    // chce user nový good luck / žiadosť o recenziu k NOVÉMU dátumu, nie ticho.
    await supabase.from('users').update({
      exam_date: examDate || null,
      exam_goodluck_sent_at: null,
      exam_review_token: null,
      exam_review_requested_at: null
    }).eq('email', user.email);
    res.json({ ok: true });
  } catch (err) {
    console.error('exam-date update:', err.message);
    res.status(500).json({ error: err.message });
  }
});

${ANCHOR}`;

patched = replaceOnce(patched, ANCHOR, NEW_ROUTE, '/api/clans/:id/leave anchor');

const backup = FILE + '.pre-global-streak-exam-date-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_streak_exam_features.sql uz bezal.');
