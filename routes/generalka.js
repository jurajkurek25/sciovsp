// SP Generálka — jednorázový produkt (5,90 €): jeden nákup = jeden
// AI-generovaný kompletný VŠP test (66 úloh) s podrobným trackovaním
// priebehu (zmeny odpovedí, čas na úlohu, fullscreen/tab-switch udalosti,
// súhrn z webkamery) a AI analýzou výsledku po odovzdaní. Nákup/webhook
// žije priamo v server.js (rovnaký vzor ako course_purchase/
// membership_purchase) — tento súbor rieši len samotný priebeh pokusu.
//
// module.exports je funkcia, ktorú voláš ako require('./routes/generalka')(app)
// — MUSÍ byť registrovaná AŽ ZA app.use(express.json(...)) v server.js,
// inak by JSON telá POST requestov neboli naparsované (pozri
// main-app-patches/122 — presne tento bug postihol routes/community.js).
'use strict';

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { pickStartingModel, markModelGood, getNewestUntriedModel, tierOf } = require('./lib/resolveModel');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_CENTS = 590;
const VERBAL_COUNT = 33;
const ANALYT_COUNT = 33;
const MAX_EVENTS = 5000;

async function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function callClaudeText(prompt, maxTokens) {
  let response;
  const triedModels = [];
  let model = pickStartingModel();
  for (let attempt = 0; attempt < 4; attempt++) {
    triedModels.push(model);
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
    });
    if (response.ok) { markModelGood(model); break; }
    const errText = await response.text();
    const looksLikeModelIssue = response.status === 404 || /model/i.test(errText);
    if (!looksLikeModelIssue) throw new Error('AI volanie zlyhalo: ' + errText.slice(0, 200));
    const next = await getNewestUntriedModel(triedModels, tierOf(model));
    if (!next) throw new Error('AI volanie zlyhalo: ' + errText.slice(0, 200));
    model = next;
  }
  const data = await response.json();
  if (data.stop_reason === 'max_tokens') {
    console.error('generalka callClaudeText: odpoveď orezaná na max_tokens=' + maxTokens);
  }
  return (data.content || []).map(b => b.text || '').join('').trim();
}

const VERBAL_TOPICS = ['Doplňovanie do viet', 'Vzťahy medzi slovami (analógie)', 'Antosynonymá', 'Koherencia textov', 'Vyvodzovanie z krátkych textov', 'Porozumenie textu', 'Porovnávacie čítanie'];
const ANALYT_TOPICS = ['Grafy a tabuľky', 'Porovnávanie hodnôt', 'Postačujúce podmienky', 'Slovné úlohy', 'Verbalizácia/matematizácia', 'Operácie a tajné operácie', 'Zebry (logické úlohy)'];

function buildGenerationPrompt(part, count) {
  const topics = part === 'verbal' ? VERBAL_TOPICS : ANALYT_TOPICS;
  return `Si odborník na tvorbu úloh pre slovenské SCIO Všeobecné študijné predpoklady (VŠP) testy. Vygeneruj presne ${count} ${part === 'verbal' ? 'VERBÁLNYCH' : 'ANALYTICKÝCH'} úloh, rovnomerne rozložených medzi tieto typy: ${topics.join(', ')}.

PRAVIDLÁ:
- Úlohy musia byť jednoznačné, s presne jednou správnou odpoveďou.
- Odpovede sú 4 možnosti (A,B,C,D), okrem antosynoným kde je 8 (A-D synonymum, E-H antonymum).
- Analytické úlohy musia byť matematicky korektné — skontroluj výpočty.
- Každá úloha musí byť úplne nová a jedinečná (toto je platený test naostro, nesmie sa opakovať).

- "explanation" drž stručné, max 1-2 vety.

Odpovedaj VÝHRADNE validným JSON, žiadny iný text:
{"questions":[{"topic":"názov okruhu","text":"text úlohy","context":"voliteľný dlhší text pred otázkou alebo null","options":["A","B","C","D"],"answer":0,"explanation":"stručné vysvetlenie prečo je táto odpoveď správna"}]}
Pole "questions" musí mať presne ${count} prvkov.`;
}

