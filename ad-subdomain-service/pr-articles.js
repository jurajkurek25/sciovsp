// Nový typ reklamy: "PR článok na blog" — jednorazová platba (nie
// predplatné). Inzerent napíše info o produkte, AI sa opýta doplňujúce
// otázky, inzerent odpovie, po zaplatení AI sama vygeneruje bilingválny
// (SK+CZ) článok, prejde ho automatickou kontrolou obsahu (rovnaký
// fail-closed princíp ako moderation.js) a vypublikuje ho na blog hlavnej
// appky (sptrener.online) cez interné API.
//
// Cena: 249€ jednorazovo (nie mesačne) — je to trvalý asset (SEO odkaz,
// zostáva na blogu natrvalo), nie rotujúci slot ako banner/video.

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('./db');
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { moderateArticleText } = require('./moderation');

const JWT_SECRET = process.env.JWT_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const WRITER_MODEL = 'claude-sonnet-5';
const PR_ARTICLE_PRICE_CENTS = 24900; // 249€
const APP_URL = process.env.APP_URL || 'https://ad.sptrener.online';
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'https://sptrener.online';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

const NON_TERMINAL_STATUSES = ['draft', 'questions_ready', 'answered', 'paid', 'generating', 'pending_approval'];

// Rovnaká logika ako requireAdvertiser v server.js — zámerne duplikovaná
// (nie zdieľaná cez spoločný modul), aby sa nemusel meniť existujúci,
// funkčný auth kód v server.js kvôli tomuto novému súboru.
async function requireAdvertiser(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query('SELECT * FROM advertisers WHERE id = ?', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Neplatný token.' });
    req.advertiser = rows[0];
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  }
}

function prArticleJson(row) {
  const draft = row.status === 'pending_approval' && row.draft_json ? JSON.parse(row.draft_json) : null;
  return {
    id: row.id,
    companyName: row.company_name,
    productInfo: row.product_info,
    studentBenefit: row.student_benefit,
    studentOutcome: row.student_outcome,
    blogFit: row.blog_fit,
    targetUrl: row.target_url,
    targetLang: row.target_lang,
    questions: row.questions_json ? JSON.parse(row.questions_json) : null,
    answers: row.answers_json ? JSON.parse(row.answers_json) : null,
    status: row.status,
    blogUrl: row.blog_url,
    failReason: row.status === 'failed' ? row.fail_reason : null,
    draft: draft ? {
      title: draft.title, excerpt: draft.excerpt, content: draft.content, tag: draft.tag, readTime: draft.readTime,
      titleCs: draft.titleCs || null, excerptCs: draft.excerptCs || null, contentCs: draft.contentCs || null,
      tagCs: draft.tagCs || null, readTimeCs: draft.readTimeCs || null
    } : null,
    createdAt: row.created_at
  };
}

// Zdieľané medzi handlePrArticlePaid (po schválení automatickou kontrolou)
// a /approve routou (po schválení inzerentom) — publikuje článok na
// hlavný blog cez interné API.
async function publishArticle(pr, article) {
  if (!INTERNAL_API_SECRET) throw new Error('INTERNAL_API_SECRET nie je nastavený — nemôžem publikovať na hlavný blog.');

  const publishRes = await fetch(`${MAIN_APP_URL}/api/internal/publish-blog-post`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_API_SECRET },
    body: JSON.stringify({
      slug: article.slug, title: article.title, excerpt: article.excerpt, content: article.content,
      tag: article.tag, read_time: article.readTime,
      title_cs: article.titleCs || null, excerpt_cs: article.excerptCs || null, tag_cs: article.tagCs || null,
      read_time_cs: article.readTimeCs || null, content_cs: article.contentCs || null,
      sponsor_name: pr.company_name, target_lang: pr.target_lang
    })
  });
  if (!publishRes.ok) {
    const errText = await publishRes.text().catch(() => '');
    throw new Error(`Publikovanie na hlavný blog zlyhalo (${publishRes.status}): ${errText.slice(0, 300)}`);
  }
  return publishRes.json();
}

async function callClaude({ system, userPrompt, maxTokens }) {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY nie je nastavený.');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60000);
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: WRITER_MODEL,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userPrompt }]
      }),
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
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude nevrátila validný JSON.');
  return JSON.parse(match[0]);
}

