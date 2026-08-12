// Automatická AI kontrola reklamného obsahu (Claude vision) — beží pri
// každom uploade banneru/videa a pri zmene cieľovej URL. Politika je
// FAIL-CLOSED: akákoľvek chyba (chýbajúci API kľúč, timeout, zlá odpoveď)
// znamená ZAMIETNUTIE, nie tiché prepustenie. Každé rozhodnutie sa loguje
// do moderation_log (audit stopa) a zamietnutia posielajú email adminovi
// (ak je nastavený SMTP) — takže je to automatické, ale nie bez dohľadu.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Tichý fallback na iný model, ak Anthropic odmietne primárny (napr. bol
// medzičasom deprecated) — inak by fail-closed politika nižšie začala
// zamietať KAŽDÚ kreatívu len kvôli neplatnému model ID, nie kvôli
// skutočnému problému s obsahom. Skúša ďalší model len keď chyba vyzerá
// na problém s modelom (404 alebo zmienka "model" v chybe) — inou chybou
// (napr. skutočný content policy problém) sa naďalej riadi fail-closed.
const MODEL_FALLBACK_CHAIN = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'];
const MAX_FRAMES = 4;

async function getDurationSeconds(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath
    ], { timeout: 10000 });
    const d = parseFloat(stdout.trim());
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch (e) {
    return null;
  }
}

const FRAME_EXTRACT_ATTEMPTS = 2;
const FFMPEG_TIMEOUT_MS = 10000;

// Jeden pokus o extrakciu jedného snímku. Retry sa rieši v extractFrameAt.
async function extractFrameOnce(filePath, offsetSeconds, extraArgs = []) {
  const tmpOut = path.join(os.tmpdir(), `mod-out-${crypto.randomBytes(6).toString('hex')}.jpg`);
  try {
    await execFileAsync('ffmpeg', ['-y', ...extraArgs, '-i', filePath, '-frames:v', '1', '-q:v', '3', tmpOut], { timeout: FFMPEG_TIMEOUT_MS });
    return await fs.promises.readFile(tmpOut);
  } finally {
    fs.promises.unlink(tmpOut).catch(() => {});
  }
}

