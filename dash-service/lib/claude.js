// Spoločný Claude API klient pre AI poradcu aj autonómny aiops runner —
// rovnaký fetch pattern ako partner/server.js callAdvisor().
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-5';

async function callClaude({ system, messages, maxTokens = 1500, tools }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY nie je nastavený.');
  const controller = new AbortController();
  // Web search predlžuje odpoveď (viacero serverových vyhľadávaní pred finálnou
  // odpoveďou) — dlhší timeout len keď je tools naozaj použité.
  const timeoutMs = tools && tools.length ? 240000 : 60000;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    const body = { model: MODEL, max_tokens: maxTokens, system, messages };
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
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Claude API vrátila chybu ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || '').join('').trim();
}

module.exports = { callClaude };
