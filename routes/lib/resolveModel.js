// Dynamický fallback na NAJNOVŠÍ dostupný Claude model (nikdy na starší
// pevne zadaný) — keď primárny model zlyhá s chybou, ktorá vyzerá na
// problém s modelom (napr. bol deprecated), appka si sama vypýta aktuálny
// zoznam modelov z Anthropic API (GET /v1/models), zoradí ich podľa dátumu
// vydania (created_at, najnovší prvý — nespolieha sa na poradie z API) a
// skúsi najnovší, ktorý ešte neskúsila. Úspešne nájdený model sa zapamätá
// pre bežiaci proces, aby ho ďalšie requesty skúsili ako prvý. Zoznam
// modelov sa cachuje 1 hodinu.
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
    const res = await fetch(url, {
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
    });
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

module.exports = { pickStartingModel, markModelGood, getNewestUntriedModel };
