const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('SP Tréner — AI príprava na prijímačky')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

patched = replaceOnce(patched,
  '<title>SP Tréner — SCIO + AI</title>',
  '<title>SP Tréner — AI príprava na prijímačky</title>',
  'title tag');

patched = replaceOnce(patched,
  '<span class="logo-tag" data-i18n="logoTag">SP TRÉNER · SCIO + AI</span>',
  '<span class="logo-tag" data-i18n="logoTag">SP TRÉNER · AI PRÍPRAVA</span>',
  'logo-tag raw');

patched = replaceOnce(patched,
  '<div class="mode-card" onclick="startMode(\'full\')"><span class="card-badge" data-i18n="badgeRecommended">Odporúčané</span><span class="card-icon">⏱</span><div class="card-title" data-i18n="modeFullTitle">Celý test (na čas)</div><div class="card-desc" data-i18n="modeFullDesc">Verbálna (35 min) + Analytická (45 min). Presná simulácia SCIO.</div></div>',
  '<div class="mode-card" onclick="startMode(\'full\')"><span class="card-badge" data-i18n="badgeRecommended">Odporúčané</span><span class="card-icon">⏱</span><div class="card-title" data-i18n="modeFullTitle">Celý test (na čas)</div><div class="card-desc" data-i18n="modeFullDesc">Verbálna (35 min) + Analytická (45 min). Presná simulácia ostrého testu.</div></div>',
  'mode-full-desc raw');

patched = replaceOnce(patched,
  '<div class="mode-card ai-card" onclick="showScreen(\'ai-gen\')"><span class="card-badge ai-badge">✨ AI NOVÉ</span><span class="card-icon">🤖</span><div class="card-title" data-i18n="modeAIGenTitle">AI Generátor úloh</div><div class="card-desc" data-i18n="modeAIGenDesc">Claude AI vygeneruje nové SCIO-štýlové úlohy presne pre tvoje slabé miesta.</div></div>',
  '<div class="mode-card ai-card" onclick="showScreen(\'ai-gen\')"><span class="card-badge ai-badge">✨ AI NOVÉ</span><span class="card-icon">🤖</span><div class="card-title" data-i18n="modeAIGenTitle">AI Generátor úloh</div><div class="card-desc" data-i18n="modeAIGenDesc">Claude AI vygeneruje nové úlohy v štýle testu presne pre tvoje slabé miesta.</div></div>',
  'mode-ai-gen-desc raw');

patched = replaceOnce(patched,
  '<span>→ Neobmedzené SCIO simulácie</span>',
  '<span>→ Neobmedzené simulácie testu</span>',
  'elite plan feats');

patched = replaceOnce(patched,
  '<div class="ai-gen-title"><div class="ai-pulse"></div><span data-i18n="aiGenTitle">AI Generátor SCIO úloh</span></div>',
  '<div class="ai-gen-title"><div class="ai-pulse"></div><span data-i18n="aiGenTitle">AI Generátor úloh</span></div>',
  'ai-gen-title raw');

patched = replaceOnce(patched,
  '<div class="ai-gen-subtitle" data-i18n="aiGenSubtitle">Claude AI vytvorí nové úlohy v štýle oficiálnych SCIO testov</div>',
  '<div class="ai-gen-subtitle" data-i18n="aiGenSubtitle">Claude AI vytvorí nové úlohy v štýle oficiálneho testu</div>',
  'ai-gen-subtitle raw');

patched = replaceOnce(patched,
  '<div class="loading-step active" id="step1"><div class="step-dot"></div><span data-i18n="step1">Zostavujem SCIO prompt...</span></div>',
  '<div class="loading-step active" id="step1"><div class="step-dot"></div><span data-i18n="step1">Zostavujem prompt...</span></div>',
  'step1 raw');

// ── TRANSLATIONS.sk ─────────────────────────────────────────────────────
patched = replaceOnce(patched,
  L(
    "    logoTag:'SP TRÉNER · SCIO + AI',homeTitle:'Dostaň sa<br>na <span>percentil 85</span>',"
  ),
  L(
    "    logoTag:'SP TRÉNER · AI PRÍPRAVA',homeTitle:'Dostaň sa<br>na <span>percentil 85</span>',"
  ),
  'sk logoTag');

patched = replaceOnce(patched,
  "    badgeRecommended:'Odporúčané',modeFullTitle:'Celý test (na čas)',modeFullDesc:'Verbálna (35 min) + Analytická (45 min). Presná simulácia SCIO.',",
  "    badgeRecommended:'Odporúčané',modeFullTitle:'Celý test (na čas)',modeFullDesc:'Verbálna (35 min) + Analytická (45 min). Presná simulácia ostrého testu.',",
  'sk modeFullDesc');

patched = replaceOnce(patched,
  "    modeAIGenTitle:'AI Generátor úloh',modeAIGenDesc:'Claude AI vygeneruje nové SCIO-štýlové úlohy.',",
  "    modeAIGenTitle:'AI Generátor úloh',modeAIGenDesc:'Claude AI vygeneruje nové úlohy v štýle testu.',",
  'sk modeAIGenDesc');

patched = replaceOnce(patched,
  "    aiGenTitle:'AI Generátor SCIO úloh',aiGenSubtitle:'Claude AI vytvorí nové úlohy v štýle oficiálnych SCIO testov',",
  "    aiGenTitle:'AI Generátor úloh',aiGenSubtitle:'Claude AI vytvorí nové úlohy v štýle oficiálneho testu',",
  'sk aiGenTitle/aiGenSubtitle');

