// Autonómny AI ops runner — naprieč appkami, ale s pevne daným whitelistom
// akcií, ktoré smie vykonať sám, a KAŽDÁ akcia sa loguje do
// dash_ai_actions_log (action_type, reasoning, result, detail), nech
// dopadne akokoľvek. Nič mimo whitelistu sa nevykoná.
//
// Platby: aiops smie automaticky vygenerovať PAY by square QR pre výber,
// ktorý sám vyhodnotí ako "pripravený na vyplatenie" (payout_qr_prepared),
// ale NIKDY ho neoznačí za vyplatený — to vyžaduje, aby Juraj sám naskenoval
// QR vo svojej bankovej appke a potvrdil prevod, a potom ručne klikol
// "označiť ako vyplatené" v UI. Žiadny kód tu nemá prístup k bankovému účtu.
const express = require('express');
const router = express.Router();
const { requireDashAuth, timingSafeEqualStr } = require('../lib/auth');
const { supabase } = require('../lib/db-partner');
const { supabase: mainDb } = require('../lib/db-main');
const { callClaude } = require('../lib/claude');

const AUTO_PUBLISH_BLOG = process.env.DASH_AUTO_PUBLISH_BLOG !== 'false'; // default true — user explicitly asked for automatic publisher
// Kill switch: AI blog generátor (web_search + generovanie) stál neúmerne veľa
// pri každom behu (až 5 web_search volaní + 4000 tokenov generovania), preto
// je teraz OFF by default. Nastav DASH_AIOPS_BLOG_ENABLED=true v .env ak ho
// niekedy chceš znova zapnúť.
const AIOPS_BLOG_ENABLED = process.env.DASH_AIOPS_BLOG_ENABLED === 'true';
const PAYOUT_READY_THRESHOLD_EUR = Number(process.env.DASH_PAYOUT_READY_THRESHOLD_EUR) || 20;
const DASH_CRON_KEY = process.env.DASH_CRON_KEY;

// Samostatný kľúč pre externý cron (nie session cookie) — rovnaký vzor ako
// x-admin-key v ad-subdomain-service/automation.js. Bez DASH_CRON_KEY
// nastaveného v .env je tento endpoint natrvalo zamknutý.
function checkCronKey(req) {
  const key = req.headers['x-cron-key'];
  if (!key || !DASH_CRON_KEY) return false;
  return timingSafeEqualStr(key, DASH_CRON_KEY);
}

async function logAction({ actionType, targetSystem, targetId, reasoning, result, detail }) {
  try {
    await supabase.from('dash_ai_actions_log').insert({
      action_type: actionType, target_system: targetSystem, target_id: targetId ? String(targetId) : null,
      reasoning, result, detail: detail || null
    });
  } catch {
    // logovanie AI akcie nesmie zhodiť samotnú akciu
  }
}

// Poistka proti presne tomu, čo sa reálne stalo: appka failovala 10x za
// sebou po dobu týždňa, každý pokus stál peniaze, a nikto si to nevšimol,
// kým sa minul kredit. Po 2 zlyhaniach v rade sa ďalšie behy PRESKOČIA
// (žiadne Claude volanie, žiadny náklad) až kým niekto ručne nespustí
// úspešný beh cez "Spustiť teraz" v dashboarde — úspech počítadlo vynuluje.
const FAILURE_STREAK_KEY = 'aiops_blog_failure_streak';
const FAILURE_STREAK_LIMIT = 2;

