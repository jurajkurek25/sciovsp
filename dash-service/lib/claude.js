// Spoločný Claude API klient pre AI poradcu aj autonómny aiops runner —
// rovnaký fetch pattern ako partner/server.js callAdvisor().
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Dynamický fallback na NAJNOVŠÍ dostupný model (nikdy na starší pevne
// zadaný) — keď Anthropic odmietne primárny model ID (typicky preto, že bol
// medzičasom deprecated/stiahnutý), appka si sama vypýta aktuálny zoznam
// modelov cez GET /v1/models, zoradí podľa dátumu vydania (created_at,
// najnovší prvý) a skúsi najnovší, ktorý ešte neskúsila. Úspešne nájdený
// model sa zapamätá pre bežiaci proces, aby ho ďalšie volania skúsili ako
// prvé. Skúša ďalší model LEN keď chyba vyzerá na problém s modelom (404
// alebo zmienka "model" v chybovej správe).
const MODEL_FALLBACK_BASELINE = 'claude-sonnet-5';
const MODEL_LIST_CACHE_TTL_MS = 60 * 60 * 1000;
let _modelListCache = null;
let _lastGoodClaudeModel = null;

function pickStartingModel() { return _lastGoodClaudeModel || MODEL_FALLBACK_BASELINE; }
function markModelGood(model) { _lastGoodClaudeModel = model; }

async function fetchAnthropicModelList() {
  let all = [];
  let afterId = null;
  for (let page = 0; page < 10; page++) {
    const url = 'https://api.anthropic.com/v1/models?limit=100' + (afterId ? '&after_id=' + encodeURIComponent(afterId) : '');
    const res = await fetch(url, { headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' } });
    if (!res.ok) break;
    const data = await res.json();
    const list = Array.isArray(data.data) ? data.data : [];
    all = all.concat(list);
    if (!data.has_more || !data.last_id || !list.length) break;
    afterId = data.last_id;
  }
  return all;
}

async function getNewestUntriedModel(triedIds) {
  try {
    if (!_modelListCache || Date.now() - _modelListCache.fetchedAt > MODEL_LIST_CACHE_TTL_MS) {
      const models = await fetchAnthropicModelList();
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

async function callClaude({ system, messages, maxTokens = 1500, tools }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY nie je nastavený.');
  // Web search predlžuje odpoveď (viacero serverových vyhľadávaní pred finálnou
  // odpoveďou) — dlhší timeout len keď je tools naozaj použité.
  const timeoutMs = tools && tools.length ? 240000 : 60000;

  let triedModels = [];
  let model = pickStartingModel();
  let lastErrText = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    triedModels.push(model);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      const body = { model, max_tokens: maxTokens, system, messages };
      if (tools && tools.length) body.tools = tools;
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(t);
    }
    if (res.ok) {
      markModelGood(model);
      if (attempt > 0) console.error(`⚠️ Claude model fallback: úspešne použitý novší model '${model}' (predtým zlyhalo: ${triedModels.slice(0, -1).join(', ')}).`);
      const data = await res.json();
      return (data.content || []).map(b => b.text || '').join('').trim();
    }
    const errText = await res.text().catch(() => '');
    lastErrText = errText;
    const looksLikeModelIssue = res.status === 404 || /model/i.test(errText);
    if (!looksLikeModelIssue) {
      throw new Error(`Claude API vrátila chybu ${res.status}: ${errText.slice(0, 300)}`);
    }
    const next = await getNewestUntriedModel(triedModels);
    if (!next) {
      throw new Error(`Claude API vrátila chybu ${res.status}: ${errText.slice(0, 300)}`);
    }
    console.error(`⚠️ Claude model '${model}' zlyhal (vyzerá na problém s modelom), skúšam novší dostupný '${next}'.`);
    model = next;
  }
  throw new Error(`Claude API vrátila chybu: ${lastErrText.slice(0, 300)}`);
}

module.exports = { callClaude };
