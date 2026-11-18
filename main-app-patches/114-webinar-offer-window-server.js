// Serverová, na Google účet viazaná ponuka po webinári — nahrádza doterajší
// systém, kde bola CELÁ eligibilita aj deadline len cookie/localStorage na
// klientovi (/ponuka), a cenový režim (pricingMode) si klient posielal
// SÁM v tele checkout requestu bez akéhokoľvek overenia serverom. Vyžaduje
// najprv db/migrate_webinar_offer_window.sql.
//
// Zmeny:
// 1) POST /api/webinar/register teraz vyžaduje Google login (rovnaký
//    verifySupabaseToken helper ako /api/profile/exam-date) — email sa
//    berie VÝHRADNE z overenej session, nie z tela requestu. Termín
//    webinára (a teda aj koniec okna ponuky) sa počíta na serveri
//    (najbližší štvrtok 20:00 Europe/Bratislava), nie z klientom
//    poslaného slotStartMs — inak by okno bolo možné ľubovoľne posunúť.
// 2) Okno ponuky (offer_window_expires_at) sa nastaví LEN pri prvej
//    registrácii daného emailu, navždy — opätovná registrácia na ďalší
//    termín ho už nikdy neresetuje (rozhodnutie z konverzácie).
// 3) Nový GET /api/webinar/offer-status — jediný zdroj pravdy pre /ponuka
//    (getWebinarOfferStatus).
// 4) POST /api/membership/checkout: pre webinárovú cestu (bez tokenu)
//    teraz tiež vyžaduje Google login a pricingMode sa NIKDY neberie od
//    klienta — určuje ho výhradne getWebinarOfferStatus. Cesta cez token
//    (kariérny kvíz z /kam-na-vysoku) ostáva úplne nezmenená.
// 5) Webhook (membership_purchase): defense-in-depth kontrola, že
//    skutočne zaplatená suma zodpovedá cene pre uložený pricingMode
//    (logovanie, nie blokovanie — peniaze už boli prijaté v momente
//    vytvorenia checkout session, kedy sa pricingMode reálne vynútil).
const fs = require('fs');
const FILE = 'server.js';

