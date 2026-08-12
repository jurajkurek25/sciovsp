const express = require('express');
const router = express.Router();

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
// Dynamický fallback na NAJNOVŠÍ dostupný model (nikdy na starší pevne
// zadaný) — pozri poznámku pri jeho použití nižšie a lib/resolveModel.js.
const { pickStartingModel, markModelGood, getNewestUntriedModel } = require('./lib/resolveModel');

// Spoločná JSON schéma, ktorú očakáva public/app.html (generateQuestions()) —
// pole "text" (nie "question"!), voliteľný "context", "options" (4, alebo 8 pri
// verbálnych antosynonymách), "answer" index, voliteľný "antonym_answer", "explanation".
const SCHEMA_FOOTER = `
Odpovedaj VÝHRADNE validným JSON v tomto formáte (žiadny iný text, žiadny markdown):
{
  "topic": "názov okruhu",
  "part": "{{PART}}",
  "questions": [
    {
      "text": "text úlohy",
      "context": null,
      "options": ["možnosť A", "možnosť B", "možnosť C", "možnosť D"],
      "answer": 0,
      "explanation": "vysvetlenie prečo je táto odpoveď správna",
      "difficulty": "easy"
    }
  ]
}
Pravidlá:
- Presne jedna správna odpoveď na úlohu, 4 možnosti (A-D), indexované 0-3.
- Zámerne strieedaj, na ktorej pozícii (0-3) je správna odpoveď — nedávaj ju stále na rovnaké miesto.
- Vecná správnosť má prednosť pred originalitou. Ak si nie si istý konkrétnym detailom (napr. presné číslo, rok), zvoľ fakt, ktorým si si istý.
- Vysvetlenie je jedna veta, vecné, bez omáčky.
- Ak úloha nepotrebuje sprievodný text/kontext, "context" nechaj null.`;

