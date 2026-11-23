const fs = require('fs');
const FILE = 'public/darcekova-karta.html';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes('function changeQty')) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
function applyOne(s, old, neu, label) {
  const count = s.split(old).length - 1;
  if (count !== 1) { console.error(`ABORT (${label}): anchor occurs ${count} times. No changes.`); process.exit(1); }
  return s.split(old).join(neu);
}
let out = src;
out = applyOne(out,
  `  <div id="optionsRoot"><p class="muted">Načítavam možnosti…</p></div>
  <div class="addon-box" id="addonBox">
    <label class="addon-row" for="addonCheck">
      <input type="checkbox" id="addonCheck">
      <span style="flex:1">
        <span class="t">🎓 Pridať aj kurz podľa vlastného výberu</span>
        <div class="p">Obdarovaný si pri uplatnení vyberie ľubovoľný publikovaný kurz navyše.</div>
      </span>
      <span class="price" id="addonPrice"></span>
    </label>
  </div>
  <div class="summary" id="summaryBox">
    <div class="summary-row" id="summaryLine1"></div>
    <div class="summary-row" id="summaryLine2" style="display:none"></div>
    <div class="summary-row total" id="summaryTotal"></div>
  </div>`,
  `  <p class="muted" style="text-align:center;margin:-.5rem 0 1.4rem">Vyber si ľubovoľné množstvo a kombináciu kariet — všetko v jednej objednávke.</p>
  <div id="optionsRoot"><p class="muted">Načítavam možnosti…</p></div>
  <div class="summary" id="summaryBox">
    <div id="summaryLines"></div>
    <div class="summary-row total" id="summaryTotal"></div>
  </div>`,
  'html addon-box -> hint+summary');
out = applyOne(out,
  `.addon-row .price{margin-left:auto;font-family:var(--mono);color:var(--volt);font-weight:700;white-space:nowrap}`,
  `.addon-row .price{margin-left:auto;font-family:var(--mono);color:var(--volt);font-weight:700;white-space:nowrap}
.qty-row{display:flex;align-items:center;gap:.6rem;margin-top:.6rem}
.qty-btn{width:26px;height:26px;border-radius:7px;border:1px solid var(--border2);background:var(--black3);color:var(--text);font-size:.95rem;line-height:1;cursor:pointer}
.qty-btn:hover{border-color:rgba(255,255,255,.3)}
.qty-val{font-family:var(--mono);font-size:.9rem;min-width:1.2rem;text-align:center}
.bundle-row{display:flex;align-items:center;gap:.4rem;margin-top:.6rem;font-size:.75rem;color:var(--text2);cursor:pointer}
.bundle-row.hidden{display:none}
.bundle-row input{width:auto}`,
  'css steppers');
