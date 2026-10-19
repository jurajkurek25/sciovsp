const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { requireAuth, requirePro } = require('../middleware/auth');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
// Sonnet 5.5 — lacnejší ($2/$10 za 1M tokenov) aj novší ako Sonnet 4.6 ($3/$15).
const MODEL = 'claude-sonnet-5-5';

// Strop nákladov: max. počet AI úloh na používateľa za 24 h.
const DAILY_AI_QUESTION_LIMIT = Number(process.env.DAILY_AI_QUESTION_LIMIT) || 50;

// Povolené hodnoty — nič iné sa do promptu nedostane (ochrana pred prompt
// injection, t. j. zneužitím API kľúča na ľubovoľné iné texty).
const TOPICS = {
  verbal: ['Doplňovanie do viet', 'Vzťahy medzi slovami', 'Antosynonymá', 'Koherencia textov', 'Vyvodzovanie z krátkych textov', 'Porozumenie textu', 'Srovnávacie čítanie'],
  analytical: ['Grafy a tabuľky', 'Porovnávanie hodnôt', 'Postačujúce podmienky', 'Slovné úlohy', 'Verbalizácia, matematizácia', 'Operácie a tajné operácie', 'Zebry (logické úlohy)']
};
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const RESULT_MODES = ['full', 'verbal', 'analytical', 'topic', 'ai'];

// Systémový prompt — znalosť štruktúry SCIO VSP testov
const SYSTEM_PROMPT = `Si odborník na tvorbu úloh pre slovenské SCIO Všeobecné študijné predpoklady (VSP/VŠP) testy.
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

// POST /api/ai/generate
// Body: { part, topic, count, difficulty }
router.post('/generate', requireAuth, requirePro, async (req, res) => {
  const { part = 'verbal', topic, difficulty = 'medium' } = req.body;
  const count = Number(req.body.count ?? 5);

  if (!Number.isInteger(count) || count < 1 || count > 10) return res.status(400).json({ error: 'Počet úloh musí byť 1 až 10.' });
  if (!TOPICS[part]) return res.status(400).json({ error: 'Neplatná časť testu.' });
  if (topic && !TOPICS[part].includes(topic)) return res.status(400).json({ error: 'Neplatný typ úlohy.' });
  if (!DIFFICULTIES.includes(difficulty)) return res.status(400).json({ error: 'Neplatná obtiažnosť.' });


  const topicInstruction = topic
    ? `Vygeneruj ${count} úloh typu: "${topic}"`
    : `Vygeneruj ${count} rôznych úloh z ${part === 'verbal' ? 'verbálnej' : 'analytickej'} časti VSP`;

  const userPrompt = `${topicInstruction}.
Ťažkosť: ${difficulty} (${difficulty === 'easy' ? 'ľahká — väčšina účastníkov zodpovie správne' : difficulty === 'hard' ? 'ťažká — menej ako 40% zodpovie správne' : 'stredná — 40-70% zodpovie správne'}).
Časť testu: ${part}.
Vrát validný JSON podľa schémy.`;

  try {
    const usage = await pool.query(
      `SELECT COUNT(*)::int AS n FROM ai_questions WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );
    if (usage.rows[0].n + count > DAILY_AI_QUESTION_LIMIT) {
      return res.status(429).json({ error: `Denný limit ${DAILY_AI_QUESTION_LIMIT} AI úloh je vyčerpaný. Skús to zajtra.` });
    }

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        // Bez premýšľania — rovnaké správanie ako doteraz na Sonnet 4.6,
        // žiadne platené tokeny navyše.
        thinking: { type: 'between_tools' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return res.status(502).json({ error: 'Chyba pri komunikácii s AI.' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parsuj JSON z odpovede
    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch?.[0] || text);
    } catch (e) {
      console.error('JSON parse error:', text.substring(0, 500));
      return res.status(502).json({ error: 'AI vygenerovala neplatný formát.' });
    }

    const questions = parsed.questions || [];
    if (questions.length === 0) {
      return res.status(502).json({ error: 'AI nevygenerovala žiadne úlohy.' });
    }

    // Ulož do databázy
    const saved = [];
    for (const q of questions) {
      const validOptions = Array.isArray(q.options) && [4, 8].includes(q.options.length);
      if (!q.question || !validOptions || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) continue;
      const result = await pool.query(
        `INSERT INTO ai_questions (user_id, topic, part, question, options, answer, explanation, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          req.user.id,
          topic || (TOPICS[part].includes(q.topic) ? q.topic : 'Všeobecné'),
          part,
          q.question,
          JSON.stringify(q.options),
          q.answer,
          q.explanation || '',
          difficulty
        ]
      );
      saved.push({
        id: result.rows[0].id,
        ...q,
        isAI: true
      });
    }

    res.json({ questions: saved, generated: saved.length });

  } catch (e) {
    console.error('AI generate error:', e);
    res.status(500).json({ error: 'Neočakávaná chyba servera.' });
  }
});

// GET /api/ai/questions — načítaj uložené AI úlohy
router.get('/questions', requireAuth, requirePro, async (req, res) => {
  const { part, topic, limit = 20 } = req.query;
  try {
    let query = 'SELECT * FROM ai_questions WHERE user_id = $1';
    const params = [req.user.id];
    if (part) { params.push(part); query += ` AND part = $${params.length}`; }
    if (topic) { params.push(topic); query += ` AND topic = $${params.length}`; }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100));

    const result = await pool.query(query, params);
    res.json({
      questions: result.rows.map(q => ({
        ...q,
        options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
        isAI: true
      }))
    });
  } catch (e) {
    res.status(500).json({ error: 'Chyba databázy.' });
  }
});

// POST /api/ai/save-result — ulož výsledok testu
router.post('/save-result', requireAuth, async (req, res) => {
  const { mode, score, correct, wrong, skipped, verbalPct, analytPct, estPct, durationS, answers } = req.body;
  const ints = [correct, wrong, skipped, verbalPct, analytPct, estPct, durationS];
  if (!RESULT_MODES.includes(mode)) return res.status(400).json({ error: 'Neplatný režim testu.' });
  if (ints.some(v => v != null && (!Number.isInteger(v) || v < 0 || v > 100000))) return res.status(400).json({ error: 'Neplatné hodnoty výsledku.' });
  if (score != null && (typeof score !== 'number' || !Number.isFinite(score))) return res.status(400).json({ error: 'Neplatné skóre.' });
  if (JSON.stringify(answers ?? null).length > 20000) return res.status(400).json({ error: 'Príliš veľa odpovedí.' });
  try {
    await pool.query(
      `INSERT INTO test_results (user_id, mode, score, correct, wrong, skipped, verbal_pct, analyt_pct, est_pct, duration_s, answers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [req.user.id, mode, score, correct, wrong, skipped, verbalPct, analytPct, estPct, durationS, JSON.stringify(answers)]
    );
    res.json({ saved: true });
  } catch (e) {
    res.status(500).json({ error: 'Chyba pri ukladaní.' });
  }
});

// GET /api/ai/history — história testov z DB
router.get('/history', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM test_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ results: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'Chyba databázy.' });
  }
});

module.exports = router;