const SUBJECT_PROMPTS = {
  verbal: `Si odborník na tvorbu úloh pre slovenské/české SCIO Všeobecné študijné predpoklady (VŠP/OSP) testy — VERBÁLNA časť.
Píš v jazyku: {{LANG}}.

TYPY ÚLOH:
- Doplňovanie do viet: krátky text s medzerami, vyber dvojicu/trojicu slov
- Vzťahy medzi slovami: analógie vo forme "X : Y = ? : ?"
- Koherencia textov: nájdi JEDNU vetu, ktorá NEZAPADÁ do celkového textu
- Vyvodzovanie z krátkych textov: zo 100-200 slov urči, ktoré tvrdenia VYPLÝVAJÚ z textu
- Porozumenie textu: dlhší text (200-400 slov) + otázka o jeho obsahu
Texty musia byť vecne korektné, relevantné a zaujímavé (veda, spoločnosť, história, médiá).${SCHEMA_FOOTER}`,

  analytical: `Si odborník na tvorbu úloh pre slovenské/české SCIO Všeobecné študijné predpoklady (VŠP/OSP) testy — ANALYTICKÁ časť.
Píš v jazyku: {{LANG}}.

TYPY ÚLOH:
- Grafy a tabuľky: čítanie z grafu/tabuľky, výpočty percent/počtov
- Porovnávanie hodnôt: porovnaj výraz vľavo vs. vpravo
- Slovné úlohy: matematické textové úlohy (rýchlosť, práca, percentá, pravdepodobnosť)
- Postačujúce podmienky: rozhodni, či dané tvrdenia stačia na jednoznačnú odpoveď
- Zebry (logické úlohy): sada podmienok o osobách/predmetoch, odvodzuj čo platí
Skontroluj si všetky výpočty — musia byť matematicky presné.${SCHEMA_FOOTER}`,

  biologia: `Si odborník na tvorbu prijímacích testových otázok z biológie pre lekárske, farmaceutické a veterinárne fakulty na Slovensku a v Česku (napr. UPJŠ Košice, LF MUNI, Farmaceutická fakulta UK).
Píš v jazyku: {{LANG}}. Úroveň: stredoškolská biológia (gymnázium) s miernym presahom do prvého ročníka VŠ, NIE postgraduálna úroveň.

TÉMY: bunková biológia, genetika a dedičnosť, anatómia a fyziológia človeka (orgánové sústavy), mikrobiológia a imunita, evolúcia a taxonómia, ekológia, molekulárna biológia.${SCHEMA_FOOTER}`,

  chemia: `Si odborník na tvorbu prijímacích testových otázok z chémie pre lekárske, farmaceutické a veterinárne fakulty na Slovensku a v Česku.
Píš v jazyku: {{LANG}}. Úroveň: stredoškolská chémia (gymnázium) s miernym presahom do prvého ročníka VŠ (farmácia si vyžaduje hlbšiu chémiu).

TÉMY: anorganická chémia (periodická sústava, väzby, kyseliny/zásady, redoxné reakcie), organická chémia (uhľovodíky, funkčné skupiny, biomolekuly), fyzikálna chémia (roztoky, pH, rovnováha), biochémia (enzýmy, metabolizmus).
Ak úloha obsahuje výpočet (pH, molarita, stechiometria), priprav ho tak, aby výsledok sedel presne — skontroluj si aritmetiku.${SCHEMA_FOOTER}`,

  fyzika: `Si odborník na tvorbu prijímacích testových otázok z fyziky — pre medicínske aj technické fakulty na Slovensku a v Česku (UPJŠ, LF MUNI, ale aj ČVUT, FEI STU, FEIT Žilina).
Píš v jazyku: {{LANG}}. Úroveň: stredoškolská fyzika (gymnázium).

TÉMY: mechanika, termodynamika, elektrina a magnetizmus, optika (vrátane oka ako optickej sústavy), akustika, základy modernej fyziky/biofyziky (žiarenie, RTG).
Ak úloha obsahuje výpočet, over si dosadenie a jednotky (SI) — výsledok musí sedieť presne.${SCHEMA_FOOTER}`,

  matematika: `Si odborník na tvorbu prijímacích testových otázok z matematiky pre technické a informatické fakulty na Slovensku a v Česku (FIIT STU, FEI STU, FEIT Žilina, ČVUT).
Píš v jazyku: {{LANG}}. Úroveň: stredoškolská matematika (gymnázium).

TÉMY: algebra (rovnice, nerovnice, sústavy), funkcie (lineárne, kvadratické, exponenciálne, logaritmické, goniometrické), planimetria a stereometria, analytická geometria, postupnosti a rady, kombinatorika a pravdepodobnosť, základy diferenciálneho počtu.
KRITICKY DÔLEŽITÉ: skutočne si over každý výpočet krok za krokom — nesprávna "správna" odpoveď na matematickej úlohe je vážna chyba. Distraktory nech zodpovedajú typickým chybám vo výpočte.${SCHEMA_FOOTER}`,

  logika: `Si odborník na tvorbu prijímacích testových otázok z logiky a základov informatiky pre informatické a technické fakulty na Slovensku a v Česku (FIIT STU, FEIT Žilina).
Píš v jazyku: {{LANG}}. Úroveň: nevyžaduje predchádzajúce programátorské skúsenosti — dôraz na logické myslenie.

TÉMY: výroková logika (pravdivostné tabuľky, negácia), množiny, číselné sústavy (binárna, hexadecimálna), algoritmické myslenie, základy programátorskej logiky (podmienky, cykly — koncepčne), logické hádanky a rébusy.
Pri prevodoch sústav a pravdivostných tabuľkách si over výsledok krok za krokom.${SCHEMA_FOOTER}`,

  pedagogika: `Si odborník na tvorbu prijímacích testových otázok pre pedagogické fakulty na Slovensku a v Česku (napr. Pedagogická fakulta UK Praha, OU Ostrava, UP Olomouc) — kombinuje všeobecné študijné predpoklady s pedagogicko-psychologickým základom.
Píš v jazyku: {{LANG}}.

TÉMY: vývinová psychológia dieťaťa (Piaget, Erikson, Vygotskij) v kontexte vzdelávania, teórie učenia, didaktika, Bloomova taxonómia, hodnotenie vo vzdelávaní, vzdelávací systém SR/ČR, dejiny pedagogiky (Komenský a i.), všeobecný kultúrny prehľad so zameraním na školstvo.${SCHEMA_FOOTER}`,

  psychologia: `Si odborník na tvorbu prijímacích testových otázok z psychológie pre bakalárske programy psychológie na Slovensku a v Česku (napr. UCM Trnava).
Píš v jazyku: {{LANG}}.

TÉMY: psychológia ako veda a jej metódy, psychologické smery (behaviorizmus, psychoanalýza, humanistická, kognitívna, gestalt), psychické procesy (vnímanie, pamäť, myslenie, emócie), psychológia osobnosti, ontogenéza psychiky, duševné zdravie a stres.${SCHEMA_FOOTER}`,

  pravo: `Si odborník na tvorbu prijímacích testových otázok pre právnické fakulty na Slovensku a v Česku (napr. Právnická fakulta TU Trnava) — vedomostný test.
Píš v jazyku: {{LANG}}.

TÉMY: spoločensko-politický a kultúrny prehľad (politológia, sociológia, ekonómia, medzinárodné organizácie), základy filozofie (antika po súčasnosť), základy práva (právna teória, Ústava SR/ČR, ľudské práva, štátne orgány), svetové dejiny, slovenské/české dejiny.${SCHEMA_FOOTER}`,
};

