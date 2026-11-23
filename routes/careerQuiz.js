const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
// Dynamický fallback na NAJNOVŠÍ dostupný model (nikdy na starší pevne
// zadaný) — rovnaký mechanizmus ako AI generátor úloh, pozri lib/resolveModel.js.
const { pickStartingModel, markModelGood, getNewestUntriedModel } = require('./lib/resolveModel');

// Verejný, neprihlásený endpoint (stránka /kam-na-vysoku používa Supabase
// auth na klientovi, nie backendový JWT z requireAuth) — vlastný rate limit
// namiesto middleware requireAuth, aby sa obmedzilo zneužitie nákladov na AI.
const analyzeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  message: { error: 'Príliš veľa požiadaviek. Skús to o chvíľu znova.' }
});

const FIELD_NAMES = {
  vsp: 'Všeobecné študijné predpoklady / spoločenské vedy',
  psych: 'Psychológia',
  law: 'Právo',
  medicina: 'Medicína a zdravotníctvo',
  technika: 'Technika, IT a prírodné vedy',
  pedagogika: 'Pedagogika a učiteľstvo',
  ekonomia: 'Ekonómia a manažment',
  humanitne: 'Humanitné a jazykové vedy',
  umenie: 'Umenie a dizajn'
};

const SYSTEM_PROMPT = `Si empatický a všímavý kariérny poradca pre stredoškolákov na Slovensku a v Česku, ktorí sa rozhodujú, na akú vysokú školu ísť.
Dostaneš výsledok krátkeho osobnostného testu (algoritmus už vyhodnotil, ktorá oblasť štúdia sedí najviac) a študentove vlastné odpovede na pár doplňujúcich otázok.
Tvoja úloha: napíš krátky, osobný odsek, ktorý sa priamo opiera o to, čo študent napísal vo svojich odpovediach — nie všeobecné frázy, ale konkrétne detaily z jeho textu.
Znej ako všímavý človek, nie ako šablóna. Buď povzbudzujúci, nikdy nehodnotiaci ani kritický. Ak odpovede pôsobia stroho alebo krátko, buď o to viac konkrétny s tým málom, čo máš.
Odpovedaj VÝHRADNE samotným odsekom (3-5 viet), žiadny nadpis, žiadny úvod, žiadne úvodzovky.`;

// POST /api/career-quiz/analyze
// Body: { topField, scores, reflections: [{question, answer}], lang }
router.post('/analyze', analyzeLimiter, async (req, res) => {
  const { topField, scores, reflections, lang } = req.body || {};

  if (typeof topField !== 'string' || !FIELD_NAMES[topField]) {
    return res.status(400).json({ error: 'Neplatné dáta.' });
  }
  if (!Array.isArray(reflections) || reflections.length === 0 || reflections.length > 5) {
    return res.status(400).json({ error: 'Neplatné dáta.' });
  }
  for (const r of reflections) {
    if (!r || typeof r.question !== 'string' || typeof r.answer !== 'string' || r.question.length > 400 || r.answer.length > 1200) {
      return res.status(400).json({ error: 'Neplatné dáta.' });
    }
  }
  const targetLang = lang === 'cs' ? 'cs' : 'sk';

  const reflectionText = reflections
    .map((r, i) => `${i + 1}. ${r.question}\nOdpoveď študenta: ${r.answer.trim() || '(nevyplnené)'}`)
    .join('\n\n');

  const userPrompt = `Algoritmus na základe testu záujmov vyhodnotil, že tomuto študentovi/študentke najviac sedí oblasť: ${FIELD_NAMES[topField]}.

Jeho/jej vlastné odpovede na doplňujúce otázky:
${reflectionText}

Napíš ten odsek v ${targetLang === 'cs' ? 'češtine' : 'slovenčine'}, podľa pravidiel v systémovom pokyne.`;

  try {
    let response;
    let triedModels = [];
    let model = pickStartingModel();
    for (let attempt = 0; attempt < 4; attempt++) {
      triedModels.push(model);
      response = await fetch(ANTHROPIC_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      if (response.ok) {
        markModelGood(model);
        if (attempt > 0) console.error(`⚠️ Claude model fallback (career-quiz): úspešne použitý novší model '${model}'.`);
        break;
      }
      const err = await response.text();
      const looksLikeModelIssue = response.status === 404 || /model/i.test(err);
      if (!looksLikeModelIssue) {
        console.error('Career quiz AI error:', err);
        return res.status(502).json({ error: 'Chyba pri komunikácii s AI.' });
      }
      const next = await getNewestUntriedModel(triedModels);
      if (!next) {
        console.error('Career quiz AI error:', err);
        return res.status(502).json({ error: 'Chyba pri komunikácii s AI.' });
      }
      console.error(`⚠️ Claude model '${model}' zlyhal (career-quiz), skúšam novší dostupný '${next}'.`);
      model = next;
    }

    const data = await response.json();
    const text = (data.content && data.content[0] && data.content[0].text || '').trim();
    if (!text) return res.status(502).json({ error: 'AI nevrátila text.' });

    res.json({ text });
  } catch (e) {
    console.error('Career quiz analyze error:', e);
    res.status(500).json({ error: 'Neočakávaná chyba servera.' });
  }
});

module.exports = router;
