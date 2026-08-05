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
const MODERATION_MODEL = 'claude-haiku-4-5-20251001';
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

// Rýchly (max ~6s) jednorazový pokus stiahnuť a prezrieť cieľovú stránku —
// titulok, popis, viditeľný text (na odhalenie podvodu/nepovoleného obsahu
// skrytého za nevinne vyzerajúcim titulkom) a či nedošlo ku skrytému
// presmerovaniu inam. Nikdy nehádže — pri zlyhaní vráti reachable:false.
async function fetchLinkContext(linkUrl) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(linkUrl, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(t);
    const html = (await res.text()).slice(0, 60000);
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
      reachable: res.ok
    };
  } catch (e) {
    return { title: '', description: '', bodyText: '', finalUrl: linkUrl, redirected: false, reachable: false };
  }
}

function buildPrompt(linkUrl, linkContext, frameCount) {
  const mediaLine = frameCount > 1
    ? `Priložených je ${frameCount} snímkov rovnomerne rozmiestnených naprieč celým videom (nie len úvodný záber) — posúď VŠETKY, zamietni ak čo i len jeden z nich porušuje pravidlá nižšie.`
    : `Priložený je obrázok reklamnej kreatívy.`;
  const redirectLine = linkContext.redirected
    ? `⚠️ Stránka pri načítaní presmerovala inam, na: ${linkContext.finalUrl} — over, či nejde o pokus schovať skutočný cieľ za nevinne vyzerajúcou URL.`
    : '';
  return `Si prísny kontrolór reklamného obsahu pre platformu vloženú do vzdelávacej appky, ktorej publikum zahŕňa stredoškolákov (maloletých). ${mediaLine} Rovnako dôkladne posúď aj skutočný obsah cieľovej stránky nižšie — nielen kreatívu samotnú.

Cieľová URL: ${linkUrl}
${redirectLine}
Titulok cieľovej stránky: ${linkContext.title || '(nepodarilo sa načítať)'}
Popis cieľovej stránky: ${linkContext.description || '(nepodarilo sa načítať)'}
Cieľová stránka dostupná: ${linkContext.reachable ? 'áno' : 'nie'}
Viditeľný text cieľovej stránky (vzorka, môže byť orezaná): ${linkContext.bodyText || '(nepodarilo sa načítať obsah stránky)'}

ZAMIETNI (allowed:false), ak kreatíva ALEBO cieľová stránka:
- propaguje alkohol, tabak/nikotín, hazardné hry/stávkovanie, alebo obsahuje sexuálne explicitný/pornografický obsah
- je nelegálna, podvodná, klamlivá alebo zavádzajúca — napr. sľubuje nereálne výhry/výnosy, tlačí na urgentnú platbu alebo zadanie citlivých údajov, vyzerá ako falošná prihlasovacia/platobná stránka (phishing), alebo sa vydáva za inú známu značku/inštitúciu bez toho aby ňou reálne bola
- obsahuje nenávistný prejav, násilie alebo diskrimináciu
- vedie na škodlivý softvér alebo inak nebezpečný cieľ
- zjavne porušuje autorské práva alebo ochranné známky (napr. falzifikáty)
- cieľová stránka nie je dostupná (mŕtvy/nefunkčný odkaz), alebo skryto presmerováva na iný, podozrivý cieľ
- viditeľný text stránky nedáva zmysel vzhľadom na tému kreatívy (nesúlad medzi sľubovaným a skutočným obsahom)

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
        model: MODERATION_MODEL,
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
  } catch (e) {
    return { allowed: false, category: 'api_error', reason: `Volanie AI kontroly zlyhalo (${e.message}) — zamietnuté pre istotu.` };
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { allowed: false, category: 'api_error', reason: `AI kontrola vrátila chybu ${res.status} — zamietnuté pre istotu.`, raw: errText.slice(0, 500) };
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