async function generateQuestions({ companyName, productInfo, studentBenefit, studentOutcome, blogFit }) {
  const system = `Si skúsený content editor blogu SP Tréner — appky na prípravu na vysokoškolské prijímacie testy (VŠP/OSP/SCIO). Publikum blogu sú stredoškoláci a uchádzači o vysokú školu v SK aj CZ. Pomáhaš inzerentom pripraviť podklady pre kvalitný, konkrétny PR článok (nie generickú reklamu) tak, že sa ich opýtaš presne to, čo chýba.`;
  const userPrompt = `Firma/produkt: ${companyName}
Čo produkt robí: ${productInfo}
Prečo sa to hodí študentom: ${studentBenefit}
Aký výsledok z toho majú študenti: ${studentOutcome}
Prečo sa to hodí na náš blog: ${blogFit}

Na základe tohto polož presne 5 doplňujúcich otázok v slovenčine, ktoré — keď na ne inzerent odpovie — ti dajú dosť konkrétneho materiálu na napísanie skutočne užitočného, špecifického článku (nie generickej reklamy plnej fráz). Pýtaj sa na konkrétne detaily, čísla, príklady, skúsenosti — nie na veci, ktoré už boli povedané vyššie.

Odpovedz VÝHRADNE validným JSON: {"questions": ["otázka 1", "otázka 2", "otázka 3", "otázka 4", "otázka 5"]}`;

  const parsed = await callClaude({ system, userPrompt, maxTokens: 1000 });
  const questions = (parsed.questions || []).filter(q => typeof q === 'string' && q.trim()).slice(0, 5);
  if (questions.length < 3) throw new Error('AI nevygenerovala dosť otázok.');
  return questions;
}