// Extrahuje snímok pri danom čase, s viacerými pokusmi — malý VPS (2GB RAM)
// môže byť pod záťažou pomalý/timeoutovať, čo by inak zbytočne zamietlo
// úplne v poriadku kreatívu. Loguje skutočnú ffmpeg chybu (predtým sa
// tichotichy prehltla), aby bolo vidno v pm2 logoch, čo presne zlyhalo.
async function extractFrameAt(filePath, offsetSeconds) {
  let lastErr;
  for (let attempt = 1; attempt <= FRAME_EXTRACT_ATTEMPTS; attempt++) {
    try {
      return await extractFrameOnce(filePath, offsetSeconds, ['-ss', String(offsetSeconds)]);
    } catch (e) {
      lastErr = e;
      console.warn(`moderation: extrakcia snímku (offset ${offsetSeconds}s, pokus ${attempt}/${FRAME_EXTRACT_ATTEMPTS}) zlyhala: ${e.message}`);
      if (attempt < FRAME_EXTRACT_ATTEMPTS) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr;
}

// Vytiahne viacero snímkov rovnomerne rozmiestnených v priebehu videa/gifu
// (nie len jeden na začiatku) — funguje pre mp4 aj gif cez ffmpeg/ffprobe.
async function extractFrames(buffer, ext, maxFrames = MAX_FRAMES) {
  const tmpIn = path.join(os.tmpdir(), `mod-in-${crypto.randomBytes(6).toString('hex')}.${ext}`);
  await fs.promises.writeFile(tmpIn, buffer);
  try {
    const duration = await getDurationSeconds(tmpIn);
    let offsets;
    if (duration && duration > 1) {
      const n = Math.min(maxFrames, Math.max(2, Math.floor(duration)));
      offsets = Array.from({ length: n }, (_, i) => (duration * (i + 0.5)) / n);
    } else {
      offsets = [Math.min(0.5, (duration || 1) / 2)];
    }
    const frames = [];
    for (const off of offsets) {
      try { frames.push(await extractFrameAt(tmpIn, off)); } catch (e) { /* už zalogované v extractFrameAt, pokračuje ďalšími časmi */ }
    }
    if (!frames.length) {
      // Posledný záchranný pokus — bez seekovania na presný čas, nech vezme
      // prvý dostupný snímok akokoľvek (niektoré súbory majú problém so seekom).
      console.warn('moderation: všetky pokusy so seekovaním zlyhali, skúšam záchranný fallback bez -ss.');
      try {
        for (let attempt = 1; attempt <= FRAME_EXTRACT_ATTEMPTS; attempt++) {
          try { frames.push(await extractFrameOnce(tmpIn, 0, [])); break; }
          catch (e) {
            console.warn(`moderation: záchranný fallback (pokus ${attempt}/${FRAME_EXTRACT_ATTEMPTS}) zlyhal: ${e.message}`);
            if (attempt < FRAME_EXTRACT_ATTEMPTS) await new Promise(r => setTimeout(r, 500 * attempt));
          }
        }
      } catch (e) { /* frames ostane prázdne, nižšie sa vyhodí finálna chyba */ }
    }
    if (!frames.length) throw new Error('žiadny snímok sa nepodarilo extrahovať ani po opakovaných pokusoch');
    return frames;
  } finally {
    fs.promises.unlink(tmpIn).catch(() => {});
  }
}

// Bežné bot-ochrany (Cloudflare a pod.) blokujú automatizované requesty aj
// pre úplne legitímne, reálne fungujúce stránky — to sa nesmie posudzovať
// rovnako ako skutočne mŕtvy/neexistujúci odkaz.
const BOT_PROTECTION_MARKERS = [
  'just a moment', 'cf-browser-verification', 'cf_chl_', 'checking your browser',
  'attention required! | cloudflare', 'enable javascript and cookies to continue',
  'ddos protection by', 'sorry, you have been blocked', '__cf_chl_'
];

function looksLikeBotProtection(html, res) {
  const lower = html.slice(0, 4000).toLowerCase();
  if (BOT_PROTECTION_MARKERS.some(m => lower.includes(m))) return true;
  const server = (res.headers && res.headers.get && res.headers.get('server')) || '';
  if (/cloudflare/i.test(server) && [403, 503, 429].includes(res.status)) return true;
  return false;
}

// Rýchly (max ~6s) jednorazový pokus stiahnuť a prezrieť cieľovú stránku —
// titulok, popis, viditeľný text (na odhalenie podvodu/nepovoleného obsahu
// skrytého za nevinne vyzerajúcim titulkom) a či nedošlo ku skrytému
// presmerovaniu inam. Nikdy nehádže — pri zlyhaní vráti reachable:false.
async function fetchLinkContext(linkUrl) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(linkUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'sk,cs;q=0.9,en;q=0.8'
      }
    });
    clearTimeout(t);
    const html = (await res.text()).slice(0, 60000);
    const botBlocked = looksLikeBotProtection(html, res);
    const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);
    const finalUrl = res.url || linkUrl;
    return {
      title: title.trim().slice(0, 200),
      description: desc.trim().slice(0, 300),
      bodyText,
      finalUrl,
      redirected: finalUrl !== linkUrl,
      // Bot-ochrana môže vrátiť non-ok status aj pre plne funkčnú stránku —
      // taký prípad sa nepovažuje za "neexistujúci/mŕtvy odkaz".
      reachable: res.ok || botBlocked,
      botBlocked
    };
  } catch (e) {
    return { title: '', description: '', bodyText: '', finalUrl: linkUrl, redirected: false, reachable: false, botBlocked: false };
  }
}

