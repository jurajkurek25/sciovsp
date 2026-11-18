// AI JE LEN PREMIUM/ELITE FUNKCIA — rozhodnutie majiteľa (nov 2026).
//
// Doteraz mali bezplatné účty denné limity na AI (patch 293: 10 generovaní,
// 20 vysvetlení, 20 koučovaní denne), 3 bezplatné použitia AI Generátora
// úloh (patch 256) a bezplatné testy sa pri prázdnom poole generovali
// naživo cez AI (14 Claude volaní na jeden test).
//
// Táto záplata:
//   1. server.js: /api/generate, /api/generate-topic, /api/solution a
//      /api/coach -- requireLogin + denný limit → requirePremium
//      (403 pre bezplatné účty, Premium/Elite bez zmeny).
//   2. server.js: /api/generate-full-test -- bezplatné testy (3 po
//      registrácii, 1 bez registrácie, bonusový za marketingový súhlas)
//      sa vydávajú LEN z hotového poolu (patch 288). Ak v ňom pre klienta
//      nie je nový test, AI sa NEVOLÁ, bezplatný test sa mu nespotrebuje
//      (trial_count / IP signál sa vráti späť) a dostane 503 s ponukou
//      Premium. Premium/Elite generuje ako doteraz (a tým plní pool).
//   3. routes/generate.js: /api/generate-topic -- bez 3 bezplatných
//      použití, len Premium/Elite.
//   4. public/app.html: AI generátor, AI kouč a AI postup riešenia
//      ukážu bezplatnému účtu ponuku Premium namiesto volania servera;
//      paywall má nový typ 'ai'. A OPRAVA: /api/solution, /api/coach a
//      /api/generate-topic sa volali BEZ Authorization hlavičky, takže ich
//      server od patchu 280 (requireLogin) odmietal úplne každému -- aj
//      platiacim. Teraz posielajú token cez getAuthHeader().
//
// Žiadna SQL migrácia nie je potrebná.
//
// Každý súbor sa upraví len ak ešte nie je upravený (značka "patch 299");
// všetky kotvy sa overia PRED zápisom čohokoľvek.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/299-ai-premium-only.js
const fs = require('fs');
const path = require('path');

