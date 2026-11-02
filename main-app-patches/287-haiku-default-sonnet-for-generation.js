// NÁKLADOVÁ ZÁPLATA — presun väčšiny AI funkcií na Haiku 4.5 (3x lacnejší
// ako Sonnet 5 na vstup aj výstup), ALE generovanie samotných SCIO úloh
// (najdrahšia, matematicky/logicky najnáročnejšia časť, kde zlé overenie
// výpočtu najviac bolí kvalitu) ostáva na Sonnet 5.
//
// MODEL_FALLBACK_BASELINE (spoločný štart pre callClaudeWithFallback) sa
// mení z Sonnet 5 na Haiku 4.5 -- automaticky zlacňuje: AI Coach
// (/api/coach), Mentor (/api/mentor), Zebra Builder (/api/zebra-builder),
// Analysis (/api/analysis), Solution (/api/solution) a generic passthrough
// (/api/generate). Kurzový coach už dnes beží na Haiku (COACH_STARTING_MODEL),
// nezávisle, bez zmeny. callAnthropicGrade (hodnotenie uploadov v kurzoch)
// tiež bez zmeny -- nejde cez callClaudeWithFallback.
//
// Aby generovanie úloh OSTALO na Sonnet 5 (nie globálne na Haiku),
// callClaudeWithFallback dostáva nový VOLITEĹNÝ druhý parameter
// { pick, markGood } -- vlastný pár na sledovanie "posledný dobrý model",
// oddelený od spoločného Haiku-tier sledovania, aby úspešné Haiku volania
// NIKDY neprepísali, na čom má generovanie ŠTARTOVAŤ (a naopak).
// Aplikované na: callAnthropic() (plný test), callAnthropicSimple()
// (Mirror Mode) a /api/generate-topic (jednotlivý okruh, front-end
// generátor). /api/generate (generic passthrough) ZÁMERNE ostáva na
// spoločnom Haiku defaulte -- nejde o SCIO generovanie.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/287-haiku-default-sonnet-for-generation.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.287-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('GENERATION_MODEL_BASELINE')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) MODEL_FALLBACK_BASELINE -> Haiku 4.5, + nový generation-tier pár ──
const BASELINE_OLD = `let _modelListCache = null;
let _lastGoodClaudeModel = null;
const MODEL_LIST_CACHE_TTL_MS = 60 * 60 * 1000;
const MODEL_FALLBACK_BASELINE = 'claude-sonnet-5';

function pickStartingModel() { return _lastGoodClaudeModel || MODEL_FALLBACK_BASELINE; }
function markModelGood(model) { _lastGoodClaudeModel = model; }`;

const BASELINE_NEW = `let _modelListCache = null;
let _lastGoodClaudeModel = null;
const MODEL_LIST_CACHE_TTL_MS = 60 * 60 * 1000;
// (patch 287) Haiku 4.5 je teraz spoločný štart pre Coach/Mentor/Zebra
// Builder/Analysis/Solution -- 3x lacnejšie ako Sonnet 5 na vstup aj
// výstup, dostatočné pre tieto nižšie-stávkové, kratšie úlohy.
const MODEL_FALLBACK_BASELINE = 'claude-haiku-4-5-20251001';

function pickStartingModel() { return _lastGoodClaudeModel || MODEL_FALLBACK_BASELINE; }
function markModelGood(model) { _lastGoodClaudeModel = model; }

// (patch 287) Samostatné sledovanie pre generovanie SCIO úloh -- OSTÁVA
// na Sonnet 5 (najdrahšia, ale aj najkritickejšia časť na kvalitu --
// matematika/logika v analytických úlohách). Oddelené od _lastGoodClaudeModel
// hore, aby úspešné Haiku volania (Coach/Mentor/...) nikdy nezmenili, na
// čom štartuje generovanie, a naopak.
let _lastGoodGenerationModel = null;
const GENERATION_MODEL_BASELINE = 'claude-sonnet-5';
function pickGenerationStartingModel() { return _lastGoodGenerationModel || GENERATION_MODEL_BASELINE; }
function markGenerationModelGood(model) { _lastGoodGenerationModel = model; }
const GENERATION_MODEL_FNS = { pick: pickGenerationStartingModel, markGood: markGenerationModelGood };`;

src = replaceExactCount(src, BASELINE_OLD, BASELINE_NEW, 1, 'MODEL_FALLBACK_BASELINE + generation-tier tracking');

