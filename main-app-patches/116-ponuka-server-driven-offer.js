// public/ponuka.html: nahrádza celú cookie/localStorage webinárovú
// eligibilitu/deadline (getCookie/setCookie/currentWebinarSlotKey/
// getDeadline/hasWebinarRegistration) volaním GET /api/webinar/offer-status
// (main-app-patches/114) — jediný zdroj pravdy je teraz server, viazaný na
// prihlásený Google účet. Kvíz-token cesta (initQuizOfferMode, z
// main-app-patches/95) ostáva úplne nezmenená — tento patch sa jej
// nedotýka. Vyžaduje, aby 114 už bol nasadený.
//
// POZOR: tento patch stavia na main-app-patches/95 (quiz token mode) — ak
// 95 ešte nebol nasadený, anchor pre bod 3 (init blok) nesedí a patch
// zlyhá s jasnou chybou, nič nezmení.
const fs = require('fs');
const FILE = 'public/ponuka.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('fetchWebinarOfferStatus')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Nahraď cookie-based deadline logiku server-driven verziou ──
patched = replaceOnce(patched,
`// Ponuka končí vždy o 23:59:59 dňa, kedy návštevník prišiel PRVÝKRÁT —
// zapamätané cez cookie (nie localStorage), nech to prežije aj vymazanie
// site dát, ktoré niekedy nechá cookies bokom.
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
function setCookie(name, value, expiresDate) {
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expiresDate.toUTCString() + '; path=/; SameSite=Lax';
}
// Webinár je týždenný (každý štvrtok) — bez tohto by si niekto, kto sa
// zaregistruje znova o týždeň neskôr, priniesol starú (už dávno prepadnutú)
// cookie a akciu by už nikdy nedostal. Preto sa deadline cookie viaže na
// konkrétny termín (slotStartMs) z aktuálnej registrácie: nová registrácia
// na iný termín = nový odpočet; opakovaná návšteva v rámci toho istého
// termínu = ten istý (už bežiaci/prepadnutý) odpočet ostáva.
function currentWebinarSlotKey() {
  try {
    const raw = localStorage.getItem('sp_webinar_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session && session.slotStartMs ? String(session.slotStartMs) : null;
  } catch (e) { return null; }
}
function getDeadline() {
  const slotKey = currentWebinarSlotKey();
  const stored = getCookie('sp_offer_deadline');
  const parts = stored ? stored.split('|') : [];
  const storedSlotKey = parts.length > 1 ? parts[0] : null;
  let deadline = parts.length > 1 ? parts[1] : null;
  if (!deadline || storedSlotKey !== slotKey) {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    deadline = String(endOfDay.getTime());
    // cookie samotná nech vydrží pár dní navyše — hodnota v nej (koniec
    // dňa prvej návštevy k danému termínu) je to, čo skutočne určuje odpočet, nie expirácia cookie.
    const cookieExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setCookie('sp_offer_deadline', slotKey + '|' + deadline, cookieExpiry);
  }
  return Number(deadline);
}
function tickClock() {
  const remaining = getDeadline() - Date.now();
  if (remaining <= 0) { enterExpiredMode(); return; }
  const clockEl = document.getElementById('clock');
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  clockEl.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}`,
`// Ponuka a jej deadline sú teraz VÝHRADNE server-side (getWebinarOfferStatus
// v server.js) — /api/webinar/offer-status je jediný zdroj pravdy, viazaný
// na prihlásený Google účet, nie na cookie/localStorage v tomto prehliadači.
// Časovač nižšie je len ZOBRAZENIE, nie zdroj pravdy.
let webinarOfferExpiresMs = null;
async function fetchWebinarOfferStatus() {
  const { data: { session } } = await _supabase.auth.getSession();
  const headers = session ? { 'Authorization': 'Bearer ' + session.access_token } : {};
  const res = await fetch('/api/webinar/offer-status', { headers });
  return res.json();
}
function tickClock() {
  const remaining = webinarOfferExpiresMs - Date.now();
  if (remaining <= 0) { enterExpiredMode(); return; }
  const clockEl = document.getElementById('clock');
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  clockEl.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}`,
  '1: cookie deadline -> server-driven');

// ── 2) Odstráň hasWebinarRegistration() (nahradené server-driven volaním nižšie) ──
patched = replaceOnce(patched,
`// Akciová cena patrí len tým, čo prešli cez /webinar registráciu (rovnaké
// localStorage, rovnaká doména) — kto príde na /ponuka priamo bez toho,
// vidí rovno stav "po vypršaní" (bežná cena, žiadne bonusy).
function hasWebinarRegistration() {
  try { return !!localStorage.getItem('sp_webinar_session'); }
  catch (e) { return false; }
}

setLang(lang);`,
`setLang(lang);`,
  '2: odstranenie hasWebinarRegistration');

// ── 3) Init blok: nahraď hasWebinarRegistration() vetvu server-driven statusom ──
patched = replaceOnce(patched,
`(async () => {
  const isQuizMode = await initQuizOfferMode();
  if (isQuizMode) return;
  if (hasWebinarRegistration()) {
    setInterval(tickClock, 1000);
    tickClock();
  } else {
    enterExpiredMode();
  }
})();`,
`(async () => {
  const isQuizMode = await initQuizOfferMode();
  if (isQuizMode) return;
  try {
    const status = await fetchWebinarOfferStatus();
    if (status.state === 'active' && status.expiresAt) {
      webinarOfferExpiresMs = new Date(status.expiresAt).getTime();
      setInterval(tickClock, 1000);
      tickClock();
    } else {
      enterExpiredMode();
    }
  } catch (e) {
    enterExpiredMode();
  }
})();`,
  '3: init blok server-driven status');

const backup = FILE + '.pre-ponuka-server-driven-offer-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
