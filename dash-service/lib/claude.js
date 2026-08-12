// Spoločný Claude API klient pre AI poradcu aj autonómny aiops runner —
// rovnaký fetch pattern ako partner/server.js callAdvisor().
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Tichý fallback na iný model, ak Anthropic odmietne primárny model ID
// (typicky preto, že bol medzičasom deprecated/stiahnutý) — bez tohto by
// appka prestala fungovať okamžite a ticho, kým by si to nenahlásili
// klienti. Zámerne skúša ďalší model LEN keď chyba vyzerá na problém s
// modelom (404 alebo zmienka "model" v chybovej správe), inak by sa
// zbytočne opakovala tá istá chyba (napr. zlý request) s iným modelom.
const MODEL_FALLBACK_CHAIN = ['claude-sonnet-5', 'claude-sonnet-4-6'];

async function callClaude({ system, messages, maxTokens = 1500, tools }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY nie je nastavený.');
  // Web search predlžuje odpoveď (viacero serverových vyhľadávaní pred finálnou
  // odpoveďou) — dlhší timeout len keď je tools naozaj použité.
  const timeoutMs = tools && tools.length ? 240000 : 60000;

  let lastErrText = '';
  for (let i = 0; i < MODEL_FALLBACK_CHAIN.length; i++) {
    const model = MODEL_FALLBACK_CHAIN[i];
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
      if (i > 0) console.error(`⚠️ Claude model fallback: '${MODEL_FALLBACK_CHAIN[0]}' zlyhal, použitý '${model}'.`);
      const data = await res.json();
      return (data.content || []).map(b => b.text || '').join('').trim();
    }
    const errText = await res.text().catch(() => '');
    lastErrText = errText;
    const looksLikeModelIssue = res.status === 404 || /model/i.test(errText);
    if (!looksLikeModelIssue || i === MODEL_FALLBACK_CHAIN.length - 1) {
      throw new Error(`Claude API vrátila chybu ${res.status}: ${errText.slice(0, 300)}`);
    }
  }
  throw new Error(`Claude API vrátila chybu: ${lastErrText.slice(0, 300)}`);
}

module.exports = { callClaude };
