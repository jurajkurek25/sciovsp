// Tier-aware fallback pre ZDIEĽANÝ fallback systém priamo v server.js
// (callClaudeWithFallback/callAnthropicRaw — používajú ho /api/generate-topic,
// /api/solution aj AI Coach). Doteraz padal na ČOKOĽVEK najnovšie dostupné
// bez ohľadu na cenu — presne to isté riziko, čo sme opravili v dash-service,
// ad-service, ad-subdomain-service a routes/lib/resolveModel.js (posledné
// sa ale ukázalo byť mŕtvy, nepoužívaný kód — táto kópia v server.js je tá
// skutočná, živá, ktorá sa vtedy vynechala).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('function tierOf(')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD_BLOCK = `async function getNewestUntriedModel(triedIds) {
  try {
    if (!_modelListCache || Date.now() - _modelListCache.fetchedAt > MODEL_LIST_CACHE_TTL_MS) {
      const models = await fetchAnthropicModelPage(null, []);
      models.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      _modelListCache = { models, fetchedAt: Date.now() };
    }
    const found = _modelListCache.models.find(m => m && m.id && !triedIds.includes(m.id));
    return found ? found.id : null;
  } catch (e) {
    console.error('⚠️ Nepodarilo sa zistiť aktuálny zoznam Claude modelov:', e.message);
    return null;
  }
}

async function callClaudeWithFallback(makeRequest) {
  let triedModels = [];
  let currentModel = pickStartingModel();
  let lastResult = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    triedModels.push(currentModel);
    lastResult = await makeRequest(currentModel);
    if (lastResult.ok) {
      markModelGood(currentModel);
      if (attempt > 0) console.error(\`⚠️ Claude model fallback: úspešne použitý novší model '\${currentModel}' (predtým zlyhalo: \${triedModels.slice(0, -1).join(', ')}).\`);
      return lastResult;
    }
    const looksLikeModelIssue = lastResult.statusCode === 404 || /model/i.test(lastResult.data || '');
    if (!looksLikeModelIssue) return lastResult;
    const next = await getNewestUntriedModel(triedModels);
    if (!next) return lastResult;
    console.error(\`⚠️ Claude model '\${currentModel}' zlyhal (vyzerá na problém s modelom), skúšam novší dostupný '\${next}'.\`);
    currentModel = next;
  }
  return lastResult;
}`;

const NEW_BLOCK = `// Zámerne NESKOČÍ rovno na najnovší model bez ohľadu na cenu — fallback
// najprv skúsi najnovší model v ROVNAKEJ cenovej triede ako ten, čo
// zlyhal (haiku→haiku, sonnet→sonnet), a až keď taký vôbec nie je
// dostupný, padne na čokoľvek najnovšie ako posledný záchranný bod.
function tierOf(modelId) {
  const id = (modelId || '').toLowerCase();
  if (id.includes('haiku')) return 'haiku';
  if (id.includes('sonnet')) return 'sonnet';
  if (id.includes('opus')) return 'opus';
  if (id.includes('fable') || id.includes('mythos')) return 'premium';
  return null;
}

async function getNewestUntriedModel(triedIds, preferTier) {
  try {
    if (!_modelListCache || Date.now() - _modelListCache.fetchedAt > MODEL_LIST_CACHE_TTL_MS) {
      const models = await fetchAnthropicModelPage(null, []);
      models.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      _modelListCache = { models, fetchedAt: Date.now() };
    }
    if (preferTier) {
      const sameTier = _modelListCache.models.find(m => m && m.id && !triedIds.includes(m.id) && tierOf(m.id) === preferTier);
      if (sameTier) return sameTier.id;
    }
    const found = _modelListCache.models.find(m => m && m.id && !triedIds.includes(m.id));
    return found ? found.id : null;
  } catch (e) {
    console.error('⚠️ Nepodarilo sa zistiť aktuálny zoznam Claude modelov:', e.message);
    return null;
  }
}

async function callClaudeWithFallback(makeRequest) {
  let triedModels = [];
  let currentModel = pickStartingModel();
  let lastResult = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    triedModels.push(currentModel);
    lastResult = await makeRequest(currentModel);
    if (lastResult.ok) {
      markModelGood(currentModel);
      if (attempt > 0) console.error(\`⚠️ Claude model fallback: úspešne použitý novší model '\${currentModel}' (predtým zlyhalo: \${triedModels.slice(0, -1).join(', ')}).\`);
      return lastResult;
    }
    const looksLikeModelIssue = lastResult.statusCode === 404 || /model/i.test(lastResult.data || '');
    if (!looksLikeModelIssue) return lastResult;
    const next = await getNewestUntriedModel(triedModels, tierOf(currentModel));
    if (!next) return lastResult;
    console.error(\`⚠️ Claude model '\${currentModel}' zlyhal (vyzerá na problém s modelom), skúšam novší dostupný '\${next}'.\`);
    currentModel = next;
  }
  return lastResult;
}`;

const patched = replaceOnce(src, OLD_BLOCK, NEW_BLOCK, 'callClaudeWithFallback blok');

const backup = FILE + '.pre-tier-aware-inline-fallback-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Toto opravuje VŠETKY 3 miesta, čo volajú callAnthropicRaw naraz: /api/generate-topic, /api/solution, AI Coach.');