async function generateArticle({ companyName, productInfo, studentBenefit, studentOutcome, blogFit, targetUrl, questions, answers, targetLang, previousDraft, revisionReason }) {
  const qaText = questions.map((q, i) => `Otázka: ${q}\nOdpoveď: ${answers[i] || '(nezodpovedané)'}`).join('\n\n');
  const bilingual = targetLang === 'both';
  // Keď cieľové publikum NIE JE "oba", píše sa len jeden jazyk — do polí
  // title/excerpt/tag/readTime/content (bez prípony Cs) bez ohľadu na to,
  // či je to SK alebo CZ text (schéma blog_posts vyžaduje tieto polia
  // vyplnené vždy; polia s príponou Cs zostanú prázdne a blog ich jednoducho
  // nezobrazí ako druhú jazykovú verziu).
  const primaryLang = targetLang === 'cz' ? 'cz' : 'sk';

  const languageInstruction = bilingual
    ? 'Článok musí byť bilingválny — vyplň VŠETKY polia: title/excerpt/tag/readTime/content v slovenčine, titleCs/excerptCs/tagCs/readTimeCs/contentCs v prirodzenej češtine (nie strojový preklad, píš ako rodený hovorca).'
    : primaryLang === 'sk'
      ? 'Cieľové publikum je LEN slovenské. Píš VÝHRADNE v slovenčine. Vyplň len title/excerpt/tag/readTime/content. Polia s príponou Cs (titleCs/excerptCs/tagCs/readTimeCs/contentCs) nechaj ako prázdny reťazec "".'
      : 'Cieľové publikum je LEN české. Píš VÝHRADNE v prirodzenej češtine (nie strojový preklad, píš ako rodený hovorca) — AJ KEĎ sa polia v JSON schéme nižšie volajú title/excerpt/tag/readTime/content (bez prípony Cs), napíš do NICH český text, keďže to bude jediná jazyková verzia tohto článku. Polia s príponou Cs (titleCs/excerptCs/tagCs/readTimeCs/contentCs) nechaj ako prázdny reťazec "".';

  const system = `Si skúsený redaktor blogu SP Tréner (sptrener.online/blog) — appky na prípravu na vysokoškolské prijímacie testy (VŠP, OSP, SCIO). Píšeš PR (sponzorovaný) článok na objednávku inzerenta, ale musí byť napísaný v ROVNAKOM štýle a s ROVNAKOU užitočnosťou ako organické články na blogu — teda musí čitateľovi (stredoškolák/uchádzač o VŠ) reálne niečo dať, nie byť len reklamný text. Produkt/firmu spomínaj prirodzene v kontexte, nie ako opakovaný slogan.

HTML konvencie, ktoré MUSÍŠ dodržať v obsahových poliach:
- odseky <p>...</p>
- medzititulky <h2>...</h2>
- needusporiadaný zoznam <ul><li>...</li></ul>
- usporiadaný zoznam presne takto: <ol style="margin-left:1.2rem;color:var(--text2)"><li>...</li></ol>
- žiadne iné HTML značky, žiadne <html>/<body>/<script>
- článok má cca 500-800 slov, viacero <h2> sekcií
- SEO: titulok aj druhý odsek (hneď po disclosure) obsahujú prirodzene hlavnú tému/kľúčovú frázu článku (napr. názov produktu + čo rieši) — nie len vo výplňových vetách
- PRVÝ odsek (<p>) v každom vyplnenom obsahovom poli MUSÍ byť presne toto (disclosure, nič nemeň, len použi disclosure v JAZYKU DANÉHO POĽA — teda ak do poľa "content" píšeš český text pre výhradne české publikum, použi ČESKÚ verziu disclosure aj v poli "content"):
  slovenský text: <p style="font-family:var(--mono);font-size:.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Partnerský obsah — v spolupráci s ${companyName}</p>
  český text: <p style="font-family:var(--mono);font-size:.75rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Partnerský obsah — ve spolupráci s ${companyName}</p>

${languageInstruction}`;

  const userPrompt = `Firma/produkt: ${companyName}
Čo produkt robí: ${productInfo}
Prečo sa to hodí študentom: ${studentBenefit}
Aký výsledok z toho majú študenti: ${studentOutcome}
Prečo sa to hodí na náš blog: ${blogFit}
Cieľová URL (spomeň ju/odkáž na ňu v texte prirodzene): ${targetUrl}

Doplňujúce otázky a odpovede od inzerenta:
${qaText}
${previousDraft && revisionReason ? `

Toto je OPRAVNÝ pokus. Predchádzajúci návrh článku automatická kontrola obsahu ZAMIETLA z tohto dôvodu: "${revisionReason}"

Predchádzajúci návrh (titulok + SK obsah, pre kontext):
Titulok: ${previousDraft.title}
${previousDraft.content}

Napíš NOVÝ návrh, ktorý konkrétne rieši uvedený dôvod zamietnutia — over si najmä fakty, tón a súlad medzi tvrdeniami a cieľovou stránkou. Zvyšok (štýl, dĺžka, HTML konvencie, disclosure odsek) zostáva rovnaký ako predtým.` : ''}

Napíš kompletný PR článok. Odpovedz VÝHRADNE validným JSON v tomto tvare (žiadny text okolo):
{
  "slug": "kratky-vystizny-slug-len-malymi-pismenami-a-pomlckami",
  "title": "SK titulok (max 55 znakov — appka k nemu pripája \" — SP Tréner\" v zobrazení, dlhší titulok sa oreže v Google výsledkoch)",
  "excerpt": "SK popis presne 140-160 znakov — funguje aj ako meta description, zhrň konkrétny prínos, nie všeobecnú frázu",
  "tag": "SK kategória, napr. Príprava alebo Partnerský obsah",
  "readTime": "napr. 5 min čítania",
  "content": "SK HTML obsah podľa konvencií vyššie",
  "titleCs": "CZ titulok (rovnaké SEO pravidlá ako title — max 55 znakov)",
  "excerptCs": "CZ popis (rovnaké SEO pravidlá ako excerpt — 140-160 znakov)",
  "tagCs": "CZ kategória",
  "readTimeCs": "napr. 5 min čtení",
  "contentCs": "CZ HTML obsah podľa konvencií vyššie"
}`;

  const parsed = await callClaude({ system, userPrompt, maxTokens: 6000 });
  const required = bilingual
    ? ['slug', 'title', 'excerpt', 'content', 'titleCs', 'excerptCs', 'contentCs']
    : ['slug', 'title', 'excerpt', 'content'];
  for (const f of required) {
    if (!parsed[f] || typeof parsed[f] !== 'string' || !parsed[f].trim()) {
      throw new Error(`AI nevygenerovala povinné pole: ${f}`);
    }
  }
  return parsed;
}