function buildPrompt(linkUrl, linkContext, frameCount) {
  const mediaLine = frameCount > 1
    ? `Priložených je ${frameCount} snímkov rovnomerne rozmiestnených naprieč celým videom (nie len úvodný záber) — posúď VŠETKY, zamietni ak čo i len jeden z nich porušuje pravidlá nižšie.`
    : `Priložený je obrázok reklamnej kreatívy.`;
  const redirectLine = linkContext.redirected
    ? `⚠️ Stránka pri načítaní presmerovala inam, na: ${linkContext.finalUrl} — over, či nejde o pokus schovať skutočný cieľ za nevinne vyzerajúcou URL.`
    : '';
  const botBlockedLine = linkContext.botBlocked
    ? `ℹ️ Stránku sa nepodarilo automatizovane načítať, lebo ju chráni bot-ochrana (napr. Cloudflare) — TOTO JE BEŽNÉ AJ PRE ÚPLNE LEGITÍMNE STRÁNKY a samo osebe to NIE JE dôvod na zamietnutie. Posudzuj hlavne podľa kreatívy, domény a toho, čo o cieli vieš.`
    : '';
  const reachabilityLine = linkContext.botBlocked
    ? 'Cieľová stránka dostupná: nedá sa automatizovane overiť (blokovaná bot-ochranou, pozri poznámku vyššie)'
    : `Cieľová stránka dostupná: ${linkContext.reachable ? 'áno' : 'nie'}`;
  return `Si kontrolór reklamného obsahu pre platformu vloženú do appky na prípravu na vysokoškolské prijímacie testy. Jej publikum sú najmä ľudia NA KONCI strednej školy alebo TESNE PO NEJ — typicky 17–20 rokov, teda blízko plnoletosti alebo už plnoletí, nie deti. Posudzuj primerane tomuto veku: bežný odvážny, drzý, sarkastický alebo štylisticky agresívny marketing (slang, výrazný vizuál, dvojzmyselný humor) je bežná a v poriadku vec v reklame cielenej na mladých dospelých — SAMO OSEBE to NIE JE dôvod na zamietnutie. Zamietaj len pri jasnom porušení konkrétnych pravidiel nižšie, nie pri hocičom, čo len pôsobí "drzo" alebo neformálne.

${mediaLine} Rovnako dôkladne posúď aj skutočný obsah cieľovej stránky nižšie — nielen kreatívu samotnú.

Cieľová URL: ${linkUrl}
${redirectLine}
${botBlockedLine}
Titulok cieľovej stránky: ${linkContext.title || '(nepodarilo sa načítať)'}
Popis cieľovej stránky: ${linkContext.description || '(nepodarilo sa načítať)'}
${reachabilityLine}
Viditeľný text cieľovej stránky (vzorka, môže byť orezaná): ${linkContext.bodyText || '(nepodarilo sa načítať obsah stránky)'}

ZAMIETNI (allowed:false), ak kreatíva ALEBO cieľová stránka:
- skutočne propaguje kúpu/konzumáciu alkoholu alebo tabaku/nikotínu, hazardné hry/stávkovanie, alebo obsahuje sexuálne explicitný/pornografický obsah (nie: len drzý/sugestívny marketingový štýl bez toho, aby reálne išlo o niektorú z týchto kategórií)
- je nelegálna, podvodná, klamlivá alebo zavádzajúca — napr. sľubuje nereálne výhry/výnosy, tlačí na urgentnú platbu alebo zadanie citlivých údajov, vyzerá ako falošná prihlasovacia/platobná stránka (phishing), alebo sa vydáva za inú známu značku/inštitúciu bez toho aby ňou reálne bola
- obsahuje skutočný nenávistný prejav, násilie alebo diskrimináciu (nie: sarkazmus, čierny humor alebo bežné "drzé" reklamné frázy)
- vedie na škodlivý softvér alebo inak nebezpečný cieľ
- zjavne porušuje autorské práva alebo ochranné známky (napr. falzifikáty)
- cieľová stránka je preukázateľne mŕtva/neexistujúca (NIE ak ju len blokuje bot-ochrana — pozri poznámku vyššie), alebo skryto presmerováva na iný, podozrivý cieľ
- viditeľný text stránky jasne nedáva zmysel vzhľadom na tému kreatívy (nesúlad medzi sľubovaným a skutočným obsahom) — ale ak text stránky chýba/nepodarilo sa načítať, toto sa neposudzuje ako dôvod na zamietnutie

DÔLEŽITÉ pravidlá pri rozhodovaní (prísne dodržuj):
- Kategóriu "alkohol" smieš priradiť LEN ak je na snímkoch SKUTOČNE VIDIEŤ konkrétny alkoholický produkt (fľaša/plechovka/pohár s rozpoznateľnou značkou alkoholu, logo pivovaru/liehovaru a pod.) alebo text explicitne hovorí o alkohole. Farebný tón (napr. červená), štylizácia videa, slovné hračky, skratky alebo "vibe" reklamy NIE SÚ dôkaz alkoholu — na základe samotného štýlu/nálady sa alkohol NIKDY neoznačuje.
- Ak sa cieľová stránka nedala automatizovane overiť (blokovaná bot-ochranou), toto ber ako NEUTRÁLNU, chýbajúcu informáciu — nie ako priťažujúcu okolnosť, ktorá by mala prispieť k zamietnutiu v kombinácii s iným neistým podozrením. Rozhoduj sa výhradne na základe toho, čo v kreatíve SKUTOČNE VIDÍŠ.
- Ak si pri akomkoľvek kritériu neistý/nemáš konkrétny dôkaz priamo v obraze alebo texte, rozhoduj v prospech POVOLENIA (allowed:true) — zamietnutie vyžaduje konkrétny, popísateľný dôvod, nie všeobecný dojem.

V opačnom prípade POVOĽ (allowed:true).

Odpovedz VÝHRADNE validným JSON objektom, nič iné, žiadny text okolo:
{"allowed": true alebo false, "category": "krátka kategória", "reason": "jedna veta vysvetlenia po slovensky"}`;
}

