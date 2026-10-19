/**
 * VSP Tréner — Auth & Subscription Layer
 * Vložiť pred </body> do index.html
 * Spravuje: login, registráciu, paywall, AI generátor
 */

const API = window.location.origin + '/api';
let currentUser = null;

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function initAuth() {
  const token = localStorage.getItem('vsp_token');
  if (!token) {
    renderAuthModal('login');
    return;
  }
  try {
    const res = await apiFetch('/auth/me');
    currentUser = res.user;
    updateUIForUser();
    checkPaymentRedirect();
  } catch {
    localStorage.removeItem('vsp_token');
    renderAuthModal('login');
  }
}

function checkPaymentRedirect() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    window.history.replaceState({}, '', '/');
    showToast('🎉 Predplatné aktivované! Teraz máš prístup k AI generátoru.');
    currentUser.plan = 'pro'; // Optimistický update
    updateUIForUser();
  } else if (params.get('payment') === 'cancelled') {
    window.history.replaceState({}, '', '/');
    showToast('Platba zrušená.');
  }
}

// ═══════════════════════════════════════════
// API HELPER
// ═══════════════════════════════════════════
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('vsp_token');
  const res = await fetch(API + endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Chyba servera');
  return data;
}

// ═══════════════════════════════════════════
// AUTH MODAL
// ═══════════════════════════════════════════
function renderAuthModal(tab = 'login') {
  removeModal('auth-modal');
  const modal = document.createElement('div');
  modal.id = 'auth-modal';
  modal.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;padding:1rem;backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:2rem;width:100%;max-width:400px;position:relative;">
      <div style="text-align:center;margin-bottom:1.75rem;">
        <div style="font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.2em;color:#6c63ff;text-transform:uppercase;margin-bottom:0.5rem;">VSP Tréner</div>
        <h2 style="font-size:1.5rem;font-weight:700;color:#e8e8f0;">${tab === 'login' ? 'Prihlás sa' : 'Zaregistruj sa'}</h2>
        <p style="color:#8888aa;font-size:0.85rem;margin-top:0.4rem;">${tab === 'login' ? 'Pokračuj v tréningu' : 'Vytvor si bezplatný účet'}</p>
      </div>

      <div id="auth-error" style="display:none;background:rgba(255,77,109,0.12);border:1px solid rgba(255,77,109,0.3);border-radius:8px;padding:0.7rem 1rem;margin-bottom:1rem;font-size:0.85rem;color:#ff4d6d;"></div>

      ${tab === 'register' ? `
      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:0.78rem;color:#8888aa;margin-bottom:0.4rem;font-family:'Space Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">Meno (voliteľné)</label>
        <input id="auth-name" type="text" placeholder="Juraj" style="${inputStyle()}">
      </div>` : ''}

      <div style="margin-bottom:1rem;">
        <label style="display:block;font-size:0.78rem;color:#8888aa;margin-bottom:0.4rem;font-family:'Space Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">Email</label>
        <input id="auth-email" type="email" placeholder="tvoj@email.sk" style="${inputStyle()}">
      </div>

      <div style="margin-bottom:1.5rem;">
        <label style="display:block;font-size:0.78rem;color:#8888aa;margin-bottom:0.4rem;font-family:'Space Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">Heslo</label>
        <input id="auth-password" type="password" placeholder="min. 8 znakov" style="${inputStyle()}">
      </div>

      <button onclick="submitAuth('${tab}')" style="${btnPrimary()};width:100%;justify-content:center;" id="auth-submit-btn">
        ${tab === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet'}
      </button>

      <div style="text-align:center;margin-top:1.25rem;font-size:0.85rem;color:#8888aa;">
        ${tab === 'login'
          ? `Nemáš účet? <a href="#" onclick="renderAuthModal('register');return false;" style="color:#6c63ff;">Zaregistruj sa</a>`
          : `Máš účet? <a href="#" onclick="renderAuthModal('login');return false;" style="color:#6c63ff;">Prihlás sa</a>`}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('auth-email')?.focus(), 100);

  // Enter key submit
  modal.addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAuth(tab);
  });
}

function inputStyle() {
  return `width:100%;padding:0.75rem 1rem;background:#1a1a26;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#e8e8f0;font-size:0.93rem;outline:none;font-family:'DM Sans',sans-serif;transition:border-color 0.15s;`;
}

