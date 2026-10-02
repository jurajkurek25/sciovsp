// Prida dobrovolny prispevok ("tip") na public/recenzia.html — stale
// viditelna sekcia s volnym poľom na sumu, nezavisla od stavu formulara
// recenzie (recenzia po odoslani prepisuje #card cez innerHTML, tip-box
// je preto ZAMERNE mimo #card, aby prezil aj po odoslani).
//
// Platba ide cez novu server-side rutu /api/tip/checkout — dynamicky
// Stripe Checkout (price_data, mode:'payment'), Stripe si sam vypyta
// email pri platbe (nezavisi to od exam_review_token, ktory sa po
// odoslani recenzie nuluje — takze by zlyhal lookup, keby sme sa naň
// spoliehali).
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/166-recenzia-voluntary-tip.js

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(process.cwd(), 'public', 'recenzia.html');
const SERVER_PATH = path.join(process.cwd(), 'server.js');

for (const p of [HTML_PATH, SERVER_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.166-recenzia-voluntary-tip-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

// ═══════════════════════ public/recenzia.html ═══════════════════════
let html = fs.readFileSync(HTML_PATH, 'utf8');

if (html.includes('tipBox')) {
  console.error('❌ recenzia.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) body -> flex-direction:column, aby sa tip-box zaradil pod #card
//    namiesto vedľa neho (body je flex row by default)
html = replaceOnce(html,
  "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--ink);color:var(--text);font-family:var(--sans);padding:24px;}",
  "body{margin:0;min-height:100vh;display:flex;flex-direction:column;gap:1rem;align-items:center;justify-content:center;background:var(--ink);color:var(--text);font-family:var(--sans);padding:24px;}",
  'CSS: body flex-direction:column');

// 2) nové CSS pravidlá pre tip-box
html = replaceOnce(html,
  '.done .emoji{font-size:2.4rem;margin-bottom:10px;}',
  '.done .emoji{font-size:2.4rem;margin-bottom:10px;}\n' +
  '  .tip-box{width:100%;max-width:460px;background:var(--ink3);border:1px solid var(--border2);border-radius:16px;padding:1.3rem 1.5rem;}\n' +
  '  .tip-text{color:var(--text2);font-size:.85rem;line-height:1.5;margin:0 0 .9rem;}\n' +
  '  .tip-row{display:flex;gap:.5rem;align-items:center;}\n' +
  '  .tip-row input{flex:1;min-width:0;background:var(--ink);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:inherit;font-size:.9rem;padding:.65rem .7rem;}\n' +
  '  .tip-eur{color:var(--text3);font-family:var(--mono);font-size:.85rem;}\n' +
  '  .tip-btn{background:transparent;border:1px solid var(--signal);border-radius:8px;color:var(--text);font-family:var(--mono);font-size:.8rem;font-weight:700;padding:.65rem 1rem;cursor:pointer;white-space:nowrap;}\n' +
  '  .tip-btn:disabled{opacity:.5;cursor:default;}',
  'CSS: .tip-box pravidlá');

// 3) HTML — tip-box ako súrodenec #card (mimo neho, prežije aj po odoslaní recenzie)
html = replaceOnce(html,
  '    <div class="msg" id="msg"></div>\n' +
  '  </div>\n' +
  '<script>',
  '    <div class="msg" id="msg"></div>\n' +
  '  </div>\n' +
  '  <div class="tip-box" id="tipBox">\n' +
  '    <p class="tip-text">Ak ti príprava dala viac ako si zaplatil/a, môžeš prispieť na jej rozvoj — AI generátor úloh nie je lacný 💛 Úplne dobrovoľné.</p>\n' +
  '    <div class="tip-row">\n' +
  '      <input type="number" id="tipAmount" min="1" step="0.5" placeholder="napr. 5">\n' +
  '      <span class="tip-eur">€</span>\n' +
  '      <button class="tip-btn" id="tipBtn">Prispieť →</button>\n' +
  '    </div>\n' +
  '    <div class="msg" id="tipMsg"></div>\n' +
  '  </div>\n' +
  '<script>',
  'HTML: tip-box');

// 4) JS — tip checkout handler + tipped=1 poďakovanie po návrate zo Stripe
html = replaceOnce(html,
  '    } catch (e) {\n' +
  '      btn.disabled = false; btn.textContent = \'Odoslať recenziu\';\n' +
  '      msgEl.textContent = e.message; msgEl.className = \'msg err\';\n' +
  '    }\n' +
  '  });\n' +
  '</script>',
  '    } catch (e) {\n' +
  '      btn.disabled = false; btn.textContent = \'Odoslať recenziu\';\n' +
  '      msgEl.textContent = e.message; msgEl.className = \'msg err\';\n' +
  '    }\n' +
  '  });\n' +
  '\n' +
  '  if (new URLSearchParams(window.location.search).get(\'tipped\') === \'1\') {\n' +
  '    document.getElementById(\'tipBox\').innerHTML = \'<p class="tip-text">🙏 Ďakujeme za príspevok!</p>\';\n' +
  '  }\n' +
  '  document.getElementById(\'tipBtn\').addEventListener(\'click\', async () => {\n' +
  '    const tipMsgEl = document.getElementById(\'tipMsg\');\n' +
  '    tipMsgEl.textContent = \'\'; tipMsgEl.className = \'msg\';\n' +
  '    const amount = parseFloat(document.getElementById(\'tipAmount\').value);\n' +
  '    if (!amount || amount <= 0) { tipMsgEl.textContent = \'Zadaj sumu.\'; tipMsgEl.className = \'msg err\'; return; }\n' +
  '    const btn = document.getElementById(\'tipBtn\');\n' +
  '    btn.disabled = true; btn.textContent = \'Chvíľu…\';\n' +
  '    try {\n' +
  '      const res = await fetch(\'/api/tip/checkout\', {\n' +
  '        method: \'POST\',\n' +
  '        headers: { \'Content-Type\': \'application/json\' },\n' +
  '        body: JSON.stringify({ amount, token: token || undefined })\n' +
  '      });\n' +
  '      const data = await res.json();\n' +
  '      if (!res.ok || !data.url) throw new Error(data.error || \'Chyba pri vytváraní platby.\');\n' +
  '      location.href = data.url;\n' +
  '    } catch (e) {\n' +
  '      btn.disabled = false; btn.textContent = \'Prispieť →\';\n' +
  '      tipMsgEl.textContent = e.message; tipMsgEl.className = \'msg err\';\n' +
  '    }\n' +
  '  });\n' +
  '</script>',
  'JS: tip checkout handler');

// ═══════════════════════ server.js ═══════════════════════
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("app.post('/api/tip/checkout'")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

server = replaceOnce(server,
  "    console.error('review submit:', err.message);\n" +
  "    res.status(500).json({ error: err.message });\n" +
  "  }\n" +
  "});\n" +
  "\n" +
  "app.listen(PORT, () => {",
  "    console.error('review submit:', err.message);\n" +
  "    res.status(500).json({ error: err.message });\n" +
  "  }\n" +
  "});\n" +
  "\n" +
  "app.post('/api/tip/checkout', rateLimit, async (req, res) => {\n" +
  "  const { amount, token } = req.body || {};\n" +
  "  const amountCents = Math.round(Number(amount) * 100);\n" +
  "  if (!amountCents || amountCents < 100) return res.status(400).json({ error: 'Zadaj platnú sumu (aspoň 1€).' });\n" +
  "  try {\n" +
  "    const session = await stripe.checkout.sessions.create({\n" +
  "      mode: 'payment',\n" +
  "      payment_method_types: ['card'],\n" +
  "      line_items: [{\n" +
  "        price_data: {\n" +
  "          currency: 'eur',\n" +
  "          unit_amount: amountCents,\n" +
  "          product_data: { name: 'Dobrovoľný príspevok — SP Tréner' }\n" +
  "        },\n" +
  "        quantity: 1\n" +
  "      }],\n" +
  "      success_url: EXAM_APP_URL + '/recenzia.html?tipped=1' + (token ? '&token=' + encodeURIComponent(token) : ''),\n" +
  "      cancel_url: EXAM_APP_URL + '/recenzia.html' + (token ? '?token=' + encodeURIComponent(token) : ''),\n" +
  "      metadata: { type: 'voluntary_tip', reviewToken: token || '' }\n" +
  "    });\n" +
  "    res.json({ url: session.url });\n" +
  "  } catch (e) {\n" +
  "    console.error('tip checkout error:', e.message);\n" +
  "    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platbu.' });\n" +
  "  }\n" +
  "});\n" +
  "\n" +
  "app.listen(PORT, () => {",
  'server.js: /api/tip/checkout route');

// ═══════════════════════ zápis ═══════════════════════
const now = Date.now();
const htmlBackup = HTML_PATH + '.pre-voluntary-tip-' + now;
const serverBackup = SERVER_PATH + '.pre-voluntary-tip-' + now;
fs.copyFileSync(HTML_PATH, htmlBackup);
fs.copyFileSync(SERVER_PATH, serverBackup);
fs.writeFileSync(HTML_PATH, html);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Dobrovoľný príspevok pridaný na recenzia.html + /api/tip/checkout na serveri.');
console.log('   Zálohy:', htmlBackup, serverBackup);
console.log('   Over syntax pred reštartom: node -c server.js');
