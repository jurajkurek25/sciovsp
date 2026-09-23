// Panel "Odporúčame" (affiliate odkazy na verejnej /odporucame): nav
// odkaz, položka v PAGES routeri, a renderRecommendations() s formulárom
// na pridanie + tabuľkou existujúcich odkazov (zapnúť/vypnúť/zmazať).
// Vyžaduje už nasadený dash-service/patches/03 (routes wiring) a
// routes/recommendations.js nahraný na serveri.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.04-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('renderRecommendations')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// -- 1) Nav odkaz --
patched = replaceOnce(patched,
  '    <a class="navlink" data-page="webinar">Webinár — kontakty</a>\n    <a class="navlink" data-page="community">Komunita</a>\n',
  '    <a class="navlink" data-page="webinar">Webinár — kontakty</a>\n    <a class="navlink" data-page="community">Komunita</a>\n    <a class="navlink" data-page="recommendations">Odporúčame (affiliate)</a>\n',
  '1: nav link');

// -- 2) PAGES router --
patched = replaceOnce(patched,
  'webinar: renderWebinar, community: renderCommunity };',
  'webinar: renderWebinar, community: renderCommunity, recommendations: renderRecommendations };',
  '2: PAGES entry');

// -- 3) renderRecommendations() pred renderBugs() --
const RECOMMENDATIONS_BLOCK = "async function renderRecommendations() {\n  const { products } = await api('/api/dash/recommendations');\n  $('#main').innerHTML = `\n    <div class=\"pagehead\"><h2>Odporúčame (affiliate odkazy)</h2></div>\n    <div class=\"card\" style=\"margin-bottom:1.4rem\">\n      <div class=\"formrow\">\n        <input class=\"rc-category-slug\" placeholder=\"Kategória — slug (napr. batohy-cestovanie)\" style=\"flex:1;min-width:200px\">\n        <input class=\"rc-icon\" placeholder=\"Ikona (emoji, napr. 🎒)\" style=\"width:140px\">\n        <input class=\"rc-sort\" type=\"number\" placeholder=\"Poradie\" style=\"width:100px\">\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <input class=\"rc-category-title-sk\" placeholder=\"Názov kategórie SK\" style=\"flex:1;min-width:200px\">\n        <input class=\"rc-category-title-cs\" placeholder=\"Název kategorie CZ\" style=\"flex:1;min-width:200px\">\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <input class=\"rc-title-sk\" placeholder=\"Názov produktu SK\" style=\"flex:1;min-width:200px\">\n        <input class=\"rc-title-cs\" placeholder=\"Název produktu CZ\" style=\"flex:1;min-width:200px\">\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <input class=\"rc-desc-sk\" placeholder=\"Popis SK\" style=\"flex:1;min-width:200px\">\n        <input class=\"rc-desc-cs\" placeholder=\"Popis CZ\" style=\"flex:1;min-width:200px\">\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <input class=\"rc-cta-sk\" placeholder=\"Text tlačidla SK (napr. Pozrieť ponuku →)\" style=\"flex:1;min-width:200px\">\n        <input class=\"rc-cta-cs\" placeholder=\"Text tlačidla CZ (napr. Podívat se na nabídku →)\" style=\"flex:1;min-width:200px\">\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <input class=\"rc-url\" placeholder=\"Affiliate odkaz (https://...)\" style=\"flex:1;min-width:300px\">\n      </div>\n      <button class=\"btn rc-create\" style=\"margin-top:.6rem\">Pridať odkaz</button>\n      <div class=\"feedback\" id=\"rcFeedback\"></div>\n    </div>\n    <div class=\"table-wrap\">\n      <table>\n        <thead><tr><th>Kategória</th><th>Názov (SK)</th><th>Odkaz</th><th>Poradie</th><th>Stav</th><th></th></tr></thead>\n        <tbody>${products.map(p => `<tr data-id=\"${p.id}\">\n          <td>${p.icon} ${p.category_title_sk}</td>\n          <td>${p.title_sk}</td>\n          <td class=\"muted\" style=\"max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\"><a href=\"${p.url}\" target=\"_blank\">${p.url}</a></td>\n          <td class=\"muted\">${p.sort_order}</td>\n          <td>${p.active ? '<span class=\"pill resolved\">aktívny</span>' : '<span class=\"pill pending\">vypnutý</span>'}</td>\n          <td style=\"display:flex;gap:.4rem;flex-wrap:wrap\">\n            <button class=\"btn secondary rc-toggle\" data-active=\"${p.active}\">${p.active ? 'Vypnúť' : 'Zapnúť'}</button>\n            <button class=\"btn danger rc-delete\">Zmazať</button>\n          </td>\n        </tr>`).join('') || '<tr><td class=\"muted\" colspan=\"6\">Zatiaľ žiadne odkazy.</td></tr>'}</tbody>\n      </table>\n    </div>`;\n  $('.rc-create').onclick = async () => {\n    const feedback = $('#rcFeedback');\n    feedback.textContent = ''; feedback.style.color = '';\n    try {\n      await api('/api/dash/recommendations', { method: 'POST', body: JSON.stringify({\n        categorySlug: $('.rc-category-slug').value,\n        categoryTitleSk: $('.rc-category-title-sk').value,\n        categoryTitleCs: $('.rc-category-title-cs').value,\n        icon: $('.rc-icon').value,\n        titleSk: $('.rc-title-sk').value,\n        titleCs: $('.rc-title-cs').value,\n        descriptionSk: $('.rc-desc-sk').value,\n        descriptionCs: $('.rc-desc-cs').value,\n        ctaSk: $('.rc-cta-sk').value,\n        ctaCs: $('.rc-cta-cs').value,\n        url: $('.rc-url').value,\n        sortOrder: $('.rc-sort').value || 0\n      }) });\n      navigate('recommendations');\n    } catch (err) { feedback.textContent = err.message; feedback.style.color = 'var(--red)'; }\n  };\n  $$('.rc-toggle').forEach(btn => btn.onclick = async () => {\n    const id = btn.closest('tr').dataset.id;\n    const nowActive = btn.dataset.active === 'true';\n    try { await api(`/api/dash/recommendations/${id}`, { method: 'PUT', body: JSON.stringify({ active: !nowActive }) }); navigate('recommendations'); }\n    catch (err) { alert(err.message); }\n  });\n  $$('.rc-delete').forEach(btn => btn.onclick = async () => {\n    if (!confirm('Zmazať tento odkaz?')) return;\n    const id = btn.closest('tr').dataset.id;\n    try { await api(`/api/dash/recommendations/${id}`, { method: 'DELETE' }); navigate('recommendations'); }\n    catch (err) { alert(err.message); }\n  });\n}\n";
patched = replaceOnce(patched,
  '// ─────────────────────────── BUGS ───────────────────────────\nasync function renderBugs() {',
  RECOMMENDATIONS_BLOCK + '\n\n// ─────────────────────────── BUGS ───────────────────────────\nasync function renderBugs() {',
  '3: recommendations block pred renderBugs');

const backup = FILE + '.pre-recommendations-panel-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
