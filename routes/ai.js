const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { requireAuth, requirePro } = require('../middleware/auth');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
// Skúša ďalší model len keď chyba vyzerá na problém s modelom (404 alebo
// zmienka "model" v chybe) — pozri poznámku pri jeho použití nižšie.
const MODEL_FALLBACK_CHAIN = ['claude-sonnet-5', 'claude-sonnet-4-6'];

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
  const { part = 'verbal', topic, count = 5, difficulty = 'medium' } = req.body;

  if (count > 10) return res.status(400).json({ error: 'Maximum 10 úloh naraz.' });

  const topicInstruction = topic
    ? `Vygeneruj ${count} úloh typu: "${topic}"`
    : `Vygeneruj ${count} rôznych úloh z ${part === 'verbal' ? 'verbálnej' : 'analytickej'} časti VSP`;

  const userPrompt = `${topicInstruction}.
Ťažkosť: ${difficulty} (${difficulty === 'easy' ? 'ľahká — väčšina účastníkov zodpovie správne' : difficulty === 'hard' ? 'ťažká — menej ako 40% zodpovie správne' : 'stredná — 40-70% zodpovie správne'}).
Časť testu: ${part}.
Vrát validný JSON podľa schémy.`;

  try {
    // Tichý fallback na iný model, ak Anthropic odmietne primárny (napr.
    // bol medzičasom deprecated) — inak by generátor prestal fungovať
    // okamžite a ticho pre všetkých Pro používateľov naraz.
    let response;
    for (let i = 0; i < MODEL_FALLBACK_CHAIN.length; i++) {
      const model = MODEL_FALLBACK_CHAIN[i];
      response = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 4000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      if (response.ok) {
        if (i > 0) console.error(`⚠️ Claude model fallback: '${MODEL_FALLBACK_CHAIN[0]}' zlyhal, použitý '${model}'.`);
        break;
      }
      const err = await response.text();
      const looksLikeModelIssue = response.status === 404 || /model/i.test(err);
      if (!looksLikeModelIssue || i === MODEL_FALLBACK_CHAIN.length - 1) {
        console.error('Claude API error:', err);
        return res.status(502).json({ error: 'Chyba pri komunikácii s AI.' });
      }
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
      if (!q.question || !q.options || q.answer === undefined) continue;
      const result = await pool.query(
        `INSERT INTO ai_questions (user_id, topic, part, question, options, answer, explanation, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          req.user.id,
          q.topic || topic || 'Všeobecné',
          q.part || part,
          q.question,
          JSON.stringify(q.options),
          q.answer,
          q.explanation || '',
          q.difficulty || difficulty
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
    params.push(Math.min(parseInt(limit), 100));

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