// Jeden veľký request na 33 úloh sa aj pri max_tokens=16000 opakovane
// orezával uprostred JSONu (viď main-app-patches história) — namiesto
// naháňania limitu radšej rozdelíme na menšie dávky po CHUNK_SIZE úloh,
// bežiace paralelne. Každá dávka potrebuje výrazne menej tokenov, takže
// orezanie je oveľa menej pravdepodobné, a aj keby jedna dávka zlyhala,
// nestráca sa celých 33 úloh naraz.
const CHUNK_SIZE = 11;
const STARTER_CHUNK_SIZE = 4;

async function generateChunkOnce(part, count) {
  const text = await callClaudeText(buildGenerationPrompt(part, count), 8000);
  const match = text.match(/\{[\s\S]*\}/);
  let parsed;
  try {
    parsed = JSON.parse(match ? match[0] : text);
  } catch (e) {
    console.error('generalka generateChunk(' + part + ',' + count + ') neplatny JSON, koniec odpovede:', text.slice(-300));
    throw new Error('AI vrátilo neplatný JSON pri generovaní testu.');
  }
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== count) {
    throw new Error('AI vrátilo nesprávny počet úloh (' + (parsed.questions && parsed.questions.length) + ' namiesto ' + count + ').');
  }
  return parsed.questions.map(q => ({ ...q, part }));
}

// Claude občas vráti nevalidný/neúplný JSON — pred vzdaním sa to raz
// zopakujeme (nový request, čistá šanca), až potom to hodíme ako chybu.
async function generateChunk(part, count) {
  try {
    return await generateChunkOnce(part, count);
  } catch (e) {
    console.error('generalka generateChunk(' + part + ',' + count + ') zlyhalo, skusam znova:', e.message);
    return await generateChunkOnce(part, count);
  }
}

async function generateBatch(part, totalCount) {
  const chunkSizes = [];
  let remaining = totalCount;
  while (remaining > 0) {
    const size = Math.min(CHUNK_SIZE, remaining);
    chunkSizes.push(size);
    remaining -= size;
  }
  const chunks = await Promise.all(chunkSizes.map(size => generateChunk(part, size)));
  return chunks.flat();
}

// Dopĺňanie zvyšných otázok na pozadí, kým študent už odpovedá na tie prvé.
// Všetky dávky danej časti bežia PARALELNE (nie za sebou) — po dokončení
// každej sa priebežne uloží do DB, takže klient si ich vie dotiahnuť cez
// GET .../questions čo najskôr.
async function generateRemaining(token, part, remainingCount, questionsSoFar) {
  const chunkSizes = [];
  let remaining = remainingCount;
  while (remaining > 0) {
    const size = Math.min(CHUNK_SIZE, remaining);
    chunkSizes.push(size);
    remaining -= size;
  }
  let all = questionsSoFar;
  await Promise.all(chunkSizes.map(async (size) => {
    try {
      const chunk = await generateChunk(part, size);
      all = all.concat(chunk);
      await supabase.from('generalka_attempts').update({ questions: all }).eq('attempt_token', token);
    } catch (e) {
      console.error('generalka generateRemaining(' + part + ') davka zlyhala:', e.message);
    }
  }));
  return all;
}

async function generateInBackground(token, questionsSoFar) {
  try {
    let all = questionsSoFar;
    const verbalCount = all.filter(q => q.part === 'verbal').length;
    if (verbalCount < VERBAL_COUNT) {
      all = await generateRemaining(token, 'verbal', VERBAL_COUNT - verbalCount, all);
    }
    const analytCount = all.filter(q => q.part === 'analytical').length;
    if (analytCount < ANALYT_COUNT) {
      all = await generateRemaining(token, 'analytical', ANALYT_COUNT - analytCount, all);
    }
  } catch (e) {
    console.error('generalka generateInBackground fatal error:', e.message);
  }
}

