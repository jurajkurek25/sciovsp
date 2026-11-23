const fs = require('fs');
const FILE = 'public/darcekova-karta-hotovo.html';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes('function render(cards)')) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
const OLD = `async function poll(attempt) {
  if (!sessionId) { root.innerHTML = '<p class="err">Chýba session_id.</p>'; return; }
  try {
    const res = await fetch('/api/gift-cards/by-session/' + encodeURIComponent(sessionId));
    if (res.ok) {
      const data = await res.json();
      render(data.card);
      return;
    }
  } catch (e) {}
  if (attempt < 8) { setTimeout(() => poll(attempt + 1), 1200); }
  else { root.innerHTML = '<p class="err">Platba sa spracúva dlhšie ako obvykle. Skús o pár minút obnoviť stránku, alebo si kartu ulož podľa e-mailu s potvrdením platby.</p>'; }
}

function render(card) {
  root.innerHTML = \`<h1>Ďakujeme! 🎁</h1>
    <p class="muted">Darčeková karta je pripravená.</p>
    <div class="code-box">
      <div class="muted" style="margin-bottom:.4rem">Kód na uplatnenie</div>
      <div class="code">\${card.code}</div>
    </div>
    <a class="btn" href="/api/gift-cards/\${encodeURIComponent(card.code)}/pdf" target="_blank" rel="noopener">Stiahnuť / vytlačiť PDF kartu</a>
    <p class="muted" style="margin-top:1.2rem">Obdarovaný uplatní kód na <a href="/uplatnit-darcek">sptrener.online/uplatnit-darcek</a> po prihlásení cez Google.</p>\`;
}`;
const NEW = `async function poll(attempt) {
  if (!sessionId) { root.innerHTML = '<p class="err">Chýba session_id.</p>'; return; }
  try {
    const res = await fetch('/api/gift-cards/by-session/' + encodeURIComponent(sessionId));
    if (res.ok) {
      const data = await res.json();
      render(data.cards || (data.card ? [data.card] : []));
      return;
    }
  } catch (e) {}
  if (attempt < 10) { setTimeout(() => poll(attempt + 1), 1200); }
  else { root.innerHTML = '<p class="err">Platba sa spracúva dlhšie ako obvykle. Skús o pár minút obnoviť stránku, alebo si karty ulož podľa e-mailu s potvrdením platby.</p>'; }
}

function render(cards) {
  if (!cards || !cards.length) { root.innerHTML = '<p class="err">Nenašli sa žiadne karty pre túto platbu.</p>'; return; }
  const items = cards.map(card => \`
    <div class="code-box">
      <div class="muted" style="margin-bottom:.4rem">Kód na uplatnenie</div>
      <div class="code">\${card.code}</div>
      <a class="btn" href="/api/gift-cards/\${encodeURIComponent(card.code)}/pdf" target="_blank" rel="noopener" style="margin-top:.9rem">Stiahnuť / vytlačiť PDF kartu</a>
    </div>\`).join('');
  const multi = cards.length > 1;
  root.innerHTML = \`<h1>Ďakujeme! 🎁</h1>
    <p class="muted">\${multi ? cards.length + ' darčekové karty sú pripravené.' : 'Darčeková karta je pripravená.'}</p>
    \${items}
    <p class="muted" style="margin-top:1.2rem">Obdarovaný uplatní kód na <a href="/uplatnit-darcek">sptrener.online/uplatnit-darcek</a> po prihlásení cez Google.</p>\`;
}`;
const count = src.split(OLD).length - 1;
if (count !== 1) { console.error(`ABORT: anchor occurs ${count} times. No changes.`); process.exit(1); }
const backup = FILE + '.pre-gift-card-cart-hotovo-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(OLD).join(NEW));
console.log('OK - zaloha:', backup);