patched = replaceOnce(patched,
  "    step1:'Zostavujem SCIO prompt...',step2:'AI generuje úlohy...',step3:'Validujem formát...',step4:'Pridávam do banky...',",
  "    step1:'Zostavujem prompt...',step2:'AI generuje úlohy...',step3:'Validujem formát...',step4:'Pridávam do banky...',",
  'sk step1');

patched = replaceOnce(patched,
  "    scioDatePrompt:'Zadaj dátum tvojho SCIO testu (formát: RRRR-MM-DD):',",
  "    scioDatePrompt:'Zadaj dátum tvojho testu (formát: RRRR-MM-DD):',",
  'sk scioDatePrompt');

patched = replaceOnce(patched,
  "    scioDateSavedLocal:'📅 Dátum uložený lokálne.',scioDateSet:'📅 Dátum SCIO testu nastavený.',",
  "    scioDateSavedLocal:'📅 Dátum uložený lokálne.',scioDateSet:'📅 Dátum testu nastavený.',",
  'sk scioDateSet');

patched = replaceOnce(patched,
  "    toSCIO:'do tvojho SCIO testu',setDateCTA:'Nastav dátum SCIO testu',",
  "    toSCIO:'do tvojho testu',setDateCTA:'Nastav dátum testu',",
  'sk toSCIO/setDateCTA');

// ── TRANSLATIONS.cz ─────────────────────────────────────────────────────
patched = replaceOnce(patched,
  "    logoTag:'SP TRENÉR · SCIO + AI',homeTitle:'Dostaň se<br>na <span>percentil 85</span>',",
  "    logoTag:'SP TRENÉR · AI PŘÍPRAVA',homeTitle:'Dostaň se<br>na <span>percentil 85</span>',",
  'cz logoTag');

patched = replaceOnce(patched,
  "    badgeRecommended:'Doporučeno',modeFullTitle:'Celý test (na čas)',modeFullDesc:'Verbální (35 min) + Analytická (45 min). Přesná simulace SCIO.',",
  "    badgeRecommended:'Doporučeno',modeFullTitle:'Celý test (na čas)',modeFullDesc:'Verbální (35 min) + Analytická (45 min). Přesná simulace ostrého testu.',",
  'cz modeFullDesc');

patched = replaceOnce(patched,
  "    modeAIGenTitle:'AI Generátor úkolů',modeAIGenDesc:'Claude AI vygeneruje nové SCIO úkoly.',",
  "    modeAIGenTitle:'AI Generátor úkolů',modeAIGenDesc:'Claude AI vygeneruje nové úkoly ve stylu testu.',",
  'cz modeAIGenDesc');

patched = replaceOnce(patched,
  "    aiGenTitle:'AI Generátor SCIO úkolů',aiGenSubtitle:'Claude AI vytvoří nové úkoly ve stylu oficiálních SCIO testů',",
  "    aiGenTitle:'AI Generátor úkolů',aiGenSubtitle:'Claude AI vytvoří nové úkoly ve stylu oficiálního testu',",
  'cz aiGenTitle/aiGenSubtitle');

patched = replaceOnce(patched,
  "    step1:'Sestavuji SCIO prompt...',step2:'AI generuje úkoly...',step3:'Validuji formát...',step4:'Přidávám do banky úkolů...',",
  "    step1:'Sestavuji prompt...',step2:'AI generuje úkoly...',step3:'Validuji formát...',step4:'Přidávám do banky úkolů...',",
  'cz step1');

patched = replaceOnce(patched,
  "    scioDatePrompt:'Zadej datum tvého SCIO testu (formát: RRRR-MM-DD):',",
  "    scioDatePrompt:'Zadej datum tvého testu (formát: RRRR-MM-DD):',",
  'cz scioDatePrompt');

patched = replaceOnce(patched,
  "    scioDateSavedLocal:'📅 Datum uloženo lokálně.',scioDateSet:'📅 Datum SCIO testu nastaveno.',",
  "    scioDateSavedLocal:'📅 Datum uloženo lokálně.',scioDateSet:'📅 Datum testu nastaveno.',",
  'cz scioDateSet');

patched = replaceOnce(patched,
  "    toSCIO:'do tvého SCIO testu',setDateCTA:'Nastav datum SCIO testu',",
  "    toSCIO:'do tvého testu',setDateCTA:'Nastav datum testu',",
  'cz toSCIO/setDateCTA');

// ── misc ────────────────────────────────────────────────────────────────
patched = replaceOnce(patched,
  "        explanation:q.explanation||'Správna odpoveď podľa SCIO kritérií.',",
  "        explanation:q.explanation||'Správna odpoveď podľa oficiálnych kritérií.',",
  'ai explanation default');

patched = replaceOnce(patched,
  '<div class="am-logo">SCIO · Individuálna analýza</div>',
  '<div class="am-logo">Individuálna analýza</div>',
  'am-logo');

patched = replaceOnce(patched,
  "  const shareText = 'Cvič SCIO testy s AI! Použi môj kód ' + _refCode + ' a dostaneš +14 dní Premium zadarmo. sptrener.online';",
  "  const shareText = 'Cvič prijímacie testy s AI! Použi môj kód ' + _refCode + ' a dostaneš +14 dní Premium zadarmo. sptrener.online';",
  'shareText');

patched = replaceOnce(patched,
  "      desc:'Spusti celý SCIO test s časomieru. Nezaoberaj sa výsledkom — dnes len mapujeme tvoj štartový bod.',",
  "      desc:'Spusti celý test s časomieru. Nezaoberaj sa výsledkom — dnes len mapujeme tvoj štartový bod.',",
  'onboarding coach desc');

const backup = FILE + '.pre-remove-scio-branding-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