// Pred odovzdaním nesmie klient dostať správne odpovede ani vysvetlenia —
// inak by si ich vedel pozrieť v Network tabe ešte počas testu.
function stripAnswers(questions) {
  return (questions || []).map(q => {
    const { answer, explanation, ...rest } = q;
    return rest;
  });
}

function scoreAttempt(questions, answers) {
  let correct = 0, wrong = 0, skipped = 0;
  let verbalCorrect = 0, verbalTotal = 0, analytCorrect = 0, analytTotal = 0;
  (questions || []).forEach((q, idx) => {
    const isVerbal = q.part === 'verbal';
    if (isVerbal) verbalTotal++; else analytTotal++;
    const given = answers[idx];
    if (given == null) { skipped++; return; }
    if (given === q.answer) {
      correct++;
      if (isVerbal) verbalCorrect++; else analytCorrect++;
    } else {
      wrong++;
    }
  });
  const verbalPct = verbalTotal ? Math.round((verbalCorrect / verbalTotal) * 100) : 0;
  const analytPct = analytTotal ? Math.round((analytCorrect / analytTotal) * 100) : 0;
  const estPct = Math.round((verbalPct + analytPct) / 2);
  const total = (questions || []).length;
  const score = total ? Math.round((correct / total) * 10000) / 100 : 0;
  return { correct, wrong, skipped, verbalPct, analytPct, estPct, score };
}

async function generateAnalysis({ questions, events, correct, wrong, skipped, durationS, verbalPct, analytPct, estPct, anticheatFlags }) {
  const answerChanges = (events || []).filter(e => e.type === 'answer_change').length;
  const fullscreenExits = (anticheatFlags && anticheatFlags.fullscreenExits) || 0;
  const tabSwitches = (anticheatFlags && anticheatFlags.tabSwitches) || 0;
  const total = (questions || []).length || 66;
  const prompt = `Si skúsený konzultant pre prípravu na VŠP prijímacie testy. Analyzuj priebeh testu SP Generálka pre jedného študenta a napíš stručnú, konkrétnu, ľudskú analýzu v slovenčine (max 300 slov):
1. Zhodnoť pravdepodobný výsledok na ostrom teste (percentil, silné/slabé okruhy — verbálny odhad ${verbalPct}%, analytický odhad ${analytPct}%, celkový odhad ${estPct}%).
2. Upozorni na vzorce správania — ${answerChanges} zmien odpovede počas testu, celkový čas ${durationS ? Math.round(durationS / 60) + ' minút' : 'neznámy'}, či boli úlohy preskočené pod tlakom času (${skipped} preskočených z ${total}).
3. Ak boli zaznamenané prerušenia pozornosti (opustenie fullscreen ${fullscreenExits}×, prepnutie okna/aplikácie ${tabSwitches}×), stručne to spomeň ako možný faktor výkonu — bez moralizovania.
4. Daj 2-3 konkrétne odporúčania, na čo sa zamerať pred ostrým testom.

Skóre: ${correct} správne, ${wrong} nesprávne, ${skipped} preskočené (z ${total} úloh).

Píš priamo študentovi, v druhej osobe, povzbudivo ale úprimne. Obyčajný text, žiadny JSON, žiadne nadpisy s #.`;
  return await callClaudeText(prompt, 1000);
}

