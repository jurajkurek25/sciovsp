// Na výsledku testu "Kam na vysokú" pri odbore psychológia pridá popri
// existujúcej appkovej ponuke (tá ostáva pre všetky odbory nezmenená) aj
// samostatný kurz "Príprava na bakalárske štúdium psychológie".
const fs = require('fs');
const FILE = 'public/kam-na-vysoku.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('psychCourseUpsell')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Nový HTML blok za existujúcim .upsell ──
patched = replaceOnce(patched,
  `    <div class="retake"><button onclick="retakeQuiz()" id="tRetake">↺ Spraviť test znova</button></div>`,
  `    <div class="upsell" id="psychCourseUpsell" style="display:none">
      <h3 id="tPsychCourseTitle">Ideš na psychológiu? Máme pre teba aj samostatný kurz</h3>
      <p id="tPsychCourseDesc">Okrem prípravy na všeobecné študijné predpoklady ponúkame aj kurz zameraný priamo na psychológiu — filozofiu, dejiny odboru a to, čo sa reálne pýta pri prijímačkách.</p>
      <div class="upsell-row">
        <a class="btn-secondary" href="https://sptrener.online/kurzy/priprava-na-bakalarke-studium-psychologie" id="ctaPsychCourse">Pozrieť kurz →</a>
      </div>
    </div>

    <div class="retake"><button onclick="retakeQuiz()" id="tRetake">↺ Spraviť test znova</button></div>`,
  '1: HTML blok');

// ── 2) i18n kľúče SK ──
patched = replaceOnce(patched,
  `    ctaFree:'Skús zadarmo →', ctaPremium:'Pozrieť Premium/Elite', retake:'↺ Spraviť test znova',
    faqTitle:'Časté otázky',`,
  `    ctaFree:'Skús zadarmo →', ctaPremium:'Pozrieť Premium/Elite', retake:'↺ Spraviť test znova',
    psychCourseTitle:'Ideš na psychológiu? Máme pre teba aj samostatný kurz',
    psychCourseDesc:'Okrem prípravy na všeobecné študijné predpoklady ponúkame aj kurz zameraný priamo na psychológiu — filozofiu, dejiny odboru a to, čo sa reálne pýta pri prijímačkách.',
    ctaPsychCourse:'Pozrieť kurz →',
    faqTitle:'Časté otázky',`,
  '2: T.sk kluce');

// ── 3) i18n kľúče CZ ──
patched = replaceOnce(patched,
  `    ctaFree:'Zkus zdarma →', ctaPremium:'Podívat se na Premium/Elite', retake:'↺ Udělat test znovu',
    faqTitle:'Časté otázky',`,
  `    ctaFree:'Zkus zdarma →', ctaPremium:'Podívat se na Premium/Elite', retake:'↺ Udělat test znovu',
    psychCourseTitle:'Jdeš na psychologii? Máme pro tebe i samostatný kurz',
    psychCourseDesc:'Kromě přípravy na všeobecné studijní předpoklady nabízíme i kurz zaměřený přímo na psychologii — filozofii, dějiny oboru a to, co se reálně ptá u přijímaček.',
    ctaPsychCourse:'Podívat se na kurz →',
    faqTitle:'Časté otázky',`,
  '3: T.cs kluce');

// ── 4) setLang(): aplikuj nove texty ──
patched = replaceOnce(patched,
  `  document.getElementById('ctaFree').textContent = t.ctaFree;
  document.getElementById('ctaPremium').textContent = t.ctaPremium;
  document.getElementById('tRetake').textContent = t.retake;`,
  `  document.getElementById('ctaFree').textContent = t.ctaFree;
  document.getElementById('ctaPremium').textContent = t.ctaPremium;
  document.getElementById('tPsychCourseTitle').textContent = t.psychCourseTitle;
  document.getElementById('tPsychCourseDesc').textContent = t.psychCourseDesc;
  document.getElementById('ctaPsychCourse').textContent = t.ctaPsychCourse;
  document.getElementById('tRetake').textContent = t.retake;`,
  '4: setLang aplikacia');

// ── 5) renderResultUI(): zobraz/skry blok podla topTag ──
patched = replaceOnce(patched,
  `  document.getElementById('ctaFree').href = '/app?cat='+appCat+'&upgrade=free';
  document.getElementById('ctaPremium').href = '/app?cat='+appCat+'&upgrade=premium';

  return topTag;`,
  `  document.getElementById('ctaFree').href = '/app?cat='+appCat+'&upgrade=free';
  document.getElementById('ctaPremium').href = '/app?cat='+appCat+'&upgrade=premium';

  // Popri appke (ponúkanej vždy) pre psychológiu navyše ponúkni aj
  // samostatný kurz priamo na tento odbor.
  document.getElementById('psychCourseUpsell').style.display = topTag === 'psych' ? 'block' : 'none';

  return topTag;`,
  '5: renderResultUI toggle');

const backup = FILE + '.pre-psych-course-upsell-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
