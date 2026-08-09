const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('chooserSection')) {
  console.error('Uz je aplikovane (najdene chooserSection), nic som nezmenil.');
  process.exit(1);
}

// ── 1) Insert the picker section right after the hero, before social proof ─
const HERO_OLD = `</section>

<!-- SOCIAL PROOF STRIP -->`;
const CHOOSER_HTML = `</section>

<!-- CHOOSER -->
<div class="chooser-section reveal" id="chooserSection">
  <style>
  .chooser-wrap{max-width:1100px;margin:0 auto;padding:5rem 2rem;text-align:center}
  .chooser-label{font-family:var(--mono);font-size:11px;letter-spacing:.25em;color:var(--volt);text-transform:uppercase;margin-bottom:1rem}
  .chooser-title{font-family:var(--serif);font-size:clamp(1.8rem,3.5vw,2.6rem);margin-bottom:2.5rem}
  .chooser-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem;text-align:left}
  .chooser-card{background:rgba(15,15,24,.6);border:1px solid var(--border);border-radius:16px;padding:1.75rem;cursor:pointer;transition:all .2s;text-decoration:none;color:inherit;display:block}
  .chooser-card:hover{border-color:var(--border2);transform:translateY(-3px)}
  .chooser-card .icon{font-size:1.8rem;margin-bottom:.9rem;display:block}
  .chooser-card h3{font-size:1.05rem;margin-bottom:.5rem}
  .chooser-card p{color:var(--text2);font-size:.85rem;line-height:1.55;margin-bottom:1.1rem}
  .chooser-card .go{font-family:var(--mono);font-size:.76rem;color:var(--volt);font-weight:700}
  @media(max-width:860px){.chooser-grid{grid-template-columns:1fr}}
  </style>
  <div class="chooser-wrap">
    <div class="chooser-label" id="chooserLabel">Čo hľadáš?</div>
    <h2 class="chooser-title" id="chooserTitle">Vyber si, kade začneš</h2>
    <div class="chooser-grid">
      <div class="chooser-card" onclick="openPremiumPopup()">
        <span class="icon">🎯</span>
        <h3 id="chooserAppTitle">Tréner na testy (appka)</h3>
        <p id="chooserAppDesc">Neobmedzené AI testy, analýza slabých miest, 3 zadarmo hneď teraz.</p>
        <span class="go" id="chooserAppGo">Spustiť prvý test →</span>
      </div>
      <a class="chooser-card" href="/kurzy">
        <span class="icon">🎓</span>
        <h3 id="chooserCourseTitle">Online kurz</h3>
        <p id="chooserCourseDesc">Štruktúrované lekcie krok za krokom, s AI hodnotením tvojich úloh.</p>
        <span class="go" id="chooserCourseGo">Pozrieť kurzy →</span>
      </a>
      <div class="chooser-card" onclick="openPremiumPopup()">
        <span class="icon">⚡</span>
        <h3 id="chooserBothTitle">Appka + kurz</h3>
        <p id="chooserBothDesc">Začni appkou, kurz si vieš pridať kedykoľvek v ponuke Kurzy.</p>
        <span class="go" id="chooserBothGo">Začať appkou →</span>
      </div>
    </div>
  </div>
</div>

<!-- SOCIAL PROOF STRIP -->`;
if (!src.includes(HERO_OLD)) { console.error('Nenasiel som kotvu za hero sekciou. Nic som nezmenil.'); process.exit(1); }

// ── 2) New translation keys (SK) ────────────────────────────────────────
const SK_OLD = `const translations={
sk:{`;
const SK_NEW = `const translations={
sk:{
  chooserLabel:'Čo hľadáš?',chooserTitle:'Vyber si, kade začneš',
  chooserAppTitle:'Tréner na testy (appka)',chooserAppDesc:'Neobmedzené AI testy, analýza slabých miest, 3 zadarmo hneď teraz.',chooserAppGo:'Spustiť prvý test →',
  chooserCourseTitle:'Online kurz',chooserCourseDesc:'Štruktúrované lekcie krok za krokom, s AI hodnotením tvojich úloh.',chooserCourseGo:'Pozrieť kurzy →',
  chooserBothTitle:'Appka + kurz',chooserBothDesc:'Začni appkou, kurz si vieš pridať kedykoľvek v ponuke Kurzy.',chooserBothGo:'Začať appkou →',`;
if (!src.includes(SK_OLD)) { console.error('Nenasiel som sk:{ kotvu. Nic som nezmenil.'); process.exit(1); }

// ── 3) New translation keys (CS) ────────────────────────────────────────
const CS_OLD = `cs:{`;
const CS_NEW = `cs:{
  chooserLabel:'Co hledáš?',chooserTitle:'Vyber si, kudy začneš',
  chooserAppTitle:'Trenér na testy (aplikace)',chooserAppDesc:'Neomezené AI testy, analýza slabých míst, 3 zdarma hned teď.',chooserAppGo:'Spustit první test →',
  chooserCourseTitle:'Online kurz',chooserCourseDesc:'Strukturované lekce krok za krokem, s AI hodnocením tvých úkolů.',chooserCourseGo:'Podívat se na kurzy →',
  chooserBothTitle:'Aplikace + kurz',chooserBothDesc:'Začni aplikací, kurz si můžeš přidat kdykoliv v nabídce Kurzy.',chooserBothGo:'Začít aplikací →',`;
const csCount = src.split(CS_OLD).length - 1;
if (csCount !== 1) { console.error('cs:{ kotva nie je jednoznacna (najdenych: ' + csCount + '). Nic som nezmenil.'); process.exit(1); }

// ── 4) Wire the new keys into applyLanguage() ───────────────────────────
const APPLY_OLD = `  sT('heroBtn1', t.heroBtn1);
  sT('heroBtn2', t.heroBtn2);`;
const APPLY_NEW = `  sT('heroBtn1', t.heroBtn1);
  sT('heroBtn2', t.heroBtn2);
  sT('chooserLabel', t.chooserLabel); sT('chooserTitle', t.chooserTitle);
  sT('chooserAppTitle', t.chooserAppTitle); sT('chooserAppDesc', t.chooserAppDesc); sT('chooserAppGo', t.chooserAppGo);
  sT('chooserCourseTitle', t.chooserCourseTitle); sT('chooserCourseDesc', t.chooserCourseDesc); sT('chooserCourseGo', t.chooserCourseGo);
  sT('chooserBothTitle', t.chooserBothTitle); sT('chooserBothDesc', t.chooserBothDesc); sT('chooserBothGo', t.chooserBothGo);`;
if (!src.includes(APPLY_OLD)) { console.error('Nenasiel som applyLanguage kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(HERO_OLD, CHOOSER_HTML)
  .replace(SK_OLD, SK_NEW)
  .replace(CS_OLD, CS_NEW)
  .replace(APPLY_OLD, APPLY_NEW);

const backup = FILE + '.pre-chooser-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