// ─── Routes (mountované v server.js pod requireAdvertiser aj bez neho) ───

router.post('/api/pr-articles', requireAdvertiser, async (req, res) => {
  const { companyName, productInfo, studentBenefit, studentOutcome, blogFit, targetUrl, targetLang } = req.body || {};
  if (!companyName || !productInfo || !studentBenefit || !studentOutcome || !blogFit) {
    return res.status(400).json({ error: 'Vyplň prosím všetky polia.' });
  }
  if (!targetUrl || !/^https?:\/\//.test(targetUrl)) {
    return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });
  }
  const finalTargetLang = ['sk', 'cz', 'both'].includes(targetLang) ? targetLang : 'both';

  try {
    const [existing] = await db.query(
      `SELECT id FROM pr_articles WHERE advertiser_id = ? AND status IN (${NON_TERMINAL_STATUSES.map(() => '?').join(',')}) LIMIT 1`,
      [req.advertiser.id, ...NON_TERMINAL_STATUSES]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'Už máš rozpracovaný PR článok — dokonči alebo počkaj na jeho spracovanie skôr, než začneš nový.' });
    }

    const questions = await generateQuestions({ companyName, productInfo, studentBenefit, studentOutcome, blogFit });

    const [result] = await db.query(
      `INSERT INTO pr_articles (advertiser_id, company_name, product_info, student_benefit, student_outcome, blog_fit, target_url, target_lang, questions_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'questions_ready')`,
      [req.advertiser.id, companyName, productInfo, studentBenefit, studentOutcome, blogFit, targetUrl, finalTargetLang, JSON.stringify(questions)]
    );
    const [rows] = await db.query('SELECT * FROM pr_articles WHERE id = ?', [result.insertId]);
    res.status(201).json({ prArticle: prArticleJson(rows[0]) });
  } catch (e) {
    console.error('pr-article create error:', e);
    res.status(502).json({ error: 'Nepodarilo sa vygenerovať doplňujúce otázky. Skús to prosím znova.' });
  }
});

