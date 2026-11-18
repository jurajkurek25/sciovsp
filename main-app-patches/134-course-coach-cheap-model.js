// AI Coach (main-app-patches/131) doteraz používal callClaudeWithFallback(),
// ktorý štartuje na pickStartingModel() — zdieľanom "poslednom dobrom
// modeli" naprieč /api/mentor, /api/zebra-builder aj generátorom (typicky
// Sonnet-tier). Coach nepotrebuje taký drahý model — je to jednoduchý
// Q&A chat, nie generovanie testov. Táto zmena mu dá VLASTNÝ fallback
// reťazec ukotvený na Haiku (najlacnejší/najrýchlejší tier), úplne
// nezávislý od zdieľaného _lastGoodClaudeModel stavu — takže sa nič
// nemení pre ostatné AI funkcie v appke.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.134-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('callClaudeCoachWithFallback')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes('/lessons/:lessonId/coach')) {
  console.error('main-app-patches/131 este nie je aplikovany. Nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

// ── 1) Vlastný fallback reťazec pre coach, ukotvený na Haiku ──
const ANCHOR_ROUTE = `// ── AI Coach pod lekciou — len pre kupcov kurzu, over faktov z 3+ zdrojov ──
app.post('/api/courses/:slug/lessons/:lessonId/coach', rateLimit, requireCourseBuyer, async (req, res) => {`;
const NEW_ROUTE = `// Coach ma vlastny, nezavisly fallback ukotveny na Haiku (najlacnejsi/
// najrychlejsi tier) - nepouziva zdielany pickStartingModel() stav, aby
// nemenil model ostatnym AI funkciam (mentor, zebra-builder, generator).
const COACH_STARTING_MODEL = 'claude-haiku-4-5-20251001';
async function callClaudeCoachWithFallback(makeRequest) {
  let triedModels = [];
  let currentModel = COACH_STARTING_MODEL;
  let lastResult = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    triedModels.push(currentModel);
    lastResult = await makeRequest(currentModel);
    if (lastResult.ok) return lastResult;
    const looksLikeModelIssue = lastResult.statusCode === 404 || /model/i.test(lastResult.data || '');
    if (!looksLikeModelIssue) return lastResult;
    const next = await getNewestUntriedModel(triedModels, 'haiku');
    if (!next) return lastResult;
    console.error(\`⚠️ AI Coach model '\${currentModel}' zlyhal, skúšam novší dostupný haiku model '\${next}'.\`);
    currentModel = next;
  }
  return lastResult;
}

// ── AI Coach pod lekciou — len pre kupcov kurzu, over faktov z 3+ zdrojov ──
app.post('/api/courses/:slug/lessons/:lessonId/coach', rateLimit, requireCourseBuyer, async (req, res) => {`;
let patched = replaceOnce(src, ANCHOR_ROUTE, NEW_ROUTE, '1: pridaj coach fallback helper');

// ── 2) Pouzi novy helper namiesto zdielaneho callClaudeWithFallback ──
const ANCHOR_CALL = `    callClaudeWithFallback((model) => new Promise((resolve) => {
      const payload = JSON.stringify({
        model,
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],`;
const NEW_CALL = `    callClaudeCoachWithFallback((model) => new Promise((resolve) => {
      const payload = JSON.stringify({
        model,
        max_tokens: 800,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],`;
patched = replaceOnce(patched, ANCHOR_CALL, NEW_CALL, '2: pouzi callClaudeCoachWithFallback');

const backup = FILE + '.pre-course-coach-cheap-model-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('AI Coach teraz bezi na Haiku 4.5 (claude-haiku-4-5-20251001), nezavisle od ostatnych AI funkcii.');
