// Pridáva moderateArticleText() do moderation.js — textová obdoba
// moderateContent() (ktorá posudzuje obrázky/video), pre nový typ reklamy
// "PR článok na blog". Rovnaká FAIL-CLOSED filozofia ako pri
// banneroch/videách: akákoľvek chyba = zamietnutie, nie tiché prepustenie.
// Znovupoužíva fetchLinkContext() (over cieľovú URL) — nekopíruje ju.
//
// Presný textový match proti overenému živému súboru moderation.js.
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/01-moderation-article-text.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'moderation.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('moderateArticleText')) {
  console.error('❌ Vyzerá to, že moderateArticleText už existuje. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `module.exports = { moderateContent };`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný export riadok na konci moderation.js. Nič som nezmenil.');
  process.exit(1);
}

const ADDITION = `
function buildArticlePrompt({ companyName, title, content, linkUrl, linkContext }) {
  const redirectLine = linkContext.redirected
    ? \`⚠️ Stránka pri načítaní presmerovala inam, na: \${linkContext.finalUrl} — over, či nejde o pokus schovať skutočný cieľ za nevinne vyzerajúcou URL.\`
    : '';
  const botBlockedLine = linkContext.botBlocked
    ? \`ℹ️ Stránku sa nepodarilo automatizovane načítať, lebo ju chráni bot-ochrana (napr. Cloudflare) — TOTO JE BEŽNÉ AJ PRE ÚPLNE LEGITÍMNE STRÁNKY a samo osebe to NIE JE dôvod na zamietnutie.\`
    : '';
  const reachabilityLine = linkContext.botBlocked
    ? 'Cieľová stránka dostupná: nedá sa automatizovane overiť (blokovaná bot-ochranou, pozri poznámku vyššie)'
    : \`Cieľová stránka dostupná: \${linkContext.reachable ? 'áno' : 'nie'}\`;
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 6000);
  return \`Si kontrolór obsahu pre AI-generovaný PR (sponzorovaný) článok, ktorý sa má automaticky vypublikovať na blogu platformy na prípravu na vysokoškolské prijímacie testy. Publikum sú najmä ľudia NA KONCI strednej školy alebo TESNE PO NEJ (17–20 rokov). Článok bude na blogu jasne označený ako partnerský/sponzorovaný obsah — to už je vyriešené, neposudzuj to.

Inzerent (firma): \${companyName}
Cieľová URL: \${linkUrl}
\${redirectLine}
\${botBlockedLine}
Titulok cieľovej stránky: \${linkContext.title || '(nepodarilo sa načítať)'}
Popis cieľovej stránky: \${linkContext.description || '(nepodarilo sa načítať)'}
\${reachabilityLine}

Titulok vygenerovaného článku: \${title}

Text vygenerovaného článku (bez HTML značiek):
\${plainText}

ZAMIETNI (allowed:false), ak článok ALEBO cieľová stránka:
- skutočne propaguje kúpu/konzumáciu alkoholu alebo tabaku/nikotínu, hazardné hry/stávkovanie, alebo obsahuje sexuálne explicitný obsah
- je nelegálna, podvodná, klamlivá alebo zavádzajúca — sľubuje nereálne výsledky/výnosy, vydáva sa za niečo iné, než reálne je
- obsahuje nenávistný prejav, násilie alebo diskrimináciu
- vedie na škodlivý softvér alebo inak nebezpečný cieľ
- je úplne irelevantná pre publikum blogu (uchádzači o vysokú školu) — nemá žiadnu rozumnú súvislosť so štúdiom, prípravou na testy, alebo životom stredoškoláka/uchádzača o VŠ
- obsahuje jasne overiteľne nepravdivé faktické tvrdenia (napr. vymyslené štatistiky prezentované ako fakt)
- cieľová stránka je preukázateľne mŕtva/neexistujúca (NIE ak ju len blokuje bot-ochrana), alebo skryto presmerováva na podozrivý cieľ

Ak si pri akomkoľvek kritériu neistý, rozhoduj v prospech POVOLENIA (allowed:true) — zamietnutie vyžaduje konkrétny, popísateľný dôvod.

Odpovedz VÝHRADNE validným JSON objektom, nič iné:
{"allowed": true alebo false, "category": "krátka kategória", "reason": "jedna veta vysvetlenia po slovensky"}\`;
}

async function moderateArticleText({ companyName, title, content, linkUrl }) {
  if (!ANTHROPIC_API_KEY) {
    return { allowed: false, category: 'config_error', reason: 'ANTHROPIC_API_KEY nie je nastavený — automatická kontrola nemôže bežať, preto sa zamieta pre istotu.' };
  }

  const linkContext = await fetchLinkContext(linkUrl);

  let res;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 25000);
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: buildArticlePrompt({ companyName, title, content, linkUrl, linkContext }) }]
      }),
      signal: controller.signal
    });
    clearTimeout(t);
  } catch (e) {
    return { allowed: false, category: 'api_error', reason: \`Volanie AI kontroly zlyhalo (\${e.message}) — zamietnuté pre istotu.\` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { allowed: false, category: 'api_error', reason: \`AI kontrola vrátila chybu \${res.status} — zamietnuté pre istotu.\`, raw: errText.slice(0, 500) };
  }

  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  let parsed;
  try {
    const match = text.match(/\\{[\\s\\S]*\\}/);
    parsed = JSON.parse(match ? match[0] : text);
  } catch (e) {
    return { allowed: false, category: 'parse_error', reason: 'Odpoveď AI kontroly sa nepodarila spracovať — zamietnuté pre istotu.', raw: text.slice(0, 500) };
  }

  return {
    allowed: parsed.allowed === true,
    category: parsed.category || 'unknown',
    reason: parsed.reason || '',
    raw: text.slice(0, 1000)
  };
}

module.exports = { moderateContent, moderateArticleText };`;

const backupPath = FILE_PATH + '.pre-article-moderation-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
const out = src.replace(OLD, ADDITION.trimStart());
fs.writeFileSync(FILE_PATH, out);

console.log('✅ moderateArticleText() pridaná do moderation.js a exportovaná.');
console.log('   Záloha pôvodného moderation.js:', backupPath);
console.log('   Over syntax: node -c moderation.js');