function btnPrimary() {
  return `display:flex;align-items:center;gap:0.5rem;padding:0.75rem 1.25rem;background:#6c63ff;border:none;border-radius:10px;color:white;font-size:0.95rem;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background 0.15s;`;
}

async function submitAuth(tab) {
  const email = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;
  const name = document.getElementById('auth-name')?.value?.trim();
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');

  if (!email || !password) { showAuthError('Vyplň email a heslo.'); return; }

  btn.textContent = '...';
  btn.disabled = true;

  try {
    const data = await apiFetch(`/auth/${tab}`, {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
    localStorage.setItem('vsp_token', data.token);
    currentUser = data.user;
    removeModal('auth-modal');
    updateUIForUser();
    showToast(tab === 'login' ? `Vitaj späť, ${currentUser.name || currentUser.email}!` : '🎉 Účet vytvorený!');
  } catch (e) {
    showAuthError(e.message);
    btn.textContent = tab === 'login' ? 'Prihlásiť sa' : 'Vytvoriť účet';
    btn.disabled = false;
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.style.display = 'block'; el.textContent = msg; }
}

// ═══════════════════════════════════════════
// USER UI — pridá header s info o používateľovi
// ═══════════════════════════════════════════
function updateUIForUser() {
  if (!currentUser) return;
  removeModal('user-header');

  const header = document.createElement('div');
  header.id = 'user-header';
  const isPro = currentUser.plan === 'pro';
  header.style.cssText = `
    position:fixed;top:0;left:0;right:0;
    background:#0a0a0f;border-bottom:1px solid rgba(255,255,255,0.08);
    padding:0.5rem 1.5rem;display:flex;align-items:center;gap:0.75rem;
    z-index:9998;font-family:'DM Sans',sans-serif;
  `;
  header.innerHTML = `
    <span style="font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.2em;color:#6c63ff;text-transform:uppercase;">VSP</span>
    <span style="flex:1;"></span>
    <span style="font-size:0.82rem;color:#8888aa;">${currentUser.email}</span>
    <span style="padding:2px 10px;border-radius:20px;font-size:0.72rem;font-family:'Space Mono',monospace;
      ${isPro ? 'background:rgba(108,99,255,0.2);color:#a89fff;border:1px solid rgba(108,99,255,0.4);' : 'background:rgba(136,135,128,0.15);color:#8888aa;border:1px solid rgba(136,135,128,0.3);'}">
      ${isPro ? 'PRO' : 'FREE'}
    </span>
    ${!isPro ? `<button onclick="showPaywall()" style="padding:0.3rem 0.8rem;background:#6c63ff;border:none;border-radius:8px;color:white;font-size:0.78rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Upgrade →</button>` : ''}
    <button onclick="showAIGenerator()" style="padding:0.3rem 0.8rem;background:rgba(108,99,255,0.15);border:1px solid rgba(108,99,255,0.3);border-radius:8px;color:#a89fff;font-size:0.78rem;cursor:pointer;font-family:'DM Sans',sans-serif;">✨ AI úlohy</button>
    <button onclick="logout()" style="padding:0.3rem 0.8rem;background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#555570;font-size:0.78rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Odhlásiť</button>
  `;
  document.body.insertBefore(header, document.body.firstChild);

  // Odsaď obsah od headera
  document.body.style.paddingTop = '44px';

  // Pridaj AI generátor card na home screen
  addAICard();
}

function addAICard() {
  const grid = document.querySelector('.mode-grid');
  if (!grid || document.getElementById('ai-mode-card')) return;
  const card = document.createElement('div');
  card.id = 'ai-mode-card';
  card.className = 'mode-card';
  card.style.borderColor = 'rgba(108,99,255,0.3)';
  card.onclick = () => currentUser?.plan === 'pro' ? showAIGenerator() : showPaywall();
  card.innerHTML = `
    ${currentUser?.plan !== 'pro' ? '<span class="card-badge" style="background:#ff6584;">PRO</span>' : '<span class="card-badge">AI</span>'}
    <span class="card-icon">✨</span>
    <div class="card-title">AI generátor úloh</div>
    <div class="card-desc">Claude vygeneruje nové úlohy podľa teba — okruh, ťažkosť, počet. Nekonečne veľa cvičenia.</div>
  `;
  grid.appendChild(card);
}

// ═══════════════════════════════════════════
// PAYWALL
// ═══════════════════════════════════════════
function showPaywall() {
  removeModal('paywall-modal');
  const modal = document.createElement('div');
  modal.id = 'paywall-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99998;padding:1rem;backdrop-filter:blur(4px);`;
  modal.innerHTML = `
    <div style="background:#111118;border:1px solid rgba(108,99,255,0.3);border-radius:20px;padding:2rem;width:100%;max-width:440px;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:0.75rem;">✨</div>
      <h2 style="font-size:1.5rem;font-weight:700;color:#e8e8f0;margin-bottom:0.5rem;">VSP Tréner Pro</h2>
      <p style="color:#8888aa;font-size:0.88rem;margin-bottom:1.75rem;">Neobmedzené AI generovanie úloh + cloud história výsledkov</p>

      <div style="background:#1a1a26;border-radius:14px;padding:1.25rem;margin-bottom:1.5rem;text-align:left;">
        ${['✓ AI generátor — nekonečno nových úloh','✓ Výber okruhu, ťažkosti a počtu','✓ História testov synchronizovaná v cloude','✓ Prístup na všetkých zariadeniach'].map(f =>
          `<div style="padding:0.35rem 0;font-size:0.88rem;color:#c8c8e0;">${f}</div>`
        ).join('')}
      </div>

      <div style="margin-bottom:1.5rem;">
        <span style="font-family:'Space Mono',monospace;font-size:2rem;font-weight:700;color:#6c63ff;">4,99 €</span>
        <span style="color:#8888aa;font-size:0.85rem;"> / mesiac</span>
      </div>

      <button onclick="startCheckout()" style="${btnPrimary()};width:100%;justify-content:center;font-size:1rem;" id="checkout-btn">
        Začať predplatné →
      </button>
      <button onclick="removeModal('paywall-modal')" style="display:block;width:100%;margin-top:0.75rem;background:transparent;border:none;color:#555570;font-size:0.82rem;cursor:pointer;padding:0.5rem;">Nie teraz</button>
    </div>
  `;
  document.body.appendChild(modal);
}

async function startCheckout() {
  const btn = document.getElementById('checkout-btn');
  btn.textContent = 'Presmerúvam...';
  btn.disabled = true;
  try {
    const data = await apiFetch('/stripe/checkout', { method: 'POST' });
    window.location.href = data.url;
  } catch (e) {
    showToast('Chyba: ' + e.message);
    btn.textContent = 'Začať predplatné →';
    btn.disabled = false;
  }
}

async function openPortal() {
  try {
    const data = await apiFetch('/stripe/portal', { method: 'POST' });
    window.location.href = data.url;
  } catch (e) {
    showToast('Chyba: ' + e.message);
  }
}

// ═══════════════════════════════════════════
// AI GENERÁTOR MODAL
// ═══════════════════════════════════════════
const VERBAL_TOPICS_AI = ['Doplňovanie do viet','Vzťahy medzi slovami','Antosynonymá','Koherencia textov','Vyvodzovanie z krátkych textov','Porozumenie textu','Srovnávacie čítanie'];
const ANALYTICAL_TOPICS_AI = ['Grafy a tabuľky','Porovnávanie hodnôt','Postačujúce podmienky','Slovné úlohy','Verbalizácia, matematizácia','Operácie a tajné operácie','Zebry (logické úlohy)'];

function showAIGenerator() {
  if (!currentUser) { renderAuthModal('login'); return; }
  if (currentUser.plan !== 'pro') { showPaywall(); return; }

  removeModal('ai-modal');
  const modal = document.createElement('div');
  modal.id = 'ai-modal';
  modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:99998;padding:1rem;backdrop-filter:blur(4px);overflow-y:auto;`;
  modal.innerHTML = `
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:2rem;width:100%;max-width:500px;margin:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;">
        <div>
          <div style="font-family:'Space Mono',monospace;font-size:11px;letter-spacing:0.2em;color:#6c63ff;text-transform:uppercase;margin-bottom:0.3rem;">Claude AI</div>
          <h2 style="font-size:1.25rem;font-weight:700;color:#e8e8f0;">Generátor úloh</h2>
        </div>
        <button onclick="removeModal('ai-modal')" style="background:transparent;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#555570;width:32px;height:32px;cursor:pointer;font-size:1rem;">✕</button>
      </div>

      <div id="ai-error" style="display:none;background:rgba(255,77,109,0.12);border:1px solid rgba(255,77,109,0.3);border-radius:8px;padding:0.7rem 1rem;margin-bottom:1rem;font-size:0.85rem;color:#ff4d6d;"></div>

      <div style="margin-bottom:1rem;">
        <label style="${labelStyle()}">Časť testu</label>
        <div style="display:flex;gap:0.5rem;">
          <div class="ai-chip active" data-group="part" data-val="verbal" onclick="selectAIChip(this)" style="${chipStyle(true)}">Verbálna</div>
          <div class="ai-chip" data-group="part" data-val="analytical" onclick="selectAIChip(this)" style="${chipStyle(false)}">Analytická</div>
        </div>
      </div>

      <div style="margin-bottom:1rem;">
        <label style="${labelStyle()}">Okruh (voliteľné)</label>
        <div id="ai-topic-chips" style="display:flex;flex-wrap:wrap;gap:0.5rem;"></div>
      </div>

      <div style="margin-bottom:1rem;">
        <label style="${labelStyle()}">Ťažkosť</label>
        <div style="display:flex;gap:0.5rem;">
          <div class="ai-chip" data-group="diff" data-val="easy" onclick="selectAIChip(this)" style="${chipStyle(false)}">Ľahká</div>
          <div class="ai-chip active" data-group="diff" data-val="medium" onclick="selectAIChip(this)" style="${chipStyle(true)}">Stredná</div>
          <div class="ai-chip" data-group="diff" data-val="hard" onclick="selectAIChip(this)" style="${chipStyle(false)}">Ťažká</div>
        </div>
      </div>

      <div style="margin-bottom:1.5rem;">
        <label style="${labelStyle()}">Počet úloh: <span id="ai-count-label" style="color:#6c63ff;">5</span></label>
        <input type="range" min="1" max="10" value="5" id="ai-count" oninput="document.getElementById('ai-count-label').textContent=this.value" style="width:100%;margin-top:0.4rem;">
      </div>

      <button onclick="generateAIQuestions()" id="ai-gen-btn" style="${btnPrimary()};width:100%;justify-content:center;">
        ✨ Generovať úlohy
      </button>

      <div id="ai-result" style="margin-top:1.25rem;display:none;">
        <div style="background:rgba(61,214,140,0.1);border:1px solid rgba(61,214,140,0.3);border-radius:10px;padding:1rem;font-size:0.88rem;color:#3dd68c;" id="ai-success-msg"></div>
        <button onclick="startAITest()" style="${btnPrimary()};width:100%;justify-content:center;margin-top:0.75rem;">
          Spustiť test s AI úlohami →
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  updateAITopicChips('verbal');
}

let lastGeneratedQuestions = [];

function labelStyle() {
  return `display:block;font-size:0.78rem;color:#8888aa;margin-bottom:0.5rem;font-family:'Space Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;`;
}

function chipStyle(active) {
  return active
    ? `padding:0.35rem 0.85rem;border-radius:8px;border:1px solid #6c63ff;background:rgba(108,99,255,0.15);color:#e8e8f0;cursor:pointer;font-size:0.85rem;font-family:'DM Sans',sans-serif;transition:all 0.15s;`
    : `padding:0.35rem 0.85rem;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(26,26,38,1);color:#8888aa;cursor:pointer;font-size:0.85rem;font-family:'DM Sans',sans-serif;transition:all 0.15s;`;
}

function selectAIChip(el) {
  const group = el.dataset.group;
  document.querySelectorAll(`.ai-chip[data-group="${group}"]`).forEach(c => {
    c.style.cssText = chipStyle(false);
    c.classList.remove('active');
  });
  el.style.cssText = chipStyle(true);
  el.classList.add('active');
  if (group === 'part') updateAITopicChips(el.dataset.val);
}

function updateAITopicChips(part) {
  const topics = part === 'verbal' ? VERBAL_TOPICS_AI : ANALYTICAL_TOPICS_AI;
  const container = document.getElementById('ai-topic-chips');
  if (!container) return;
  container.innerHTML = `<div class="ai-chip active" data-group="topic" data-val="" onclick="selectAIChip(this)" style="${chipStyle(true)}">Všetky</div>` +
    topics.map(t => `<div class="ai-chip" data-group="topic" data-val="${t}" onclick="selectAIChip(this)" style="${chipStyle(false)}">${t}</div>`).join('');
}

async function generateAIQuestions() {
  const part = document.querySelector('.ai-chip[data-group="part"].active')?.dataset.val || 'verbal';
  const topic = document.querySelector('.ai-chip[data-group="topic"].active')?.dataset.val || '';
  const difficulty = document.querySelector('.ai-chip[data-group="diff"].active')?.dataset.val || 'medium';
  const count = parseInt(document.getElementById('ai-count')?.value || 5);
  const btn = document.getElementById('ai-gen-btn');
  const errEl = document.getElementById('ai-error');

  errEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = `<span style="animation:pulse 0.8s infinite">Generujem...</span> Claude premýšľa...`;

  try {
    const data = await apiFetch('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ part, topic, count, difficulty })
    });

    lastGeneratedQuestions = data.questions;
    document.getElementById('ai-result').style.display = 'block';
    document.getElementById('ai-success-msg').textContent =
      `✓ Vygenerovaných ${data.generated} nových úloh${topic ? ` — ${topic}` : ''}. Spusti test alebo generuj ďalšie.`;
  } catch (e) {
    errEl.style.display = 'block';
    errEl.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Generovať úlohy';
  }
}

function startAITest() {
  if (!lastGeneratedQuestions.length) return;
  removeModal('ai-modal');

  // Integruj AI otázky do existujúceho state systému
  const formattedQs = lastGeneratedQuestions.map(q => ({
    id: q.id || 'ai_' + Math.random().toString(36).slice(2),
    topic: q.topic,
    text: (q.context ? q.context + '\n\n' : '') + q.question,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation || '',
    isAI: true
  }));

  // Použij existujúce state a funkcie trénera
  if (typeof state !== 'undefined') {
    state.mode = 'ai';
    state.questions = formattedQs;
    state.currentIdx = 0;
    state.answers = {};
    state.revealed = {};
    state.startTime = Date.now();
    state.part = formattedQs[0]?.topic && VERBAL_TOPICS_AI.includes(formattedQs[0].topic) ? 'verbal' : 'analytical';
    state.timeLeft = 0; // Voľné tempo pre AI
    if (typeof renderTest === 'function') {
      renderTest();
      if (typeof showScreen === 'function') showScreen('test');
    }
  }
}

// ═══════════════════════════════════════════
// SAVE RESULTS TO SERVER
// ═══════════════════════════════════════════
// Hookneme sa na existujúcu funkciu finishTest
const _originalFinishTest = window.finishTest;
window.finishTest = async function() {
  if (typeof _originalFinishTest === 'function') _originalFinishTest();
  // Pošli výsledky na server ak je user prihlásený
  if (!currentUser || !localStorage.getItem('vsp_token')) return;
  try {
    const h = JSON.parse(localStorage.getItem('vsp_history') || '[]')[0];
    if (!h) return;
    await apiFetch('/ai/save-result', {
      method: 'POST',
      body: JSON.stringify({
        mode: h.mode,
        score: h.score,
        correct: h.correct,
        wrong: h.wrong,
        skipped: h.skipped,
        verbalPct: h.estimatedV,
        analytPct: h.estimatedA,
        estPct: h.estimated,
        durationS: h.duration,
        answers: h.answers
      })
    });
  } catch (e) {
    // Tiché zlyhanie — lokálna história zostane
  }
};

// ═══════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════
function removeModal(id) {
  document.getElementById(id)?.remove();
}

function logout() {
  localStorage.removeItem('vsp_token');
  currentUser = null;
  removeModal('user-header');
  document.getElementById('ai-mode-card')?.remove();
  document.body.style.paddingTop = '0';
  renderAuthModal('login');
}

// ═══════════════════════════════════════════
// ŠTART
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', initAuth);
