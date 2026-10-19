// Spoločná logika AI generovania úloh — používa ju API (routes/ai.js) aj
// dávkové dopĺňanie banky úloh (scripts/fill-bank.js).
const { pool } = require('../db/pool');

const ANTHROPIC_API = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1';
// Sonnet 5.5 — lacnejší ($2/$10 za 1M tokenov) aj novší ako Sonnet 4.6 ($3/$15).
const MODEL = 'claude-sonnet-5-5';

// Povolené hodnoty — nič iné sa do promptu nedostane (ochrana pred prompt
// injection, t. j. zneužitím API kľúča na ľubovoľné iné texty).
const TOPICS = {
  verbal: ['Doplňovanie do viet', 'Vzťahy medzi slovami', 'Antosynonymá', 'Koherencia textov', 'Vyvodzovanie z krátkych textov', 'Porozumenie textu', 'Srovnávacie čítanie'],
  analytical: ['Grafy a tabuľky', 'Porovnávanie hodnôt', 'Postačujúce podmienky', 'Slovné úlohy', 'Verbalizácia, matematizácia', 'Operácie a tajné operácie', 'Zebry (logické úlohy)']
};
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// Systémový prompt — štruktúra testov všeobecných študijných predpokladov.
// Názvy tretích strán (ochranné známky) zámerne nepoužívame.
const SYSTEM_PROMPT = `Si odborník na tvorbu úloh pre slovenské testy všeobecných študijných predpokladov (VŠP) na prijímacie skúšky na vysoké školy.
V textoch úloh ani vysvetleniach nespomínaj názvy firiem ani značiek, ktoré tieto testy organizujú.
Testy sú písané po slovensky. Test má 66 úloh rozdelených na verbálnu (33 úloh) a analytickú (33 úloh) časť.

VERBÁLNE TYPY ÚLOH:
- Doplňovanie do viet: krátky text s luzerami, vyber dvojicu/trojicu slov
- Vzťahy medzi slovami: analogie vo forme "X : Y = ? : ?" 
- Antosynonymá: nájdi synonymum (A-D) a antonymum (E-H) pre podčiarknuté slovo vo vete
- Koherencia textov: nájdi JEDNU vetu ktorá NEZAPADÁ do celkového textu
- Vyvodzovanie z krátkych textov: zo 100-200 slov urči ktoré tvrdenia VYPLÝVAJÚ z textu
- Porozumenie textu: dlhší text (300-500 slov) + 3 otázky o jeho obsahu a autorových postojoch
- Srovnávacie čítanie: 2 texty s protikladnými pohľadmi + 4 otázky porovnávajúce oba texty

ANALYTICKÉ TYPY ÚLOH:
- Grafy a tabuľky: číta sa z koláčového/stĺpcového grafu alebo tabuľky, výpočty percent/počtov
- Porovnávanie hodnôt: porovnaj výraz vľavo vs vpravo: (A) vľavo väčšie (B) vpravo väčšie (C) rovnaké (D) nedá sa určiť
- Postačujúce podmienky: otázka + tvrdenie (1) a (2), rozhodni či stačia na jednoznačnú odpoveď
- Slovné úlohy: matematické textové úlohy (rýchlosť, práca, percentá, pravdepodobnosť)
- Verbalizácia/matematizácia: preveď matematický vzťah na slovný popis alebo naopak
- Operácie a tajné operácie: definovaná operácia #, vypočítaj výsledok
- Zebry (logické úlohy): sada podmienok o osobách/predmetoch, odvodzuj čo platí

PRAVIDLÁ:
- Úlohy musia byť jednoznačné, s presne jednou správnou odpoveďou
- Odpovede sú vždy 4 možnosti (A, B, C, D) okrem antosynonymá kde A-D je synonymum, E-H je antonymum
- Texty musia byť relevantné a zaujímavé (veda, spoločnosť, história, médiá, ekonomika)
- Nepoužívaj triviálne ani príliš jednoduché výrazy
- Analytické úlohy musia byť matematicky korektné — skontroluj výpočty

Odpovedaj VÝHRADNE validným JSON v tomto formáte (žiadny iný text):
{
  "questions": [
    {
      "topic": "názov okruhu",
      "part": "verbal" alebo "analytical",
      "question": "text úlohy",
      "context": "voliteľný dlhší text pred otázkou (pre porozumenie textu, koherenciu atď.)",
      "options": ["možnosť A", "možnosť B", "možnosť C", "možnosť D"],
      "answer": 0,
      "explanation": "vysvetlenie prečo je táto odpoveď správna",
      "difficulty": "easy" alebo "medium" alebo "hard"
    }
  ]
}`;

// Parametre jedného Messages API volania (rovnaké pre priame aj dávkové volanie).
function buildRequestParams({ part, topic, difficulty, count }) {
  const topicInstruction = topic
    ? `Vygeneruj ${count} úloh typu: "${topic}"`
    : `Vygeneruj ${count} rôznych úloh z ${part === 'verbal' ? 'verbálnej' : 'analytickej'} časti testu`;

  const userPrompt = `${topicInstruction}.
Ťažkosť: ${difficulty} (${difficulty === 'easy' ? 'ľahká — väčšina účastníkov zodpovie správne' : difficulty === 'hard' ? 'ťažká — menej ako 40% zodpovie správne' : 'stredná — 40-70% zodpovie správne'}).
Časť testu: ${part}.
Vrát validný JSON podľa schémy.`;

  return {
    model: MODEL,
    max_tokens: 4000,
    // Bez premýšľania — rovnaké správanie ako doteraz na Sonnet 4.6,
    // žiadne platené tokeny navyše.
    thinking: { type: 'between_tools' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }]
  };
}

function anthropicHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  };
}

// Z textu odpovede vyberie platné úlohy (zvyšok zahodí). Vracia null, ak
// odpoveď nie je JSON.
function parseQuestions(text, { part, topic, difficulty }) {
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] || text);
  } catch {
    return null;
  }
  return (parsed.questions || [])
    .filter(q => {
      const validOptions = Array.isArray(q.options) && [4, 8].includes(q.options.length);
      return q.question && validOptions && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length;
    })
    .map(q => ({
      topic: topic || (TOPICS[part].includes(q.topic) ? q.topic : 'Všeobecné'),
      part,
      difficulty,
      question: q.question,
      context: q.context || null,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation || ''
    }));
}

async function insertIntoBank(questions) {
  const saved = [];
  for (const q of questions) {
    const result = await pool.query(
      `INSERT INTO bank_questions (topic, part, difficulty, question, context, options, answer, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [q.topic, q.part, q.difficulty, q.question, q.context, JSON.stringify(q.options), q.answer, q.explanation]
    );
    saved.push({ id: result.rows[0].id, ...q });
  }
  return saved;
}

module.exports = {
  ANTHROPIC_API, MODEL, TOPICS, DIFFICULTIES,
  buildRequestParams, anthropicHeaders, parseQuestions, insertIntoBank
};