const MARK = 'patch 299';
const TARGETS = [
  { file: 'server.js', pairs: [
  ["/api/generate",
   "app.post('/api/generate', rateLimit, requireLogin, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });\n\n  const GENERATE_DAILY_LIMIT = 10;\n  const generateToday = new Date().toISOString().slice(0, 10);\n  const { data: generateUser } = await supabase.from('users').select('is_premium, generate_count, generate_date').eq('email', req.userEmail).maybeSingle();\n  if (!generateUser?.is_premium) {\n    const generateTodaysCount = (generateUser?.generate_date === generateToday) ? (generateUser.generate_count || 0) : 0;\n    if (generateTodaysCount >= GENERATE_DAILY_LIMIT) {\n      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + GENERATE_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });\n    }\n    await supabase.from('users').update({ generate_count: generateTodaysCount + 1, generate_date: generateToday }).eq('email', req.userEmail);\n  }",
   "app.post('/api/generate', rateLimit, requirePremium, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });"],
  ["/api/generate-topic",
   "app.post('/api/generate-topic', rateLimit, requireLogin, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });\n\n  const GENERATE_TOPIC_DAILY_LIMIT = 10;\n  const genTopicToday = new Date().toISOString().slice(0, 10);\n  const { data: genTopicUser } = await supabase.from('users').select('is_premium, generate_topic_count, generate_topic_date').eq('email', req.userEmail).maybeSingle();\n  if (!genTopicUser?.is_premium) {\n    const genTopicTodaysCount = (genTopicUser?.generate_topic_date === genTopicToday) ? (genTopicUser.generate_topic_count || 0) : 0;\n    if (genTopicTodaysCount >= GENERATE_TOPIC_DAILY_LIMIT) {\n      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + GENERATE_TOPIC_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });\n    }\n    await supabase.from('users').update({ generate_topic_count: genTopicTodaysCount + 1, generate_topic_date: genTopicToday }).eq('email', req.userEmail);\n  }",
   "app.post('/api/generate-topic', rateLimit, requirePremium, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });"],
  ["/api/solution",
   "app.post('/api/solution', rateLimit, requireLogin, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });\n\n  const SOLUTION_DAILY_LIMIT = 20;\n  const solutionToday = new Date().toISOString().slice(0, 10);\n  const { data: solutionUser } = await supabase.from('users').select('is_premium, solution_count, solution_date').eq('email', req.userEmail).maybeSingle();\n  if (!solutionUser?.is_premium) {\n    const solutionTodaysCount = (solutionUser?.solution_date === solutionToday) ? (solutionUser.solution_count || 0) : 0;\n    if (solutionTodaysCount >= SOLUTION_DAILY_LIMIT) {\n      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + SOLUTION_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });\n    }\n    await supabase.from('users').update({ solution_count: solutionTodaysCount + 1, solution_date: solutionToday }).eq('email', req.userEmail);\n  }",
   "app.post('/api/solution', rateLimit, requirePremium, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });"],
  ["/api/coach",
   "app.post('/api/coach', rateLimit, requireLogin, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });\n\n  const COACH_DAILY_LIMIT = 20;\n  const coachToday = new Date().toISOString().slice(0, 10);\n  const { data: coachUser } = await supabase.from('users').select('is_premium, coach_count, coach_date').eq('email', req.userEmail).maybeSingle();\n  if (!coachUser?.is_premium) {\n    const coachTodaysCount = (coachUser?.coach_date === coachToday) ? (coachUser.coach_count || 0) : 0;\n    if (coachTodaysCount >= COACH_DAILY_LIMIT) {\n      return res.status(429).json({ error: 'Dosiahol/a si denný limit (' + COACH_DAILY_LIMIT + '/deň) pre bezplatný účet. Skús to znova zajtra, alebo si zváž Premium.' });\n    }\n    await supabase.from('users').update({ coach_count: coachTodaysCount + 1, coach_date: coachToday }).eq('email', req.userEmail);\n  }",
   "app.post('/api/coach', rateLimit, requirePremium, async (req, res) => {\n  if (!API_KEY) return res.status(500).json({ error: 'Server nie je nakonfigurovaný.' });"],
  ["/api/generate-full-test (len pool pre free)",
   "  } catch (poolErr) {\n    console.error('Pool lookup zlyhal, generujem nový test:', poolErr.message);\n  }\n\n  try {\n    console.log('Generujem celý AI test, obtiažnosť:', difficulty);",
   "  } catch (poolErr) {\n    console.error('Pool lookup zlyhal, generujem nový test:', poolErr.message);\n  }\n\n  // (patch 299) Živé AI generovanie testu je len pre Premium/Elite.\n  // Bezplatné testy (3 po registrácii, 1 bez registrácie, bonusový) sa\n  // vydávajú LEN z hotového poolu vyššie. Ak v ňom pre tohto klienta nie\n  // je nový test, bezplatný test sa mu nespotrebuje (trial_count /\n  // IP signál vyššie sa vráti späť) a ponúkne sa Premium.\n  {\n    let gftIsPremium = false;\n    if (email) {\n      const { data: gftUser } = await supabase.from('users')\n        .select('is_premium, trial_count').eq('email', email).maybeSingle();\n      gftIsPremium = !!gftUser?.is_premium;\n      if (!gftIsPremium && gftUser) {\n        await supabase.from('users').update({ trial_count: Math.max(0, (gftUser.trial_count || 0) - 1) }).eq('email', email);\n        await supabase.from('trial_abuse_signals').update({ exhausted_at: null })\n          .eq('signal_type', 'email_norm').eq('signal_value', normalizeEmailForAbuseCheck(email));\n      }\n    } else {\n      await supabase.from('trial_abuse_signals').delete()\n        .eq('signal_type', 'ip_anon_fulltest').eq('signal_value', getClientIp(req) || 'unknown');\n    }\n    if (!gftIsPremium) {\n      return res.status(503).json({\n        error: isCZ\n          ? 'Momentálně pro tebe nemáme další připravený test. Bezplatný test ti zůstává — zkus to později, nebo si nový test nech vygenerovat AI s Premium.'\n          : 'Momentálne pre teba nemáme ďalší pripravený test. Bezplatný test ti ostáva — skús to neskôr, alebo si nový test nechaj vygenerovať AI s Premium.',\n        premiumRequired: true\n      });\n    }\n  }\n\n  try {\n    console.log('Generujem celý AI test, obtiažnosť:', difficulty);"]
] },
  { file: path.join('routes', 'generate.js'), pairs: [
  ["/generate-topic: len Premium",
   "  // Platená Premium/Elite funkcia -- neplatiaci účet dostane 3\n  // bezplatné použitia (ai_generator_trial_count), potom Premium.\n  const authUser = await verifyToken(req);\n  if (!authUser) return res.status(401).json({ error: { message: 'Musíš byť prihlásený.' } });\n  const genUserEmail = (authUser.email || '').toLowerCase();\n  const { data: dbUser } = await supabase.from('users').select('is_premium, ai_generator_trial_count').eq('email', genUserEmail).maybeSingle();\n  if (!dbUser?.is_premium) {\n    const genUsed = dbUser?.ai_generator_trial_count || 0;\n    if (genUsed >= 3) {\n      return res.status(403).json({ error: { message: 'AI Generátor úloh vyžaduje Premium predplatné (3 bezplatné vyskúšania si už použil/a).' } });\n    }\n    await supabase.from('users').update({ ai_generator_trial_count: genUsed + 1 }).eq('email', genUserEmail);\n  }",
   "  // (patch 299) AI Generátor úloh je len pre Premium/Elite -- bez\n  // bezplatných použití (predtým 3, patch 256).\n  const authUser = await verifyToken(req);\n  if (!authUser) return res.status(401).json({ error: { message: 'Musíš byť prihlásený.' } });\n  const genUserEmail = (authUser.email || '').toLowerCase();\n  const { data: dbUser } = await supabase.from('users').select('is_premium').eq('email', genUserEmail).maybeSingle();\n  if (!dbUser?.is_premium) {\n    return res.status(403).json({ error: { message: 'AI Generátor úloh je súčasťou Premium a Elite.' }, premiumRequired: true });\n  }"]
] },
  { file: path.join('public', 'app.html'), pairs: [
  ["showPaywall: typ \"ai\"",
   "  const titleText=t(isAnon?'paywallTrialUsed1':'paywallTrialUsedN',{n:isAnon?FREE_TESTS_ANON:FREE_TESTS_REGISTERED});\n  const subtitleText=isAnon?t('paywallAnonSub',{n:FREE_TESTS_REGISTERED}):t('paywallRegSub');",
   "  // (patch 299) type==='ai' -- AI funkcie sú len pre Premium/Elite.\n  const titleText=type==='ai'?(currentLang==='cz'?'AI funkce jsou součástí Premium':'AI funkcie sú súčasťou Premium'):t(isAnon?'paywallTrialUsed1':'paywallTrialUsedN',{n:isAnon?FREE_TESTS_ANON:FREE_TESTS_REGISTERED});\n  const subtitleText=type==='ai'?t('paywallRegSub'):(isAnon?t('paywallAnonSub',{n:FREE_TESTS_REGISTERED}):t('paywallRegSub'));"],
  ["generateQuestions(): Premium gate",
   "async function generateQuestions(){\n  const part=currentGenSubject",
   "async function generateQuestions(){\n  if(!isPremium()){showPaywall('ai');return;}\n  const part=currentGenSubject"],
  ["generate-topic: Authorization",
   "    const response=await fetch('/api/generate-topic',{\n      method:'POST',headers:{'Content-Type':'application/json'},",
   "    const response=await fetch('/api/generate-topic',{\n      method:'POST',headers:{'Content-Type':'application/json',...(await getAuthHeader())},"],
  ["loadAICoach: Premium gate + Authorization",
   "  const ce=document.getElementById('coach-card');if(!ce)return;\n  ce.innerHTML=`<div class=\"coach-header\">",
   "  const ce=document.getElementById('coach-card');if(!ce)return;\n  if(!isPremium()){\n    ce.innerHTML=`<div class=\"coach-header\"><div class=\"coach-avatar\">🤖</div><div><div class=\"coach-name\">${t('coachLabel')}</div></div></div><div class=\"coach-text\">${currentLang==='cz'?'Osobní AI kouč je součástí Premium.':'Osobný AI kouč je súčasťou Premium.'} <a href=\"#\" onclick=\"showPaywall('ai');return false\" style=\"color:var(--volt)\">${currentLang==='cz'?'Více':'Viac'} →</a></div>`;\n    return;\n  }\n  ce.innerHTML=`<div class=\"coach-header\">"],
  ["coach fetch: Authorization",
   "    const response=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json'},",
   "    const response=await fetch('/api/coach',{method:'POST',headers:{'Content-Type':'application/json',...(await getAuthHeader())},"],
  ["fetchSolution: Premium gate",
   "  // Loading stav priamo vo wrap\n  wrap.innerHTML = '<div style=\"color:var(--text3);font-family:var(--mono);font-size:.76rem;padding:.5rem 0;display:flex",
   "  // (patch 299) AI postup riešenia je len pre Premium/Elite.\n  if (!isPremium()) {\n    wrap.innerHTML = '<div style=\"color:var(--text3);font-size:.76rem;font-family:var(--mono);padding:.3rem 0\">' + (currentLang==='cz' ? 'Postup řešení od AI je součástí Premium.' : 'Postup riešenia od AI je súčasťou Premium.') + ' <a href=\"#\" onclick=\"showPaywall(\\'ai\\');return false\" style=\"color:var(--volt)\">' + (currentLang==='cz' ? 'Více' : 'Viac') + ' →</a></div>';\n    return;\n  }\n\n  // Loading stav priamo vo wrap\n  wrap.innerHTML = '<div style=\"color:var(--text3);font-family:var(--mono);font-size:.76rem;padding:.5rem 0;display:flex"],
  ["solution fetch: Authorization",
   "    const res = await fetch('/api/solution', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },",
   "    const res = await fetch('/api/solution', {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },"]
] }
];

