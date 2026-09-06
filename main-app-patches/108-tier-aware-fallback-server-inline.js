// Tier-aware fallback pre ZDIEĽANÝ fallback systém priamo v server.js
// (callClaudeWithFallback/callAnthropicRaw — používajú ho /api/generate-topic,
// /api/solution aj AI Coach). Doteraz padal na ČOKOĽVEK najnovšie dostupné
// bez ohľadu na cenu — presne to isté riziko, čo sme opravili v dash-service,
// ad-service, ad-subdomain-service a routes/lib/resolveModel.js (posledné
// sa ale ukázalo byť mŕtvy, nepoužívaný kód — táto kópia v server.js je tá
// skutočná, živá, ktorá sa vtedy vynechala).
//
// Verzia 2: namiesto jedného veľkého viacriadkového bloku (ktorý sa
// nezhodoval — pravdepodobne kvôli neviditeľnému rozdielu v riadkoch
// s diakritikou/emoji) používa tri malé, čisto ASCII kotvy.
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

let patched = src;

// 1) Pridaj tierOf() a rozšír signatúru getNewestUntriedModel o preferTier
patched = replaceOnce(
  patched,
  'async function getNewestUntriedModel(triedIds) {',
  `// Zámerne NESKOČÍ rovno na najnovší model bez ohľadu na cenu — fallback
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

async function getNewestUntriedModel(triedIds, preferTier) {`,
  'signatura getNewestUntriedModel'
);

// 2) Vlož preferTier logiku pred fallback na "hocijaky najnovsi"
patched = replaceOnce(
  patched,
  '    const found = _modelListCache.models.find(m => m && m.id && !triedIds.includes(m.id));\n    return found ? found.id : null;',
  `    if (preferTier) {
      const sameTier = _modelListCache.models.find(m => m && m.id && !triedIds.includes(m.id) && tierOf(m.id) === preferTier);
      if (sameTier) return sameTier.id;
    }
    const found = _modelListCache.models.find(m => m && m.id && !triedIds.includes(m.id));
    return found ? found.id : null;`,
  'preferTier vetva'
);

// 3) Odovzdaj tier zlyhaneho modelu pri volani z callClaudeWithFallback
patched = replaceOnce(
  patched,
  '    const next = await getNewestUntriedModel(triedModels);',
  '    const next = await getNewestUntriedModel(triedModels, tierOf(currentModel));',
  'volanie v callClaudeWithFallback'
);

const backup = FILE + '.pre-tier-aware-inline-fallback-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Toto opravuje VŠETKY 3 miesta, čo volajú callAnthropicRaw naraz: /api/generate-topic, /api/solution, AI Coach.');