router.get('/api/pr-articles/mine', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pr_articles WHERE advertiser_id = ? ORDER BY created_at DESC', [req.advertiser.id]);
    res.json({ prArticles: rows.map(prArticleJson) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

router.post('/api/pr-articles/:id/answers', requireAdvertiser, async (req, res) => {
  const { answers } = req.body || {};
  if (!Array.isArray(answers) || answers.some(a => typeof a !== 'string' || !a.trim())) {
    return res.status(400).json({ error: 'Odpovedz prosím na všetky otázky.' });
  }
  try {
    const [rows] = await db.query('SELECT * FROM pr_articles WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const pr = rows[0];
    if (!pr) return res.status(404).json({ error: 'PR článok sa nenašiel.' });
    if (pr.status !== 'questions_ready') return res.status(400).json({ error: 'Tento krok už bol dokončený.' });

    const questions = JSON.parse(pr.questions_json || '[]');
    if (answers.length !== questions.length) return res.status(400).json({ error: 'Počet odpovedí nesedí s počtom otázok.' });

    await db.query(`UPDATE pr_articles SET answers_json = ?, status = 'answered' WHERE id = ?`, [JSON.stringify(answers), pr.id]);
    const [updated] = await db.query('SELECT * FROM pr_articles WHERE id = ?', [pr.id]);
    res.json({ prArticle: prArticleJson(updated[0]) });
  } catch (e) {
    console.error('pr-article answers error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

router.post('/api/pr-articles/:id/checkout', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pr_articles WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const pr = rows[0];
    if (!pr) return res.status(404).json({ error: 'PR článok sa nenašiel.' });
    if (pr.status !== 'answered') return res.status(400).json({ error: 'Najprv odpovedz na doplňujúce otázky.' });

    let customerId = req.advertiser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.advertiser.email, metadata: { advertiserId: String(req.advertiser.id) } });
      customerId = customer.id;
      await db.query('UPDATE advertisers SET stripe_customer_id = ? WHERE id = ?', [customerId, req.advertiser.id]);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: `PR článok na blog SP Tréner — ${pr.company_name}` },
          unit_amount: PR_ARTICLE_PRICE_CENTS
        },
        quantity: 1
      }],
      success_url: `${APP_URL}/dashboard?payment=success`,
      cancel_url: `${APP_URL}/dashboard?payment=cancelled`,
      metadata: { advertiserId: String(req.advertiser.id), prArticleId: String(pr.id) }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('pr-article checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

router.post('/api/pr-articles/:id/approve', requireAdvertiser, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pr_articles WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const pr = rows[0];
    if (!pr) return res.status(404).json({ error: 'PR článok sa nenašiel.' });
    if (pr.status !== 'pending_approval' || !pr.draft_json) return res.status(400).json({ error: 'Tento článok momentálne nečaká na schválenie.' });

    const article = JSON.parse(pr.draft_json);
    const publishData = await publishArticle(pr, article);

    await db.query(
      `UPDATE pr_articles SET status = 'published', generated_title = ?, generated_slug = ?, blog_url = ?, published_at = NOW() WHERE id = ?`,
      [article.title, publishData.slug, publishData.url, pr.id]
    );

    const { notifyAdvertiserPrArticlePublished } = require('./notify');
    notifyAdvertiserPrArticlePublished({ advertiserEmail: req.advertiser.email, blogUrl: publishData.url }).catch(() => {});

    const [updated] = await db.query('SELECT * FROM pr_articles WHERE id = ?', [pr.id]);
    res.json({ prArticle: prArticleJson(updated[0]) });
  } catch (e) {
    console.error('pr-article approve error:', e);
    await db.query(`UPDATE pr_articles SET status = 'failed', fail_reason = ? WHERE id = ?`, [e.message.slice(0, 1000), req.params.id]).catch(() => {});
    res.status(500).json({ error: 'Publikovanie zlyhalo. Skús to prosím znova alebo nás kontaktuj.' });
  }
});

router.post('/api/pr-articles/:id/reject', requireAdvertiser, async (req, res) => {
  const { reason } = req.body || {};
  try {
    const [rows] = await db.query('SELECT * FROM pr_articles WHERE id = ? AND advertiser_id = ?', [req.params.id, req.advertiser.id]);
    const pr = rows[0];
    if (!pr) return res.status(404).json({ error: 'PR článok sa nenašiel.' });
    if (pr.status !== 'pending_approval') return res.status(400).json({ error: 'Tento článok momentálne nečaká na schválenie.' });

    const failReason = `Inzerent zamietol vygenerovaný návrh.${reason ? ' Dôvod: ' + reason : ''}`;
    await db.query(`UPDATE pr_articles SET status = 'failed', fail_reason = ? WHERE id = ?`, [failReason.slice(0, 1000), pr.id]);

    const { notifyAdminRejection } = require('./notify');
    notifyAdminRejection({ advertiserEmail: req.advertiser.email, itemType: 'pr_article', linkUrl: pr.target_url, category: 'advertiser_rejected', reason: reason || 'bez uvedeného dôvodu' }).catch(() => {});

    const [updated] = await db.query('SELECT * FROM pr_articles WHERE id = ?', [pr.id]);
    res.json({ prArticle: prArticleJson(updated[0]) });
  } catch (e) {
    console.error('pr-article reject error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// ─── Volané z webhooku po úspešnej jednorazovej platbe (server.js) ───

async function handlePrArticlePaid(prArticleId, paymentIntentId) {
  const [rows] = await db.query('SELECT * FROM pr_articles WHERE id = ?', [prArticleId]);
  const pr = rows[0];
  if (!pr || pr.status !== 'answered') return; // už spracované alebo neplatný stav — idempotencia

  await db.query(
    `UPDATE pr_articles SET status = 'generating', paid_at = NOW(), stripe_payment_intent_id = ? WHERE id = ?`,
    [paymentIntentId || null, pr.id]
  );

  const [advRows] = await db.query('SELECT email FROM advertisers WHERE id = ?', [pr.advertiser_id]);
  const advertiserEmail = advRows[0] ? advRows[0].email : null;

  try {
    const questions = JSON.parse(pr.questions_json || '[]');
    const answers = JSON.parse(pr.answers_json || '[]');

    // Text (na rozdiel od banner/video kreatívy) vie AI na základe konkrétneho
    // dôvodu zamietnutia sama prepísať — preto tu na rozdiel od moderateContent()
    // skúšame až MAX_ATTEMPTS pokusov s revíziou, kým sa to vzdá a pošle na
    // človeka. Fail-closed princíp ostáva: ak ani posledný pokus neprejde,
    // nič sa nepublikuje.
    const MAX_ATTEMPTS = 3;
    let article = null;
    let moderation = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      article = await generateArticle({
        companyName: pr.company_name, productInfo: pr.product_info, studentBenefit: pr.student_benefit,
        studentOutcome: pr.student_outcome, blogFit: pr.blog_fit, targetUrl: pr.target_url, questions, answers,
        targetLang: pr.target_lang,
        previousDraft: attempt > 1 ? article : null,
        revisionReason: attempt > 1 && moderation ? moderation.reason : null
      });

      moderation = await moderateArticleText({
        companyName: pr.company_name, title: article.title, content: article.content, linkUrl: pr.target_url
      });

      db.query(
        `INSERT INTO moderation_log (item_type, item_id, advertiser_id, allowed, category, reason, raw_response, link_url) VALUES ('pr_article', ?, ?, ?, ?, ?, ?, ?)`,
        [pr.id, pr.advertiser_id, moderation.allowed ? 1 : 0, moderation.category || null, `[pokus ${attempt}/${MAX_ATTEMPTS}] ${moderation.reason || ''}`, moderation.raw || null, pr.target_url]
      ).catch(e => console.error('moderation_log insert error:', e.message));

      if (moderation.allowed) break;
      console.warn(`pr-article ${pr.id}: pokus ${attempt}/${MAX_ATTEMPTS} zamietnutý (${moderation.category}): ${moderation.reason}`);
    }

    if (!moderation.allowed) {
      await db.query(
        `UPDATE pr_articles SET status = 'failed', moderation_allowed = 0, moderation_reason = ?, fail_reason = ? WHERE id = ?`,
        [moderation.reason || null, `Automatická kontrola obsahu článok zamietla aj po 3 pokusoch AI o opravu. Posledný dôvod: ${moderation.reason || 'nespĺňa pravidlá platformy.'}`, pr.id]
      );
      const { notifyAdminRejection, notifyAdvertiserPrArticleFailed } = require('./notify');
      notifyAdminRejection({ advertiserEmail, itemType: 'pr_article', linkUrl: pr.target_url, category: moderation.category, reason: moderation.reason }).catch(() => {});
      if (advertiserEmail) notifyAdvertiserPrArticleFailed({ advertiserEmail, reason: moderation.reason }).catch(() => {});
      return;
    }

    // Článok prešiel automatickou kontrolou — namiesto rovno publikovania
    // čaká na schválenie Inzerentom v dashboarde (pozri /approve, /reject).
    // draft_ready_at slúži automation.js na zistenie, ako dlho tam už
    // nečinne čaká, aby vedel poslať pripomienku.
    await db.query(
      `UPDATE pr_articles SET status = 'pending_approval', moderation_allowed = 1, draft_json = ?, draft_ready_at = NOW() WHERE id = ?`,
      [JSON.stringify(article), pr.id]
    );

    const { notifyAdvertiserPrArticleReadyForApproval } = require('./notify');
    if (advertiserEmail) notifyAdvertiserPrArticleReadyForApproval({ advertiserEmail }).catch(() => {});
  } catch (e) {
    console.error('pr-article generation/publish error:', e);
    await db.query(`UPDATE pr_articles SET status = 'failed', fail_reason = ? WHERE id = ?`, [e.message.slice(0, 1000), pr.id]).catch(() => {});
    try {
      const { notifyAdminRejection } = require('./notify');
      notifyAdminRejection({ advertiserEmail, itemType: 'pr_article', linkUrl: pr.target_url, category: 'generation_error', reason: e.message }).catch(() => {});
    } catch (_) {}
  }
}

module.exports = { router, handlePrArticlePaid };