function buildSystemPrompt(part, lang) {
  const langName = lang === 'cz' ? 'čeština' : 'slovenčina';
  const template = SUBJECT_PROMPTS[part] || SUBJECT_PROMPTS.verbal;
  return template.replace(/\{\{LANG\}\}/g, langName).replace(/\{\{PART\}\}/g, part);
}

// POST /api/generate-topic
// Body: { topic, part, count, difficulty, lang }
// Vracia SUROVÚ odpoveď Anthropic Messages API (public/app.html číta data.content[].text
// a parsuje z neho JSON podľa schémy vyššie) — chybová obálka Anthropicu {error:{message}}
// sa tak priamo zhoduje s tým, čo frontend očakáva pri !response.ok.
router.post('/generate-topic', async (req, res) => {
  const { topic, part = 'verbal', count = 5, difficulty = 'medium', lang = 'sk' } = req.body || {};

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'AI generátor nie je nakonfigurovaný (chýba ANTHROPIC_API_KEY).' } });
  }

  const safeCount = Math.max(1, Math.min(parseInt(count, 10) || 5, 10));
  const safeDifficulty = ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium';
  const systemPrompt = buildSystemPrompt(part, lang);
  const langLabel = lang === 'cz' ? 'češtine' : 'slovenčine';

  const userPrompt = `Vygeneruj ${safeCount} nových, navzájom odlišných úloh${topic ? ` na okruh: "${topic}"` : ''}.
Obtiažnosť: ${safeDifficulty}.
Píš výhradne v ${langLabel}.
Vráť validný JSON presne podľa schémy zo systémového promptu, žiadny iný text.`;

  try {
    // Dynamický fallback na najnovší dostupný model, ak Anthropic odmietne
    // primárny (napr. bol medzičasom deprecated) — inak by generátor
    // prestal fungovať okamžite a ticho pre všetkých používateľov naraz.
    let response, data;
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
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      data = await response.json();
      if (response.ok) {
        markModelGood(model);
        if (attempt > 0) console.error(`⚠️ Claude model fallback: úspešne použitý novší model '${model}'.`);
        break;
      }
      const errText = JSON.stringify(data);
      const looksLikeModelIssue = response.status === 404 || /model/i.test(errText);
      if (!looksLikeModelIssue) {
        console.error('Anthropic API error:', errText);
        return res.status(response.status).json(data);
      }
      const next = await getNewestUntriedModel(triedModels);
      if (!next) {
        console.error('Anthropic API error:', errText);
        return res.status(response.status).json(data);
      }
      console.error(`⚠️ Claude model '${model}' zlyhal, skúšam novší dostupný '${next}'.`);
      model = next;
    }
    res.json(data);
  } catch (e) {
    console.error('generate-topic error:', e);
    res.status(500).json({ error: { message: 'Neočakávaná chyba servera pri generovaní úloh.' } });
  }
});

module.exports = router;