const LOCK = '.299-ai-premium-only-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

// 1) Načítaj a over všetko -- nič sa nezapíše, kým nesedia všetky kotvy.
const pending = [];
for (const t of TARGETS) {
  if (!fs.existsSync(t.file)) {
    console.error('❌ Nenašiel som súbor:', t.file, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
  let src = fs.readFileSync(t.file, 'utf8');
  if (src.includes(MARK)) {
    console.log('↷ ' + t.file + ': už je aplikované, preskakujem.');
    continue;
  }
  for (const [label, oldStr, newStr] of t.pairs) {
    const count = src.split(oldStr).length - 1;
    if (count !== 1) {
      console.error('❌ ' + t.file + ' — ' + label + ': kotva nájdená ' + count + '× (očakávané 1×). Nič som nezmenil.');
      process.exit(1);
    }
    src = src.replace(oldStr, () => newStr);
  }
  pending.push({ file: t.file, src });
}

if (!pending.length) {
  console.log('Všetko už je aplikované, nič som nezmenil.');
  process.exit(0);
}

// 2) Zálohy a zápis.
const stamp = Date.now();
for (const p of pending) {
  const backup = p.file + '.pre-299-ai-premium-only-' + stamp;
  fs.copyFileSync(p.file, backup);
  fs.writeFileSync(p.file, p.src);
  console.log('✅ ' + p.file + ' upravený. Záloha: ' + backup);
}

console.log('');
console.log('🚨 DÔLEŽITÉ:');
console.log('   1. node -c server.js && node -c routes/generate.js');
console.log('   2. pm2 restart sptrener-main');
console.log('   3. Over s bezplatným účtom: vysvetlenie úlohy, AI kouč a AI generátor ukážu ponuku Premium; bezplatný test príde z poolu (v logoch "Test z poolu").');
console.log('   4. Over s Premium účtom: vysvetlenie úlohy, AI kouč a generátor FUNGUJÚ (predtým im chýbal token a server ich odmietal).');
console.log('   5. Pool musí mať testy pre každý jazyk + obtiažnosť (sk/cz × easy/medium/hard), inak bezplatní dostanú "nemáme pripravený test". Stav: select lang, difficulty, count(*) from generated_test_pool group by 1,2;');
