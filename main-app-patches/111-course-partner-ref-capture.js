// Kurzová stránka (kurz-detail.js) doteraz nezachytávala ?ref= partnerský
// odkaz vôbec — partner_ref sessionStorage sa dovtedy nastavoval len na
// index.html/webinar.html. Priamy odkaz partnera na konkrétny kurz by tak
// stratil atribúciu úplne. Tento patch pridáva rovnaký capture-snippet ako
// v index.html/webinar.html a posiela partnerRefCode do checkout requestu
// (samostatné pole, NEZAMIEŇAŤ s existujúcim "ref" — to je referral kód
// INŠTRUKTORA vlastného kurzu, iný mechanizmus, viď 73-course-discount-and-
// revenue-split.js). Vyžaduje aj 110-course-partner-commission.js na strane
// servera (spracovanie partnerRefCode v checkout + webhooku).
const fs = require('fs');
const FILE = 'public/kurz-detail.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('partnerRefCode')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Zachytenie ?ref= priamo na stránke kurzu (rovnaký princíp ako index.html/webinar.html) ──
patched = replaceOnce(patched,
  `  const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const scriptEl = document.currentScript;`,
  `  const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Partnerský ?ref= odkaz priamo na kurz (predtým sa zachytával len na
  // index.html/webinar.html — priamy odkaz na konkrétny kurz by inak
  // stratil atribúciu úplne).
  (function captureRef() {
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (!ref) return;
    sessionStorage.setItem('partner_ref', ref.toUpperCase());
  })();

  const scriptEl = document.currentScript;`,
  '1: ref capture snippet');

// ── 2) Checkout: posli partnerRefCode (oddelene od existujuceho instruktorskeho "ref") ──
patched = replaceOnce(patched,
  `    const ref = new URLSearchParams(location.search).get('ref') || undefined;
    try {
      const res = await fetch('/api/courses/' + slug + '/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, discountCode, ref })
      });`,
  `    const ref = new URLSearchParams(location.search).get('ref') || undefined;
    const partnerRefCode = sessionStorage.getItem('partner_ref') || undefined;
    try {
      const res = await fetch('/api/courses/' + slug + '/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, discountCode, ref, partnerRefCode })
      });`,
  '2: checkout body partnerRefCode');

const backup = FILE + '.pre-course-partner-ref-capture-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