// Atomický lock proti dvojitému súbežnému behu tohto patchu (napr. pri
// omylom dvakrát odoslanom deploy príkaze) — bez neho by dva procesy mohli
// obidva prejsť idempotency kontrolou nižšie (žiadny z nich by ešte
// nezapísal) a ich zápisy do server.js by sa mohli prekryť/poškodiť súbor.
const LOCK = FILE + '.114-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Zmaz LOCK subor rucne, ak si si isty ze nic nebezi, a skus znova. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('getWebinarOfferStatus')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Helper funkcie: server-computed termín + midnight + offer status ──
patched = replaceOnce(patched,
`function fmtWebinarSlot(slotStartMs) {
  const d = new Date(Number(slotStartMs));
  const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return days[d.getDay()] + ' ' + dd + '.' + mm + ' o ' + hh + ':00';
}`,
`function fmtWebinarSlot(slotStartMs) {
  const d = new Date(Number(slotStartMs));
  const days = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  return days[d.getDay()] + ' ' + dd + '.' + mm + ' o ' + hh + ':00';
}

// Rozdiel (v minútach) medzi UTC a Europe/Bratislava wall-clock časom v
// danom okamihu — potrebné, lebo server beží v UTC, ale webinár je vždy
// "štvrtok 20:00" v bratislavskom čase (DST-aware cez Intl).
function bratislavaOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Bratislava', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return (asUTC - date.getTime()) / 60000;
}

// Najbližší termín webinára (štvrtok 20:00 Europe/Bratislava), počítaný
// VÝHRADNE na serveri — nikdy sa neberie z klienta, inak by šlo okno
// ponuky (ktoré je od tohto termínu odvodené) ľubovoľne posunúť.
function computeNextWebinarSlotMs() {
  const SLOT_WEEKDAY = 4; // štvrtok
  const SLOT_HOUR = 20;
  const VIDEO_DURATION_MS = 45 * 60 * 1000;
  const now = new Date();
  const offsetMin = bratislavaOffsetMinutes(now);
  const nowBratislava = new Date(now.getTime() + offsetMin * 60000);
  const daysUntil = (SLOT_WEEKDAY - nowBratislava.getUTCDay() + 7) % 7;
  const targetBratislava = new Date(Date.UTC(nowBratislava.getUTCFullYear(), nowBratislava.getUTCMonth(), nowBratislava.getUTCDate() + daysUntil, SLOT_HOUR, 0, 0, 0));
  let targetUtcMs = targetBratislava.getTime() - offsetMin * 60000;
  if (targetUtcMs <= now.getTime()) {
    const elapsed = now.getTime() - targetUtcMs;
    if (!(daysUntil === 0 && elapsed < VIDEO_DURATION_MS)) {
      targetUtcMs += 7 * 24 * 60 * 60 * 1000;
    }
  }
  return targetUtcMs;
}

// 23:59:59.999 Europe/Bratislava toho istého kalendárneho dňa, na ktorý
// pripadá slotMs — toto je koniec okna ponuky.
function bratislavaMidnightAfterMs(slotMs) {
  const offsetMin = bratislavaOffsetMinutes(new Date(slotMs));
  const slotBratislava = new Date(slotMs + offsetMin * 60000);
  const midnightBratislava = new Date(Date.UTC(slotBratislava.getUTCFullYear(), slotBratislava.getUTCMonth(), slotBratislava.getUTCDate(), 23, 59, 59, 999));
  return midnightBratislava.getTime() - offsetMin * 60000;
}

// Jediný zdroj pravdy pre stav ponuky — používa ho status endpoint,
// checkout aj webhook. 'none' = email sa nikdy neregistroval na webinár.
async function getWebinarOfferStatus(email) {
  const { data: reg } = await supabase.from('webinar_registrations').select('offer_window_expires_at').eq('email', email).maybeSingle();
  if (!reg || !reg.offer_window_expires_at) return { eligible: false, state: 'none', expiresAt: null };
  const expiresAt = reg.offer_window_expires_at;
  const state = new Date(expiresAt).getTime() > Date.now() ? 'active' : 'expired';
  return { eligible: true, state, expiresAt };
}`,
  '1: helper funkcie');

