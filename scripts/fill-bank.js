// Doplní zdieľanú banku úloh cez Message Batches API (o 50 % lacnejšie ako
// bežné volania). Každú kombináciu časť × typ × obtiažnosť doplní na
// BANK_TARGET_PER_BUCKET úloh (jedna požiadavka = BATCH_SIZE úloh). Čaká
// na dokončenie dávky (zvyčajne minúty, max. 24 h) a výsledky uloží do
// bank_questions.
//
// Spúšťaj napr. raz za noc: `npm run bank:fill` (cron / PM2 cron_restart).
require('dotenv').config();
const { pool } = require('../db/pool');
const {
  ANTHROPIC_API, TOPICS, DIFFICULTIES,
  buildRequestParams, anthropicHeaders, parseQuestions, insertIntoBank
} = require('../lib/questions');

const TARGET = Number(process.env.BANK_TARGET_PER_BUCKET) || 30;
const BATCH_SIZE = 10;
const POLL_MS = 60 * 1000;

async function main() {
  const counts = (await pool.query(
    'SELECT part, topic, difficulty, COUNT(*)::int AS n FROM bank_questions GROUP BY part, topic, difficulty'
  )).rows;
  const countOf = (part, topic, difficulty) =>
    counts.find(c => c.part === part && c.topic === topic && c.difficulty === difficulty)?.n || 0;

  const buckets = {};
  const requests = [];
  for (const [part, topics] of Object.entries(TOPICS)) {
    topics.forEach((topic, ti) => {
      for (const difficulty of DIFFICULTIES) {
        const needed = Math.ceil(Math.max(0, TARGET - countOf(part, topic, difficulty)) / BATCH_SIZE);
        for (let k = 0; k < needed; k++) {
          const customId = `${part}-${ti}-${difficulty}-${k}`;
          buckets[customId] = { part, topic, difficulty };
          requests.push({ custom_id: customId, params: buildRequestParams({ part, topic, difficulty, count: BATCH_SIZE }) });
        }
      }
    });
  }

  if (!requests.length) {
    console.log(`Banka je plná (každá kombinácia má aspoň ${TARGET} úloh).`);
    return;
  }

  const created = await fetch(`${ANTHROPIC_API}/messages/batches`, {
    method: 'POST', headers: anthropicHeaders(), body: JSON.stringify({ requests })
  });
  if (!created.ok) throw new Error(`Vytvorenie dávky zlyhalo: ${created.status} ${await created.text()}`);
  let batch = await created.json();
  console.log(`Dávka ${batch.id} odoslaná (${requests.length} požiadaviek), čakám na dokončenie...`);

  while (batch.processing_status !== 'ended') {
    await new Promise(r => setTimeout(r, POLL_MS));
    const res = await fetch(`${ANTHROPIC_API}/messages/batches/${batch.id}`, { headers: anthropicHeaders() });
    if (!res.ok) throw new Error(`Stav dávky zlyhal: ${res.status} ${await res.text()}`);
    batch = await res.json();
  }

  const results = await fetch(batch.results_url, { headers: anthropicHeaders() });
  if (!results.ok) throw new Error(`Stiahnutie výsledkov zlyhalo: ${results.status}`);
  const lines = (await results.text()).split('\n').filter(Boolean);

  // Výsledky prichádzajú v ľubovoľnom poradí — párujú sa podľa custom_id.
  let added = 0;
  for (const line of lines) {
    const { custom_id, result } = JSON.parse(line);
    const bucket = buckets[custom_id];
    if (!bucket || result.type !== 'succeeded') {
      console.error(`Požiadavka ${custom_id}: ${result?.type || 'neznáma'}`);
      continue;
    }
    const text = result.message.content?.find(b => b.type === 'text')?.text || '';
    const questions = parseQuestions(text, bucket);
    if (!questions) { console.error(`Požiadavka ${custom_id}: neplatný JSON`); continue; }
    added += (await insertIntoBank(questions)).length;
  }
  console.log(`Hotovo — do banky pribudlo ${added} úloh.`);
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