const OLD_SCRIPT = `const $ = s => document.querySelector(s);
let allOptions = [];
let selectedOption = null;
let addonOption = null;

function eur(cents) { return (cents / 100).toFixed(2).replace('.', ',') + ' €'; }

async function loadOptions() {
  try {
    const res = await fetch('/api/gift-cards/options');
    const data = await res.json();
    allOptions = data.options || [];
    const root = $('#optionsRoot');
    if (!allOptions.length) {
      root.innerHTML = '<p class="muted">Momentálne nie sú dostupné žiadne darčekové karty.</p>';
      return;
    }
    const premiumOpts = allOptions.filter(o => o.kind === 'premium').sort((a, b) => a.sort_order - b.sort_order);
    const eliteOpts = allOptions.filter(o => o.kind === 'elite').sort((a, b) => a.sort_order - b.sort_order);
    const courseOpts = allOptions.filter(o => o.kind === 'course').sort((a, b) => a.sort_order - b.sort_order);
    addonOption = courseOpts[0] || null;
    let html = '';
    if (premiumOpts.length) {
      html += '<div class="section-label">Premium predplatné</div><div class="opt-grid">' + premiumOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (eliteOpts.length) {
      html += '<div class="section-label">Elite predplatné</div><div class="opt-grid">' + eliteOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (courseOpts.length) {
      html += '<div class="section-label">Online kurz</div><div class="opt-grid">' + courseOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    root.innerHTML = html;
    document.querySelectorAll('.opt-card').forEach(card => card.onclick = () => selectOption(card.dataset.id));
    if (addonOption) $('#addonPrice').textContent = '+' + eur(addonOption.price_cents);
  } catch (e) {
    $('#optionsRoot').innerHTML = '<p class="err">Chyba pri načítaní.</p>';
  }
}

function optCardHtml(o) {
  const icon = o.kind === 'premium' ? '💎' : o.kind === 'elite' ? '🔥' : '🎓';
  return \`<div class="opt-card" data-id="\${o.id}">
    <span class="icon">\${icon}</span>
    <span class="label">\${escapeHtml(o.label)}</span>
    <span class="price">\${eur(o.price_cents)}</span>
  </div>\`;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function selectOption(id) {
  selectedOption = allOptions.find(o => o.id === id);
  document.querySelectorAll('.opt-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
  $('#formBlock').classList.add('show');
  const canAddon = (selectedOption.kind === 'premium' || selectedOption.kind === 'elite') && addonOption;
  $('#addonBox').classList.toggle('show', !!canAddon);
  if (!canAddon) $('#addonCheck').checked = false;
  updateSummary();
}

function updateSummary() {
  if (!selectedOption) { $('#summaryBox').classList.remove('show'); return; }
  const includeAddon = (selectedOption.kind === 'premium' || selectedOption.kind === 'elite') && addonOption && $('#addonCheck').checked;
  $('#summaryLine1').textContent = selectedOption.label + ' — ' + eur(selectedOption.price_cents);
  if (includeAddon) {
    $('#summaryLine2').style.display = 'flex';
    $('#summaryLine2').textContent = '+ Kurz podľa vlastného výberu — ' + eur(addonOption.price_cents);
  } else {
    $('#summaryLine2').style.display = 'none';
  }
  const total = selectedOption.price_cents + (includeAddon ? addonOption.price_cents : 0);
  $('#summaryTotal').textContent = 'Spolu: ' + eur(total);
  $('#summaryBox').classList.add('show');
  $('#buyBtn').textContent = 'Kúpiť za ' + eur(total);
}

$('#addonCheck').addEventListener('change', updateSummary);

$('#buyBtn').addEventListener('click', async () => {
  const buyerEmail = $('#buyerEmail').value.trim();
  $('#formErr').textContent = '';
  if (!selectedOption) { $('#formErr').textContent = 'Vyber si darčekovú kartu vyššie.'; return; }
  if (!buyerEmail.includes('@')) { $('#formErr').textContent = 'Zadaj platný e-mail.'; return; }
  const btn = $('#buyBtn');
  const includeAddon = (selectedOption.kind === 'premium' || selectedOption.kind === 'elite') && addonOption && $('#addonCheck').checked;
  const prevLabel = btn.textContent;
  btn.disabled = true; btn.textContent = 'Chvíľu strpenia…';
  try {
    const res = await fetch('/api/gift-cards/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        optionId: selectedOption.id, buyerEmail, includeCourse: includeAddon,
        recipientName: $('#recipientName').value.trim(), message: $('#giftMessage').value.trim(),
        refCode: sessionStorage.getItem('partner_ref') || null
      })
    });
    const data = await res.json();
    if (data.url) { location.href = data.url; }
    else { $('#formErr').textContent = data.error || 'Chyba pri vytváraní platby.'; btn.disabled = false; btn.textContent = prevLabel; }
  } catch (e) {
    $('#formErr').textContent = 'Chyba servera.'; btn.disabled = false; btn.textContent = prevLabel;
  }
});

loadOptions();`;
const NEW_SCRIPT = `const $ = s => document.querySelector(s);
let allOptions = [];
let addonOption = null;
let cart = {}; // optionId -> { quantity, includeCourse }

function eur(cents) { return (cents / 100).toFixed(2).replace('.', ',') + ' €'; }
function hasAnyItems() { return Object.values(cart).some(v => v.quantity > 0); }

async function loadOptions() {
  try {
    const res = await fetch('/api/gift-cards/options');
    const data = await res.json();
    allOptions = data.options || [];
    const root = $('#optionsRoot');
    if (!allOptions.length) {
      root.innerHTML = '<p class="muted">Momentálne nie sú dostupné žiadne darčekové karty.</p>';
      return;
    }
    const premiumOpts = allOptions.filter(o => o.kind === 'premium').sort((a, b) => a.sort_order - b.sort_order);
    const eliteOpts = allOptions.filter(o => o.kind === 'elite').sort((a, b) => a.sort_order - b.sort_order);
    const courseOpts = allOptions.filter(o => o.kind === 'course').sort((a, b) => a.sort_order - b.sort_order);
    addonOption = courseOpts[0] || null;
    let html = '';
    if (premiumOpts.length) {
      html += '<div class="section-label">Premium predplatné</div><div class="opt-grid">' + premiumOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (eliteOpts.length) {
      html += '<div class="section-label">Elite predplatné</div><div class="opt-grid">' + eliteOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    if (courseOpts.length) {
      html += '<div class="section-label">Online kurz</div><div class="opt-grid">' + courseOpts.map(o => optCardHtml(o)).join('') + '</div>';
    }
    root.innerHTML = html;
  } catch (e) {
    $('#optionsRoot').innerHTML = '<p class="err">Chyba pri načítaní.</p>';
  }
}

function optCardHtml(o) {
  const icon = o.kind === 'premium' ? '💎' : o.kind === 'elite' ? '🔥' : '🎓';
  const qty = (cart[o.id] && cart[o.id].quantity) || 0;
  const canBundle = (o.kind === 'premium' || o.kind === 'elite') && addonOption;
  const bundleChecked = !!(cart[o.id] && cart[o.id].includeCourse);
  return \`<div class="opt-card\${qty > 0 ? ' selected' : ''}" data-id="\${o.id}">
    <span class="icon">\${icon}</span>
    <span class="label">\${escapeHtml(o.label)}</span>
    <span class="price">\${eur(o.price_cents)}</span>
    <div class="qty-row">
      <button type="button" class="qty-btn" data-action="dec" data-id="\${o.id}">−</button>
      <span class="qty-val" id="qty-\${o.id}">\${qty}</span>
      <button type="button" class="qty-btn" data-action="inc" data-id="\${o.id}">+</button>
    </div>
    \${canBundle ? \`<label class="bundle-row\${qty > 0 ? '' : ' hidden'}" id="bundle-\${o.id}">
      <input type="checkbox" data-bundle-id="\${o.id}"\${bundleChecked ? ' checked' : ''}>
      <span>+ kurz podľa výberu (\${eur(addonOption.price_cents)})</span>
    </label>\` : ''}
  </div>\`;
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function changeQty(id, delta) {
  const opt = allOptions.find(o => o.id === id);
  if (!opt) return;
  if (!cart[id]) cart[id] = { quantity: 0, includeCourse: false };
  const newQty = Math.max(0, Math.min(20, cart[id].quantity + delta));
  cart[id].quantity = newQty;
  if (newQty === 0) cart[id].includeCourse = false;
  const qtyEl = document.getElementById('qty-' + id);
  if (qtyEl) qtyEl.textContent = newQty;
  const cardEl = document.querySelector('.opt-card[data-id="' + CSS.escape(id) + '"]');
  if (cardEl) cardEl.classList.toggle('selected', newQty > 0);
  const bundleEl = document.getElementById('bundle-' + id);
  if (bundleEl) {
    bundleEl.classList.toggle('hidden', newQty === 0);
    if (newQty === 0) { const cb = bundleEl.querySelector('input'); if (cb) cb.checked = false; }
  }
  $('#formBlock').classList.toggle('show', hasAnyItems());
  updateSummary();
}

$('#optionsRoot').addEventListener('click', (e) => {
  const btn = e.target.closest('.qty-btn');
  if (!btn) return;
  changeQty(btn.dataset.id, btn.dataset.action === 'inc' ? 1 : -1);
});
$('#optionsRoot').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-bundle-id]');
  if (!cb) return;
  const id = cb.dataset.bundleId;
  if (!cart[id]) cart[id] = { quantity: 0, includeCourse: false };
  cart[id].includeCourse = cb.checked;
  updateSummary();
});

function updateSummary() {
  const lines = Object.entries(cart).filter(([id, v]) => v.quantity > 0);
  if (!lines.length) { $('#summaryBox').classList.remove('show'); $('#buyBtn').textContent = 'Kúpiť darčekovú kartu'; return; }
  let total = 0;
  let html = '';
  for (const [id, v] of lines) {
    const opt = allOptions.find(o => o.id === id);
    if (!opt) continue;
    const lineTotal = opt.price_cents * v.quantity;
    total += lineTotal;
    html += \`<div class="summary-row">\${escapeHtml(opt.label)} × \${v.quantity} — \${eur(lineTotal)}</div>\`;
    if (v.includeCourse && addonOption) {
      const addonTotal = addonOption.price_cents * v.quantity;
      total += addonTotal;
      html += \`<div class="summary-row">+ Kurz podľa vlastného výberu × \${v.quantity} — \${eur(addonTotal)}</div>\`;
    }
  }
  $('#summaryLines').innerHTML = html;
  $('#summaryTotal').textContent = 'Spolu: ' + eur(total);
  $('#summaryBox').classList.add('show');
  $('#buyBtn').textContent = 'Kúpiť za ' + eur(total);
}

$('#buyBtn').addEventListener('click', async () => {
  const buyerEmail = $('#buyerEmail').value.trim();
  $('#formErr').textContent = '';
  const items = Object.entries(cart).filter(([id, v]) => v.quantity > 0).map(([id, v]) => ({ optionId: id, quantity: v.quantity, includeCourse: !!v.includeCourse }));
  if (!items.length) { $('#formErr').textContent = 'Vyber si aspoň jednu darčekovú kartu vyššie.'; return; }
  if (!buyerEmail.includes('@')) { $('#formErr').textContent = 'Zadaj platný e-mail.'; return; }
  const btn = $('#buyBtn');
  const prevLabel = btn.textContent;
  btn.disabled = true; btn.textContent = 'Chvíľu strpenia…';
  try {
    const res = await fetch('/api/gift-cards/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        items, buyerEmail,
        recipientName: $('#recipientName').value.trim(), message: $('#giftMessage').value.trim(),
        refCode: sessionStorage.getItem('partner_ref') || null
      })
    });
    const data = await res.json();
    if (data.url) { location.href = data.url; }
    else { $('#formErr').textContent = data.error || 'Chyba pri vytváraní platby.'; btn.disabled = false; btn.textContent = prevLabel; }
  } catch (e) {
    $('#formErr').textContent = 'Chyba servera.'; btn.disabled = false; btn.textContent = prevLabel;
  }
});

loadOptions();`;
out = applyOne(out, OLD_SCRIPT, NEW_SCRIPT, 'script rewrite');
const backup = FILE + '.pre-gift-card-cart-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, out);
console.log('OK - zaloha:', backup);