// ── 2) POST /api/webinar/register — Google login povinný, termín server-side ──
patched = replaceOnce(patched,
`app.post('/api/webinar/register', rateLimit, async (req, res) => {
  try {
    const { name, email: rawEmail, slotStartMs } = req.body || {};
    const email = (rawEmail || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
    const slot = Number(slotStartMs);
    if (!slot || Math.abs(slot - Date.now()) > 9 * 24 * 60 * 60 * 1000) return res.status(400).json({ error: 'Neplatný termín.' });
    const confirmToken = require('crypto').randomBytes(24).toString('hex');
    const { data: reg, error } = await supabase.from('webinar_registrations').upsert({
      email,
      name: (name || '').toString().trim() || null,
      slot_start_ms: slot,
      confirm_token: confirmToken,
      confirmed_at: null,
      reminder_24h_sent_at: null,
      reminder_soon_sent_at: null,
      offer_sent_at: null
    }, { onConflict: 'email' }).select().single();
    if (error) throw error;
    const confirmUrl = WEBINAR_APP_URL + '/api/webinar/confirm?token=' + confirmToken;
    const unsubscribeUrl = WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + confirmToken;
    const html = fillWebinarTemplate(loadWebinarEmailTemplate('1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);
    sendMail({ to: email, subject: 'Potvrď účasť na vysielaní — SP Tréner', html }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('webinar register error:', err.message);
    res.status(500).json({ error: 'Chyba registrácie.' });
  }
});`,
`app.post('/api/webinar/register', rateLimit, async (req, res) => {
  try {
    const user = await verifySupabaseToken(req);
    if (!user) return res.status(401).json({ error: 'Musíš byť prihlásený cez Google.' });
    const email = (user.email || '').toString().trim().toLowerCase();
    const { name } = req.body || {};
    const slot = computeNextWebinarSlotMs();
    const confirmToken = require('crypto').randomBytes(24).toString('hex');

    const { data: existingReg } = await supabase.from('webinar_registrations').select('offer_window_expires_at').eq('email', email).maybeSingle();
    const upsertPayload = {
      email,
      name: (name || '').toString().trim() || null,
      slot_start_ms: slot,
      confirm_token: confirmToken,
      confirmed_at: null,
      reminder_24h_sent_at: null,
      reminder_soon_sent_at: null,
      offer_sent_at: null
    };
    // Okno ponuky sa nastaví LEN raz, pri úplne prvej registrácii tohto
    // emailu — ďalšia (opakovaná) registrácia na iný termín ho už nikdy
    // neresetuje ani neposunie.
    if (!existingReg || !existingReg.offer_window_expires_at) {
      upsertPayload.offer_window_started_at = new Date().toISOString();
      upsertPayload.offer_window_expires_at = new Date(bratislavaMidnightAfterMs(slot)).toISOString();
      console.log('🎟️ Webinárové okno ponuky začalo:', email, '→', upsertPayload.offer_window_expires_at);
    }

    const { data: reg, error } = await supabase.from('webinar_registrations').upsert(upsertPayload, { onConflict: 'email' }).select().single();
    if (error) throw error;
    const confirmUrl = WEBINAR_APP_URL + '/api/webinar/confirm?token=' + confirmToken;
    const unsubscribeUrl = WEBINAR_APP_URL + '/api/webinar/unsubscribe?token=' + confirmToken;
    const html = fillWebinarTemplate(loadWebinarEmailTemplate('1-potvrdenie-registracie.html'), {
      MENO: reg.name || '', TERMIN: fmtWebinarSlot(reg.slot_start_ms), UNSUBSCRIBE: unsubscribeUrl
    }).split('https://sptrener.online/webinar/live').join(confirmUrl);
    sendMail({ to: email, subject: 'Potvrď účasť na vysielaní — SP Tréner', html }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error('webinar register error:', err.message);
    res.status(500).json({ error: 'Chyba registrácie.' });
  }
});

// GET /api/webinar/offer-status — jediný zdroj pravdy pre /ponuka (nahrádza
// cookie/localStorage). Neprihlásený alebo nikdy neregistrovaný = 'none',
// čo frontend zobrazí ako bežnú (neakciovú) ponuku.
app.get('/api/webinar/offer-status', rateLimit, async (req, res) => {
  const user = await verifySupabaseToken(req);
  if (!user) return res.json({ state: 'none', expiresAt: null });
  const status = await getWebinarOfferStatus((user.email || '').toString().trim().toLowerCase());
  res.json({ state: status.state, expiresAt: status.expiresAt });
});`,
  '2: /api/webinar/register + offer-status');