module.exports = function registerGeneralka(app) {
  // POST /api/generalka/checkout — nová platba (5,90 €, jeden pokus).
  app.post('/api/generalka/checkout', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený cez Google.' });
    const email = (user.email || '').toString().trim().toLowerCase();
    try {
      let customerId;
      const { data: existingUser } = await supabase.from('users').select('stripe_customer_id').eq('email', email).maybeSingle();
      if (existingUser?.stripe_customer_id) {
        customerId = existingUser.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ email });
        customerId = customer.id;
        await supabase.from('users').upsert({ email, stripe_customer_id: customerId });
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{ price_data: { currency: 'eur', unit_amount: PRICE_CENTS, product_data: { name: 'SP Generálka — kompletný AI test naostro' } }, quantity: 1 }],
        success_url: 'https://sptrener.online/generalka?paid=1',
        cancel_url: 'https://sptrener.online/generalka?cancelled=1',
        allow_promotion_codes: true,
        locale: 'sk',
        metadata: { type: 'generalka_purchase', email }
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error('generalka checkout error:', e.message);
      res.status(500).json({ error: 'Chyba pri vytváraní platby.' });
    }
  });

  // GET /api/generalka/my-latest-attempt — pre návrat zo Stripe checkoutu
  // (success_url nemá token, ten vzniká až vo webhooku asynchrónne).
  app.get('/api/generalka/my-latest-attempt', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    try {
      const email = (user.email || '').toString().trim().toLowerCase();
      const { data: attempt } = await supabase.from('generalka_attempts').select('attempt_token').eq('email', email).order('paid_at', { ascending: false }).limit(1).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Zatiaľ žiadny pokus.' });
      res.json({ token: attempt.attempt_token });
    } catch (e) {
      console.error('generalka my-latest-attempt error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/generalka/attempt/:token — stav pokusu.
  app.get('/api/generalka/attempt/:token', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    try {
      const { data: attempt } = await supabase.from('generalka_attempts').select('status, email, started_at, completed_at').eq('attempt_token', req.params.token).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Pokus sa nenašiel.' });
      if (attempt.email !== (user.email || '').toString().trim().toLowerCase()) return res.status(403).json({ error: 'Tento pokus nepatrí tvojmu účtu.' });
      res.json({ status: attempt.status, startedAt: attempt.started_at, completedAt: attempt.completed_at });
    } catch (e) {
      console.error('generalka attempt status error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/generalka/attempt/:token/start — vygeneruje test a spustí pokus.
  app.post('/api/generalka/attempt/:token/start', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    try {
      const { data: attempt } = await supabase.from('generalka_attempts').select('*').eq('attempt_token', req.params.token).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Pokus sa nenašiel.' });
      if (attempt.email !== (user.email || '').toString().trim().toLowerCase()) return res.status(403).json({ error: 'Tento pokus nepatrí tvojmu účtu.' });
      if (attempt.status !== 'paid') {
        if (attempt.questions) return res.json({ status: attempt.status, questions: stripAnswers(attempt.questions), totalExpected: VERBAL_COUNT + ANALYT_COUNT });
        return res.status(400).json({ error: 'Tento pokus už bol spustený alebo dokončený.' });
      }
      const starter = await generateChunk('verbal', STARTER_CHUNK_SIZE);
      await supabase.from('generalka_attempts').update({ status: 'in_progress', questions: starter, started_at: new Date().toISOString() }).eq('attempt_token', req.params.token);
      res.json({ status: 'in_progress', questions: stripAnswers(starter), totalExpected: VERBAL_COUNT + ANALYT_COUNT });
      // Fire-and-forget: zvyšné otázky sa dopĺňajú na pozadí, kým študent už
      // odpovedá na tie prvé — klient si ich priebežne dotiahne cez polling.
      generateInBackground(req.params.token, starter);
    } catch (e) {
      console.error('generalka start error:', e.message);
      res.status(500).json({ error: e.message || 'Chyba pri generovaní testu.' });
    }
  });

  // GET /api/generalka/attempt/:token/questions — polling na dotiahnutie
  // otázok, ktoré medzitým dogenerovalo pozadie po /start.
  app.get('/api/generalka/attempt/:token/questions', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    try {
      const { data: attempt } = await supabase.from('generalka_attempts').select('email, questions').eq('attempt_token', req.params.token).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Pokus sa nenašiel.' });
      if (attempt.email !== (user.email || '').toString().trim().toLowerCase()) return res.status(403).json({ error: 'Tento pokus nepatrí tvojmu účtu.' });
      res.json({ questions: stripAnswers(attempt.questions || []), totalExpected: VERBAL_COUNT + ANALYT_COUNT });
    } catch (e) {
      console.error('generalka questions poll error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/generalka/attempt/:token/event — priebežné trackovanie
  // (výber/zmena odpovede, fullscreen-exit, tab-switch, webcam vzorka...).
  app.post('/api/generalka/attempt/:token/event', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    const event = req.body?.event;
    if (!event || typeof event !== 'object') return res.status(400).json({ error: 'Neplatná udalosť.' });
    try {
      const { data: attempt } = await supabase.from('generalka_attempts').select('email, status, events').eq('attempt_token', req.params.token).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Pokus sa nenašiel.' });
      if (attempt.email !== (user.email || '').toString().trim().toLowerCase()) return res.status(403).json({ error: 'Tento pokus nepatrí tvojmu účtu.' });
      if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Pokus nie je aktívny.' });
      const events = Array.isArray(attempt.events) ? attempt.events : [];
      events.push({ ...event, serverTs: new Date().toISOString() });
      if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
      await supabase.from('generalka_attempts').update({ events }).eq('attempt_token', req.params.token);
      res.json({ ok: true });
    } catch (e) {
      console.error('generalka event error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/generalka/attempt/:token/submit — vyhodnotí a spustí AI analýzu.
  app.post('/api/generalka/attempt/:token/submit', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
    const durationS = parseInt(req.body?.durationS, 10) || null;
    const webcamSummary = req.body?.webcamSummary || null;
    const anticheatFlags = req.body?.anticheatFlags || null;
    try {
      const { data: attempt } = await supabase.from('generalka_attempts').select('*').eq('attempt_token', req.params.token).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Pokus sa nenašiel.' });
      if (attempt.email !== (user.email || '').toString().trim().toLowerCase()) return res.status(403).json({ error: 'Tento pokus nepatrí tvojmu účtu.' });
      if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Pokus nie je možné odovzdať (už bol dokončený alebo nebol spustený).' });
      const { correct, wrong, skipped, verbalPct, analytPct, estPct, score } = scoreAttempt(attempt.questions, answers);
      let aiAnalysis = null;
      try {
        aiAnalysis = await generateAnalysis({ questions: attempt.questions, events: attempt.events, correct, wrong, skipped, durationS, verbalPct, analytPct, estPct, anticheatFlags });
      } catch (e) {
        console.error('generalka analysis error:', e.message);
      }
      await supabase.from('generalka_attempts').update({
        status: 'completed', answers, score, correct, wrong, skipped,
        verbal_pct: verbalPct, analyt_pct: analytPct, est_pct: estPct,
        duration_s: durationS, webcam_summary: webcamSummary, anticheat_flags: anticheatFlags,
        ai_analysis: aiAnalysis, completed_at: new Date().toISOString()
      }).eq('attempt_token', req.params.token);
      res.json({ ok: true, score, correct, wrong, skipped, verbalPct, analytPct, estPct, aiAnalysis });
    } catch (e) {
      console.error('generalka submit error:', e.message);
      res.status(500).json({ error: 'Chyba pri odovzdávaní testu.' });
    }
  });

  // GET /api/generalka/attempt/:token/report — plný report po dokončení.
  app.get('/api/generalka/attempt/:token/report', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený.' });
    try {
      const { data: attempt } = await supabase.from('generalka_attempts').select('*').eq('attempt_token', req.params.token).maybeSingle();
      if (!attempt) return res.status(404).json({ error: 'Pokus sa nenašiel.' });
      if (attempt.email !== (user.email || '').toString().trim().toLowerCase()) return res.status(403).json({ error: 'Tento pokus nepatrí tvojmu účtu.' });
      if (attempt.status !== 'completed') return res.status(400).json({ error: 'Test ešte nebol dokončený.' });
      res.json({
        questions: attempt.questions, answers: attempt.answers,
        score: attempt.score, correct: attempt.correct, wrong: attempt.wrong, skipped: attempt.skipped,
        verbalPct: attempt.verbal_pct, analytPct: attempt.analyt_pct, estPct: attempt.est_pct,
        durationS: attempt.duration_s, aiAnalysis: attempt.ai_analysis,
        anticheatFlags: attempt.anticheat_flags, webcamSummary: attempt.webcam_summary
      });
    } catch (e) {
      console.error('generalka report error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
};