async function moderateContent({ buffer, mimeType, linkUrl }) {
  if (!ANTHROPIC_API_KEY) {
    return { allowed: false, category: 'config_error', reason: 'ANTHROPIC_API_KEY nie je nastavený — automatická kontrola nemôže bežať, preto sa nahrávanie zamieta pre istotu.' };
  }

  let imageBuffers, imageMediaType;
  try {
    if (mimeType === 'video/mp4') {
      imageBuffers = await extractFrames(buffer, 'mp4');
      imageMediaType = 'image/jpeg';
    } else if (mimeType === 'image/gif') {
      imageBuffers = await extractFrames(buffer, 'gif');
      imageMediaType = 'image/jpeg';
    } else {
      imageBuffers = [buffer];
      imageMediaType = mimeType;
    }
  } catch (e) {
    return { allowed: false, category: 'extraction_error', reason: `Nepodarilo sa extrahovať obraz z kreatívy na kontrolu (${e.message}) — zamietnuté pre istotu.` };
  }

  const linkContext = await fetchLinkContext(linkUrl);

  let res;
  try {
    for (let i = 0; i < MODEL_FALLBACK_CHAIN.length; i++) {
      const model = MODEL_FALLBACK_CHAIN[i];
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: [
              ...imageBuffers.map(buf => ({ type: 'image', source: { type: 'base64', media_type: imageMediaType, data: buf.toString('base64') } })),
              { type: 'text', text: buildPrompt(linkUrl, linkContext, imageBuffers.length) }
            ]
          }]
        }),
        signal: controller.signal
      });
      clearTimeout(t);
      if (res.ok) {
        if (i > 0) console.error(`⚠️ Claude model fallback: '${MODEL_FALLBACK_CHAIN[0]}' zlyhal, použitý '${model}'.`);
        break;
      }
      const errText = await res.text().catch(() => '');
      const looksLikeModelIssue = res.status === 404 || /model/i.test(errText);
      if (!looksLikeModelIssue || i === MODEL_FALLBACK_CHAIN.length - 1) {
        return { allowed: false, category: 'api_error', reason: `AI kontrola vrátila chybu ${res.status} — zamietnuté pre istotu.`, raw: errText.slice(0, 500) };
      }
    }
  } catch (e) {
    return { allowed: false, category: 'api_error', reason: `Volanie AI kontroly zlyhalo (${e.message}) — zamietnuté pre istotu.` };
  }

  const data = await res.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  let parsed;
  try {
    const match = text.match(/\{[\s\S]*\}/);
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

module.exports = { moderateContent };