// ── 3) POST /api/membership/checkout — webinárová cesta: Google login povinný, pricingMode výhradne server-side ──
patched = replaceOnce(patched,
`app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  let { email, tier, months, pricingMode, refCode } = req.body || {};
  const token = (req.body && req.body.token || '').toString();
  // Token z e-mailu po teste odboru — email aj cena SA NEDÔVERUJÚ klientovi,
  // vyriešia sa server-side z career_quiz_results (na rozdiel od pôvodnej
  // webinárovej cesty nižšie, ktorá token nepoužíva a ostáva nezmenená).
  if (token) {
    const resolved = await resolveQuizOfferToken(token);
    if (!resolved) return res.status(400).json({ error: 'Neplatný alebo expirovaný odkaz.' });
    email = resolved.email;
    pricingMode = resolved.expired ? 'classic' : 'promo';
  }
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });`,
`app.post('/api/membership/checkout', rateLimit, async (req, res) => {
  let { email, tier, months, pricingMode, refCode } = req.body || {};
  const token = (req.body && req.body.token || '').toString();
  // Token z e-mailu po teste odboru — email aj cena SA NEDÔVERUJÚ klientovi,
  // vyriešia sa server-side z career_quiz_results (na rozdiel od pôvodnej
  // webinárovej cesty nižšie, ktorá token nepoužíva a ostáva nezmenená).
  if (token) {
    const resolved = await resolveQuizOfferToken(token);
    if (!resolved) return res.status(400).json({ error: 'Neplatný alebo expirovaný odkaz.' });
    email = resolved.email;
    pricingMode = resolved.expired ? 'classic' : 'promo';
  } else {
    // Webinárová cesta (bez tokenu) — email aj pricingMode SA NEDÔVERUJÚ
    // klientovi vôbec, obe sa určia výhradne tu zo server-side stavu.
    const user = await verifySupabaseToken(req);
    if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
    email = (user.email || '').toString().trim().toLowerCase();
    const webinarOffer = await getWebinarOfferStatus(email);
    pricingMode = webinarOffer.state === 'active' ? 'promo' : 'classic';
    if (webinarOffer.state !== 'active') {
      console.log('⏳ Webinárová ponuka nie je aktívna (stav: ' + webinarOffer.state + '), účtuje sa bežná cena:', email);
    }
  }
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });`,
  '3: /api/membership/checkout webinárová vetva');

// ── 4) Checkout: pricingMode do Stripe metadata (aby ho webhook vedel spätne overiť) ──
patched = replaceOnce(patched,
  `      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths), refCode: (refCode || '').toString().toUpperCase() }`,
  `      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths), refCode: (refCode || '').toString().toUpperCase(), pricingMode: cleanPricingMode }`,
  '4: checkout session metadata pricingMode');

// ── 5) Webhook: defense-in-depth kontrola ceny + logovanie úspešnej akciovej aktivácie ──
patched = replaceOnce(patched,
`          console.log('✅ Členstvo aktivované:', membershipEmail, membershipTier, membershipMonths + 'm');
          if (session.metadata?.refCode) {`,
`          console.log('✅ Členstvo aktivované:', membershipEmail, membershipTier, membershipMonths + 'm');
          // Defense-in-depth: suma, ktorú Stripe reálne strhol, musí zodpovedať
          // cene pre pricingMode uložený v metadata (ten sa nastavil výhradne
          // server-side pri vytváraní checkout session, nie klientom) — nič to
          // neblokuje (peniaze už boli prijaté), len to zaloguje nezrovnalosť.
          const membershipPricingMode = session.metadata?.pricingMode === 'classic' ? 'classic' : 'promo';
          const membershipPriceTable = membershipPricingMode === 'classic' ? CLASSIC_MEMBERSHIP_PRICES : MEMBERSHIP_PRICES;
          const membershipExpectedCents = membershipPriceTable[membershipTier] && membershipPriceTable[membershipTier][membershipMonths];
          if (membershipExpectedCents != null && session.amount_total !== membershipExpectedCents) {
            console.error('⚠️ Nezhoda ceny pri aktivácii členstva — zaplatené', session.amount_total, 'očakávané', membershipExpectedCents, membershipEmail);
          } else if (membershipPricingMode === 'promo') {
            console.log('🎟️ Webinárová/akciová zľava uplatnená v platnom okne:', membershipEmail);
          }
          if (session.metadata?.refCode) {`,
  '5: webhook price consistency check');

const backup = FILE + '.pre-webinar-offer-window-server-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_webinar_offer_window.sql uz bezal (offer_window_started_at/offer_window_expires_at stlpce).');
