const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { requireAuth, requirePro } = require('../middleware/auth');
const {
  ANTHROPIC_API, TOPICS, DIFFICULTIES,
  buildRequestParams, anthropicHeaders, parseQuestions, insertIntoBank
} = require('../lib/questions');

// Strop nákladov: max. počet AI úloh na používateľa za 24 h.
const DAILY_AI_QUESTION_LIMIT = Number(process.env.DAILY_AI_QUESTION_LIMIT) || 50;
const RESULT_MODES = ['full', 'verbal', 'analytical', 'topic', 'ai'];

function toClient(q) {
  return {
    id: q.id, topic: q.topic, part: q.part, difficulty: q.difficulty,
    question: q.question, context: q.context || undefined,
    options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    answer: q.answer, explanation: q.explanation || '',
    isAI: true
  };
}

// POST /api/ai/generate
// Body: { part, topic, count, difficulty }
// Úlohy sa najprv berú zo zdieľanej banky (tie, ktoré používateľ ešte
// nevidel) — Claude sa volá len na počet, ktorý v banke chýba. Nové úlohy
// sa uložia do banky pre ďalších používateľov.
router.post('/generate', requireAuth, requirePro, async (req, res) => {
  const { part = 'verbal', topic, difficulty = 'medium' } = req.body;
  const count = Number(req.body.count ?? 5);

  if (!Number.isInteger(count) || count < 1 || count > 10) return res.status(400).json({ error: 'Počet úloh musí byť 1 až 10.' });
  if (!TOPICS[part]) return res.status(400).json({ error: 'Neplatná časť testu.' });
  if (topic && !TOPICS[part].includes(topic)) return res.status(400).json({ error: 'Neplatný typ úlohy.' });
  if (!DIFFICULTIES.includes(difficulty)) return res.status(400).json({ error: 'Neplatná obtiažnosť.' });

  try {
    const usage = await pool.query(
      `SELECT COUNT(*)::int AS n FROM user_bank_questions WHERE user_id = $1 AND served_at > NOW() - INTERVAL '24 hours'`,
      [req.user.id]
    );
    if (usage.rows[0].n + count > DAILY_AI_QUESTION_LIMIT) {
      return res.status(429).json({ error: `Denný limit ${DAILY_AI_QUESTION_LIMIT} AI úloh je vyčerpaný. Skús to zajtra.` });
    }

    const fromBank = (await pool.query(
      `SELECT b.* FROM bank_questions b
       WHERE b.part = $1 AND b.difficulty = $2 AND ($3::text IS NULL OR b.topic = $3)
         AND NOT EXISTS (SELECT 1 FROM user_bank_questions u WHERE u.user_id = $4 AND u.question_id = b.id)
       ORDER BY random() LIMIT $5`,
      [part, difficulty, topic || null, req.user.id, count]
    )).rows;

    let generated = [];
    const missing = count - fromBank.length;
    if (missing > 0) {
      const response = await fetch(`${ANTHROPIC_API}/messages`, {
        method: 'POST',
        headers: anthropicHeaders(),
        body: JSON.stringify(buildRequestParams({ part, topic, difficulty, count: missing }))
      });

      if (!response.ok) {
        console.error('Claude API error:', await response.text());
        if (!fromBank.length) return res.status(502).json({ error: 'Chyba pri komunikácii s AI.' });
      } else {
        const data = await response.json();
        const text = data.content?.find(b => b.type === 'text')?.text || '';
        const parsed = parseQuestions(text, { part, topic, difficulty });
        if (!parsed) console.error('JSON parse error:', text.substring(0, 500));
        else generated = await insertIntoBank(parsed);
      }
    }

    const questions = [...fromBank, ...generated];
    if (!questions.length) return res.status(502).json({ error: 'AI nevygenerovala žiadne úlohy.' });

    await pool.query(
      `INSERT INTO user_bank_questions (user_id, question_id)
       SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
      [req.user.id, questions.map(q => q.id)]
    );

    res.json({ questions: questions.map(toClient), generated: questions.length, fromBank: fromBank.length });

  } catch (e) {
    console.error('AI generate error:', e);
    res.status(500).json({ error: 'Neočakávaná chyba servera.' });
  }
});

// GET /api/ai/questions — úlohy z banky, ktoré už používateľ dostal
router.get('/questions', requireAuth, requirePro, async (req, res) => {
  const { part, topic, limit = 20 } = req.query;
  try {
    let query = `SELECT b.* FROM bank_questions b
      JOIN user_bank_questions u ON u.question_id = b.id
      WHERE u.user_id = $1`;
    const params = [req.user.id];
    if (part) { params.push(part); query += ` AND b.part = $${params.length}`; }
    if (topic) { params.push(topic); query += ` AND b.topic = $${params.length}`; }
    query += ` ORDER BY u.served_at DESC LIMIT $${params.length + 1}`;
    params.push(Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100));

    const result = await pool.query(query, params);
    res.json({ questions: result.rows.map(toClient) });
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