// ── 2) callClaudeWithFallback: voliteľný 2. parameter { pick, markGood } ──
const CCWF_OLD = `async function callClaudeWithFallback(makeRequest) {
  let triedModels = [];
  let currentModel = pickStartingModel();
  let lastResult = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    triedModels.push(currentModel);
    lastResult = await makeRequest(currentModel);
    if (lastResult.ok) {
      markModelGood(currentModel);`;

const CCWF_NEW = `async function callClaudeWithFallback(makeRequest, startFns) {
  const pick = (startFns && startFns.pick) || pickStartingModel;
  const markGood = (startFns && startFns.markGood) || markModelGood;
  let triedModels = [];
  let currentModel = pick();
  let lastResult = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    triedModels.push(currentModel);
    lastResult = await makeRequest(currentModel);
    if (lastResult.ok) {
      markGood(currentModel);`;

src = replaceExactCount(src, CCWF_OLD, CCWF_NEW, 1, 'callClaudeWithFallback signature + markGood');

// ── 3) callAnthropic() (plný test, generateTopicWithRetry) -> Sonnet tier ──
src = replaceExactCount(
  src,
  `    apiReq.on('error', (err) => resolve({ ok: false, statusCode: 502, data: JSON.stringify({ error: { message: err.message } }) }));
    apiReq.write(payload);
    apiReq.end();
  })).then((result) => {
    let parsed;`,
  `    apiReq.on('error', (err) => resolve({ ok: false, statusCode: 502, data: JSON.stringify({ error: { message: err.message } }) }));
    apiReq.write(payload);
    apiReq.end();
  }), GENERATION_MODEL_FNS).then((result) => {
    let parsed;`,
  1, 'callAnthropic() -> GENERATION_MODEL_FNS'
);

// ── 4) callAnthropicSimple() (Mirror Mode) -> Sonnet tier ───────
src = replaceExactCount(
  src,
  `    req.on('error', (err) => resolve({ ok: false, statusCode: 502, data: JSON.stringify({ error: { message: err.message } }) }));
    req.write(payload); req.end();
  })).then((result) => {
    const parsed = JSON.parse(result.data);`,
  `    req.on('error', (err) => resolve({ ok: false, statusCode: 502, data: JSON.stringify({ error: { message: err.message } }) }));
    req.write(payload); req.end();
  }), GENERATION_MODEL_FNS).then((result) => {
    const parsed = JSON.parse(result.data);`,
  1, 'callAnthropicSimple() -> GENERATION_MODEL_FNS'
);

// ── 5) /api/generate-topic: callAnthropicRaw s GENERATION_MODEL_FNS ──
src = replaceExactCount(
  src,
  `      "explanation": "vysvětlení (1-2 věty)"
    }
  ]
}\`
    }]
  });

  callAnthropicRaw(payload, res);
});`,
  `      "explanation": "vysvětlení (1-2 věty)"
    }
  ]
}\`
    }]
  });

  callAnthropicRaw(payload, res, false, GENERATION_MODEL_FNS);
});`,
  1, '/api/generate-topic callAnthropicRaw call site'
);

// ── 6) callAnthropicRaw: prepusti voliteľný startFns ďalej ──────
src = replaceExactCount(
  src,
  `function callAnthropicRaw(payload, res, coachMode = false) {
  callClaudeWithFallback((model) => new Promise((resolve) => {`,
  `function callAnthropicRaw(payload, res, coachMode = false, startFns) {
  callClaudeWithFallback((model) => new Promise((resolve) => {`,
  1, 'callAnthropicRaw signature'
);
src = replaceExactCount(
  src,
  `    apiReq.write(attemptPayload);
    apiReq.end();
  })).then((result) => {
    if (coachMode) {`,
  `    apiReq.write(attemptPayload);
    apiReq.end();
  }), startFns).then((result) => {
    if (coachMode) {`,
  1, 'callAnthropicRaw startFns pass-through'
);

const backup = FILE + '.pre-287-haiku-default-sonnet-for-generation-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: Haiku 4.5 je teraz default pre Coach/Mentor/Zebra Builder/Analysis/Solution/generic passthrough.');
console.log('✅ server.js: generovanie SCIO úloh (plný test, Mirror Mode, jednotlivý okruh) ostáva na Sonnet 5, samostatne sledované.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