async function getFailureStreak() {
  try {
    const { data } = await mainDb.from('app_settings').select('value').eq('key', FAILURE_STREAK_KEY).maybeSingle();
    const n = data ? Number(data.value) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

async function setFailureStreak(n) {
  try {
    await mainDb.from('app_settings').upsert(
      { key: FAILURE_STREAK_KEY, value: n, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch {
    // ak sa počítadlo nepodarí zapísať, ďalší beh jednoducho skúsi znova — bezpečné zlyhanie
  }
}

// AI modely majú tendenciu zabaliť finálny JSON do ```json ... ``` code
// fence napriek inštrukcii v prompte, aby to nerobili — skús fence najprv,
// až potom padni na pôvodný "prvá { po poslednú }" regex.
function extractJson(raw) {
  const fenced = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenced) return fenced[1];
  const bare = raw.match(/\{[\s\S]*\}/);
  return bare ? bare[0] : null;
}

async function runBlogTrendPublisher() {
  if (!AIOPS_BLOG_ENABLED) {
    return { ok: false, error: 'Disabled (DASH_AIOPS_BLOG_ENABLED is not "true") — no Claude call made, no cost incurred.' };
  }
  const streak = await getFailureStreak();
  if (streak >= FAILURE_STREAK_LIMIT) {
    await logAction({
      actionType: 'blog_draft_published', targetSystem: 'main',
      reasoning: `Preskočené — ${streak} zlyhaní za sebou. Spusti ručne cez "Spustiť teraz", nech sa overí, že to funguje, potom sa počítadlo vynuluje.`,
      result: 'failed', detail: { skipped: true, failureStreak: streak }
    });
    return { ok: false, error: `Skipped — ${streak} consecutive failures, no Claude call made.` };
  }
  try {
    const { data: allTagged, error: tagErr } = await mainDb.from('blog_posts').select('tag, created_at').not('tag', 'is', null).limit(2000);
    if (tagErr) throw new Error(tagErr.message);
    const byTag = {};
    for (const row of allTagged || []) {
      const t = byTag[row.tag] || { tag: row.tag, n: 0, last_at: null };
      t.n += 1;
      if (!t.last_at || row.created_at > t.last_at) t.last_at = row.created_at;
      byTag[row.tag] = t;
    }
    const tagRows = Object.values(byTag).sort((a, b) => (a.last_at || '').localeCompare(b.last_at || '')).slice(0, 8);

    const { data: recentTitles, error: titlesErr } = await mainDb.from('blog_posts')
      .select('title, tag').order('created_at', { ascending: false }).limit(12);
    if (titlesErr) throw new Error(titlesErr.message);

    const system = `Si obsahový editor blogu SP Tréner (príprava na VŠP/SCIO prijímacie testy pre SR/ČR stredoškolákov, ktorí zvažujú kúpu prípravného kurzu). Tvoja úloha: zisti, čo si potenciálni zákazníci (uchádzači a ich rodičia) AKTUÁLNE vyhľadávajú na internete ohľadom prijímačiek na vysoké školy, VŠP, SCIO testov, prijímacieho konania — a na základe toho navrhni a napíš JEDEN nový blogový článok, ktorý na to reálne odpovedá.

Postup:
1. Použi web_search na zistenie aktuálnych vyhľadávaní/otázok/trendov okolo VŠP, SCIO testov, prijímačiek na VŠ v SR/ČR (termíny, zmeny formátu, časté otázky uchádzačov, diskusie na fórach a Redditoch). Urob aspoň 2-3 vyhľadávania s rôznymi dopytmi.
2. Zváž aj interné dáta: tagy, ktoré sa na blogu dlho nepokrývali: ${JSON.stringify(tagRows)}
3. Neopakuj témy nedávnych článkov: ${JSON.stringify(recentTitles)}
4. Vyber tému, ktorá reálne rieši niečo, čo ľudia teraz vyhľadávajú (nie hocijakú z dlho-nepokrytých tagov, ak po nej nie je dopyt). Titulok aj prvý odsek nech prirodzene obsahujú hlavné kľúčové slovo/frázu, ktorú si zistil vo vyhľadávaní.

SEO pravidlá pre výstup (rovnaká appka to zobrazuje na sptrener.online/blog/:slug a k titulku pripája " — SP Tréner", preto:):
- "title": max 55 znakov, obsahuje hlavné kľúčové slovo, žiadne clickbait bez obsahu
- "excerpt": presne 140-160 znakov, funguje aj ako meta description — zhrň konkrétny prínos článku, nie všeobecnú frázu
- "content": HTML, 600-900 slov, štruktúrované do 3+ sekcií pomocou <h2>...</h2> medzititulkov (nie jeden blok textu), odseky v <p>, zoznamy v <ul><li> kde sa hodia, žiadne <html>/<body>/<script>/inline styly
- niekde v "content" prirodzene vlož JEDEN interný odkaz na <a href="https://sptrener.online/?openPremium=1">appku SP Tréner</a> tam, kde to dáva kontextový zmysel (nie ako vnucená reklama)

Na konci — a IBA na konci, po dokončení vyhľadávania — odpovedz POSLEDNÝM textovým blokom, ktorý obsahuje IBA validný JSON objekt a nič iné (žiadny komentár pred ani za ním), v tvare:
{"title":"...", "slug":"kebab-case-slug-bez-diakritiky", "excerpt":"...", "content":"...", "tag":"jeden z existujúcich alebo nový vhodný tag", "readTime":"X min čítania", "trendReason":"1 veta - aký konkrétny vyhľadávací trend/otázku článok rieši"}`;

    // claude-haiku-4-5 namiesto claude-sonnet-5 (pôvodný default) — 3x
    // lacnejší per-token a pre "napíš SEO článok podľa tejto témy" úlohu
    // viac než dostatočný. Spolu s 1 web_search (namiesto 5) a nižším
    // maxTokens (900-slovný článok reálne potrebuje ~1800, nie 4000) ide
    // odhadovaný náklad na beh z desiatok centov na ~1-2 centy.
    const raw = await callClaude({
      system,
      messages: [{ role: 'user', content: 'Zisti aktuálne trendy vo vyhľadávaní a navrhni článok.' }],
      model: 'claude-haiku-4-5',
      maxTokens: 1800,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 1 }]
    });
    const jsonStr = extractJson(raw);
    if (!jsonStr) throw new Error('AI nevrátila platný JSON.');
    const draft = JSON.parse(jsonStr);
    if (!draft.title || !draft.slug || !draft.content) throw new Error('AI návrh chýba povinné polia.');

    const { data: existing, error: existingErr } = await mainDb.from('blog_posts').select('id').eq('slug', draft.slug);
    if (existingErr) throw new Error(existingErr.message);
    const slug = (existing || []).length ? `${draft.slug}-${Date.now().toString(36)}` : draft.slug;

    const { data: inserted, error: insertErr } = await mainDb.from('blog_posts').insert({
      slug, title: draft.title, excerpt: draft.excerpt || '', content: draft.content,
      tag: draft.tag || null, read_time: draft.readTime || null, published: AUTO_PUBLISH_BLOG,
      target_lang: 'sk' // AI generuje iba SK obsah (žiadne title_cs/excerpt_cs/content_cs) — bez tohto ho /blog vyfiltruje (`.in('target_lang', audienceLangs)` nikdy nezachytí NULL)
    }).select().single();
    if (insertErr) throw new Error(insertErr.message);

    await logAction({
      actionType: AUTO_PUBLISH_BLOG ? 'blog_draft_published' : 'blog_draft_created',
      targetSystem: 'main', targetId: inserted.id,
      reasoning: draft.trendReason
        ? `Na základe web vyhľadávania: ${draft.trendReason}. AI vygenerovala nový článok a ${AUTO_PUBLISH_BLOG ? 'rovno ho publikovala' : 'uložila ako draft na schválenie'}.`
        : `Tag/téma "${draft.tag}" sa dlho nepokrývala. AI vygenerovala nový článok a ${AUTO_PUBLISH_BLOG ? 'rovno ho publikovala' : 'uložila ako draft na schválenie'}.`,
      result: 'success', detail: { slug, title: draft.title, tag: draft.tag, trendReason: draft.trendReason || null }
    });
    await setFailureStreak(0);
    return { ok: true, slug, title: draft.title, published: AUTO_PUBLISH_BLOG };
  } catch (err) {
    await logAction({ actionType: 'blog_draft_published', targetSystem: 'main', reasoning: 'Pokus o automatický blog článok zlyhal.', result: 'failed', detail: { error: err.message } });
    await setFailureStreak(streak + 1);
    return { ok: false, error: err.message };
  }
}

async function runPayoutReadyFlagger() {
  try {
    const { data: pending } = await supabase.from('partner_payouts')
      .select('id, amount, iban, requested_at, partners(first_name, last_name)').eq('status', 'pending');
    const ready = (pending || []).filter(p => Number(p.amount) >= PAYOUT_READY_THRESHOLD_EUR && p.iban);
    for (const p of ready) {
      const name = p.partners ? `${p.partners.first_name} ${p.partners.last_name}` : p.id;
      await logAction({
        actionType: 'payout_qr_prepared', targetSystem: 'partner', targetId: p.id,
        reasoning: `Výber ${p.amount}€ pre ${name} má IBAN a presahuje prah ${PAYOUT_READY_THRESHOLD_EUR}€ — pripravený na vyplatenie. AI QR nevytvára prevod, iba ho pripravuje na sken v bankovej appke.`,
        result: 'success', detail: { amount: p.amount, partner: name }
      });
    }
    return { ok: true, flagged: ready.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

router.post('/api/dash/aiops/run', requireDashAuth, async (req, res) => {
  const { tasks } = req.body || {};
  const want = (t) => !tasks || tasks.includes(t);
  const results = {};
  if (want('blog')) results.blog = await runBlogTrendPublisher();
  if (want('payouts')) results.payouts = await runPayoutReadyFlagger();
  res.json({ ok: true, results });
});

// Pre externý cron (denný beh bez prihlásenia) — chránené x-cron-key, nie
// session cookie, presne ako POST /api/admin/cron/daily v ad appke.
router.post('/api/dash/aiops/cron', async (req, res) => {
  if (!checkCronKey(req)) return res.status(403).json({ error: 'Forbidden.' });
  const results = {
    blog: await runBlogTrendPublisher(),
    payouts: await runPayoutReadyFlagger()
  };
  res.json({ ok: true, results });
});

router.get('/api/dash/aiops/log', requireDashAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { data, error } = await supabase.from('dash_ai_actions_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ actions: data || [] });
});

module.exports = router;
