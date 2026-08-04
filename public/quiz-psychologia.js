/**
 * Testovací engine — príprava na prijímacie skúšky Psychológia UCM Trnava.
 * Vystavuje `state`, `showScreen`, `renderTest`, `finishTest` — app.js sa na
 * `finishTest` hookuje (ukladá výsledok na server, ak je user prihlásený).
 */

const SECTION_META = {
  biologia:    { name: 'Biológia človeka', icon: '🧬' },
  filozofia:   { name: 'Filozofia',        icon: '📜' },
  psychologia: { name: 'Psychológia',      icon: '🧠' },
};

const state = {
  mode: null,        // 'psych_full' | 'psych_biologia' | 'psych_filozofia' | 'psych_psychologia'
  section: null,      // 'full' | 'biologia' | 'filozofia' | 'psychologia'
  questions: [],
  currentIdx: 0,
  answers: {},         // { questionId: selectedOptionIndex }
  revealed: {},         // { questionId: true }
  startTime: null,
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function countBySection(section) {
  return window.PSYCH_QUESTIONS.filter(q => q.section === section).length;
}

// ═══════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => el.style.display = 'none');
  const el = document.getElementById('screen-' + name);
  if (el) el.style.display = 'block';
  if (name === 'home') renderHome();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderHome() {
  const grid = document.querySelector('.mode-grid');
  if (!grid) return;

  const cards = [
    { mode: 'full', icon: '🎓', title: 'Kompletný test', badge: null,
      desc: `30 náhodne vybraných otázok zo všetkých troch okruhov — simulácia ostrej prijímacej skúšky.` },
    { mode: 'biologia', icon: SECTION_META.biologia.icon, title: SECTION_META.biologia.name, badge: null,
      desc: `${countBySection('biologia')} otázok — orgánové sústavy, genetika, zdravý životný štýl.` },
    { mode: 'filozofia', icon: SECTION_META.filozofia.icon, title: SECTION_META.filozofia.name, badge: null,
      desc: `${countBySection('filozofia')} otázok — antika, stredovek, novovek, filozofia 20. storočia.` },
    { mode: 'psychologia', icon: SECTION_META.psychologia.icon, title: SECTION_META.psychologia.name, badge: null,
      desc: `${countBySection('psychologia')} otázok — smery, psychické procesy, osobnosť, vývin, stres.` },
  ];

  grid.innerHTML = cards.map(c => `
    <div class="mode-card" onclick="startQuiz('${c.mode}')">
      ${c.badge ? `<span class="card-badge">${c.badge}</span>` : ''}
      <span class="card-icon">${c.icon}</span>
      <div class="card-title">${c.title}</div>
      <div class="card-desc">${c.desc}</div>
    </div>
  `).join('');

  renderHistoryPanel();
}

function renderHistoryPanel() {
  const panel = document.getElementById('history-panel');
  if (!panel) return;
  const history = JSON.parse(localStorage.getItem('vsp_history') || '[]')
    .filter(h => typeof h.mode === 'string' && h.mode.startsWith('psych_'));

  if (!history.length) {
    panel.innerHTML = '';
    return;
  }

  const rows = history.slice(0, 5).map(h => {
    const sectionName = h.section === 'full' ? 'Kompletný test' : (SECTION_META[h.section]?.name || h.section);
    const date = new Date(h.date).toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `
      <div class="history-item">
        <span class="history-score">${h.score}%</span>
        <span class="history-meta">${sectionName} · ${h.correct}/${h.total} správne · ${date}</span>
      </div>`;
  }).join('');

  panel.innerHTML = `
    <div class="history-title">Posledné pokusy</div>
    <div class="history-list">${rows}</div>
  `;
}

// ═══════════════════════════════════════════
// TEST FLOW
// ═══════════════════════════════════════════
function startQuiz(section) {
  let pool;
  if (section === 'full') {
    pool = shuffle(window.PSYCH_QUESTIONS).slice(0, 30);
  } else {
    pool = shuffle(window.PSYCH_QUESTIONS.filter(q => q.section === section));
  }

  state.mode = 'psych_' + section;
  state.section = section;
  state.questions = pool;
  state.currentIdx = 0;
  state.answers = {};
  state.revealed = {};
  state.startTime = Date.now();

  showScreen('test');
  renderTest();
}

function renderTest() {
  const q = state.questions[state.currentIdx];
  const total = state.questions.length;
  const idx = state.currentIdx;
  const revealed = !!state.revealed[q.id];
  const selected = state.answers[q.id];

  document.getElementById('progress-label').textContent = `Otázka ${idx + 1} / ${total}`;
  document.getElementById('progress-bar').style.width = `${Math.round((idx / total) * 100)}%`;

  const letters = ['A', 'B', 'C', 'D'];
  const optionsHtml = q.options.map((opt, i) => {
    let cls = 'option-btn';
    if (revealed) {
      if (i === q.answer) cls += ' correct';
      else if (i === selected) cls += ' wrong';
      else cls += ' disabled';
    }
    return `
      <button class="${cls}" ${revealed ? 'disabled' : ''} onclick="selectAnswer(${i})">
        <span class="option-letter">${letters[i]}</span>
        <span class="option-text">${opt}</span>
      </button>`;
  }).join('');

  document.getElementById('test-content').innerHTML = `
    <div class="topic-tag">${SECTION_META[q.section].icon} ${q.topic}</div>
    <div class="question-box">${q.question}</div>
    <div class="options-list">${optionsHtml}</div>
    ${revealed ? `
      <div class="explanation-box">
        <strong>${selected === q.answer ? '✓ Správne.' : '✗ Nesprávne.'}</strong> ${q.explanation}
      </div>
      <div class="test-nav">
        <button class="btn-primary" onclick="nextQuestion()">${idx + 1 === total ? 'Zobraziť výsledky →' : 'Ďalšia otázka →'}</button>
      </div>
    ` : `
      <div class="test-nav">
        <button class="btn-ghost" onclick="skipQuestion()">Preskočiť</button>
      </div>
    `}
  `;
}

function selectAnswer(i) {
  const q = state.questions[state.currentIdx];
  if (state.revealed[q.id]) return;
  state.answers[q.id] = i;
  state.revealed[q.id] = true;
  renderTest();
}

function skipQuestion() {
  const q = state.questions[state.currentIdx];
  delete state.answers[q.id];
  goToNext();
}

function nextQuestion() {
  goToNext();
}

function goToNext() {
  if (state.currentIdx + 1 < state.questions.length) {
    state.currentIdx++;
    renderTest();
  } else {
    finishTest();
  }
}

// ═══════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════
function finishTest() {
  let correct = 0, wrong = 0, skipped = 0;
  state.questions.forEach(q => {
    const a = state.answers[q.id];
    if (a === undefined) skipped++;
    else if (a === q.answer) correct++;
    else wrong++;
  });

  const total = state.questions.length;
  const score = total ? Math.round((correct / total) * 100) : 0;
  const duration = Math.round((Date.now() - state.startTime) / 1000);

  const record = {
    mode: state.mode,
    section: state.section,
    score, correct, wrong, skipped, total,
    duration,
    answers: state.answers,
    date: new Date().toISOString(),
  };

  const history = JSON.parse(localStorage.getItem('vsp_history') || '[]');
  history.unshift(record);
  localStorage.setItem('vsp_history', JSON.stringify(history.slice(0, 50)));

  showScreen('result');
  renderResult(record);
}

function renderResult(record) {
  const sectionName = record.section === 'full' ? 'Kompletný test' : (SECTION_META[record.section]?.name || record.section);

  const reviewHtml = state.questions.map(q => {
    const a = state.answers[q.id];
    const status = a === undefined ? 'skipped' : (a === q.answer ? 'correct' : 'wrong');
    const statusLabel = status === 'skipped' ? 'Preskočené' : (status === 'correct' ? 'Správne' : 'Nesprávne');
    return `
      <div class="review-item ${status}">
        <div class="review-status">${statusLabel}</div>
        <div class="review-question">${q.question}</div>
        <div class="review-answer">Správna odpoveď: <strong>${q.options[q.answer]}</strong></div>
        <div class="review-explanation">${q.explanation}</div>
      </div>`;
  }).join('');

  document.getElementById('result-content').innerHTML = `
    <div class="result-summary">
      <div class="result-score">${record.score}%</div>
      <div class="result-title">${sectionName}</div>
      <div class="stat-row">
        <span class="stat-pill correct">✓ ${record.correct} správne</span>
        <span class="stat-pill wrong">✗ ${record.wrong} nesprávne</span>
        <span class="stat-pill skipped">— ${record.skipped} preskočené</span>
      </div>
      <div class="result-actions">
        <button class="btn-primary" onclick="startQuiz('${record.section}')">Skúsiť znova</button>
        <button class="btn-ghost" onclick="showScreen('home')">Späť na domovskú stránku</button>
      </div>
    </div>
    <div class="review-title">Prehľad otázok</div>
    <div class="review-list">${reviewHtml}</div>
  `;
}

// ═══════════════════════════════════════════
// ŠTART
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => showScreen('home'));
