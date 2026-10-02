// Panel "AI Affiliate kampane": nav odkaz, polozka v PAGES routeri, a
// renderAffiliateCampaigns() s formularom na pridanie partnera/produktu +
// tabulkou existujucich kampani (zapnut/vypnut/regenerovat text/zmazat).
// Vyzaduje uz nasadeny dash-service/patches/06 (routes wiring) a
// routes/affiliate-campaigns.js nahraty na serveri.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.07-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('renderAffiliateCampaigns')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;

// -- 1) Nav odkaz --
patched = replaceOnce(patched,
  '    <a class="navlink" data-page="recommendations">Odporúčame (affiliate)</a>\n',
  '    <a class="navlink" data-page="recommendations">Odporúčame (affiliate)</a>\n    <a class="navlink" data-page="affiliatecampaigns">AI affiliate kampane</a>\n',
  '1: nav link');

// -- 2) PAGES router --
patched = replaceOnce(patched,
  'webinar: renderWebinar, community: renderCommunity, recommendations: renderRecommendations };',
  'webinar: renderWebinar, community: renderCommunity, recommendations: renderRecommendations, affiliatecampaigns: renderAffiliateCampaigns };',
  '2: PAGES entry');

// -- 3) renderAffiliateCampaigns() pred renderBugs() --
const CAMPAIGNS_BLOCK = "async function renderAffiliateCampaigns() {\n  const [{ campaigns }, { courses }] = await Promise.all([\n    api('/api/dash/affiliate-campaigns'),\n    api('/api/dash/affiliate-campaigns/courses')\n  ]);\n  const courseOptions = courses.map(c => `<option value=\"${c.id}\">${c.title}</option>`).join('');\n  const signalLabel = { all: 'Celý zoznam', course: 'Kupci kurzu', generalka_buyer: 'Kupci Generálky', exam_soon: 'Blížiaci sa termín' };\n  $('#main').innerHTML = `\n    <div class=\"pagehead\"><h2>AI affiliate kampane</h2></div>\n    <p class=\"muted\" style=\"margin-bottom:1rem;max-width:640px\">Zapíš partnera a čo predáva — AI podľa toho raz vygeneruje text kampane (hodnotový email, nie tvrdá reklama) a systém ho automaticky posiela vhodným používateľom podľa zvoleného signálu. Nikdy sa neposiela odhláseným (marketing_emails_opt_out) ani opakovane tomu istému človeku.</p>\n    <div class=\"card\" style=\"margin-bottom:1.4rem\">\n      <div class=\"formrow\">\n        <input class=\"ac-partner\" placeholder=\"Meno partnera (napr. BatohyZavazadla.cz)\" style=\"flex:1;min-width:200px\">\n        <input class=\"ac-url\" placeholder=\"Affiliate odkaz (https://...)\" style=\"flex:1;min-width:260px\">\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <textarea class=\"ac-description\" placeholder=\"Čo partner predáva — kontext pre AI (čím konkrétnejšie, tým lepší text)\" style=\"flex:1;min-width:300px;min-height:70px\"></textarea>\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <textarea class=\"ac-hint\" placeholder=\"Voliteľné: téma/štýl na inšpiráciu pre AI (napr. 'blíži sa koniec roka, 100 dní do cieľa')\" style=\"flex:1;min-width:300px;min-height:50px\"></textarea>\n      </div>\n      <div class=\"formrow\" style=\"margin-top:.6rem\">\n        <select class=\"ac-signal\" onchange=\"onAffiliateSignalChange()\" style=\"flex:1;min-width:200px\">\n          <option value=\"all\">Celý zoznam (opt-in)</option>\n          <option value=\"course\">Kupci konkrétneho kurzu</option>\n          <option value=\"generalka_buyer\">Kupci SP Generálky</option>\n          <option value=\"exam_soon\">Blížiaci sa termín prijímačiek</option>\n        </select>\n        <select class=\"ac-course\" style=\"flex:1;min-width:200px;display:none\">${courseOptions}</select>\n        <input class=\"ac-exam-days\" type=\"number\" placeholder=\"Dní pred termínom (napr. 7)\" style=\"width:200px;display:none\">\n        <input class=\"ac-lookback\" type=\"number\" placeholder=\"Lookback dní (predvolené 30)\" style=\"width:180px\">\n      </div>\n      <button class=\"btn ac-create\" style=\"margin-top:.6rem\">Pridať kampaň</button>\n      <div class=\"feedback\" id=\"acFeedback\"></div>\n    </div>\n    <div class=\"table-wrap\">\n      <table>\n        <thead><tr><th>Partner</th><th>Signál</th><th>Text</th><th>Odoslané</th><th>Stav</th><th></th></tr></thead>\n        <tbody>${campaigns.map(c => `<tr data-id=\"${c.id}\">\n          <td>${c.partner_name}</td>\n          <td class=\"muted\">${signalLabel[c.target_signal] || c.target_signal}${c.target_course ? ' — ' + c.target_course.title : ''}${c.target_signal === 'exam_soon' ? ' (' + c.exam_days_before + ' dní)' : ''}</td>\n          <td>${c.generated_at ? '<span class=\"pill resolved\">vygenerovaný</span>' : '<span class=\"pill pending\">čaká sa</span>'}</td>\n          <td class=\"muted\">${c.sent_count}</td>\n          <td>${c.active ? '<span class=\"pill resolved\">aktívna</span>' : '<span class=\"pill pending\">vypnutá</span>'}</td>\n          <td style=\"display:flex;gap:.4rem;flex-wrap:wrap\">\n            <button class=\"btn secondary ac-toggle\" data-active=\"${c.active}\">${c.active ? 'Vypnúť' : 'Zapnúť'}</button>\n            <button class=\"btn secondary ac-regenerate\">Regenerovať text</button>\n            <button class=\"btn secondary ac-preview\">Náhľad</button>\n            <button class=\"btn danger ac-delete\">Zmazať</button>\n          </td>\n        </tr>`).join('') || '<tr><td class=\"muted\" colspan=\"6\">Zatiaľ žiadne kampane.</td></tr>'}</tbody>\n      </table>\n    </div>`;\n  window.__affiliateCampaigns = campaigns;\n  $('.ac-create').onclick = async () => {\n    const feedback = $('#acFeedback');\n    feedback.textContent = ''; feedback.style.color = '';\n    try {\n      await api('/api/dash/affiliate-campaigns', { method: 'POST', body: JSON.stringify({\n        partnerName: $('.ac-partner').value,\n        productDescription: $('.ac-description').value,\n        ctaUrl: $('.ac-url').value,\n        targetSignal: $('.ac-signal').value,\n        targetCourseId: $('.ac-course').value,\n        examDaysBefore: $('.ac-exam-days').value,\n        lookbackDays: $('.ac-lookback').value,\n        subjectHint: $('.ac-hint').value\n      }) });\n      navigate('affiliatecampaigns');\n    } catch (err) { feedback.textContent = err.message; feedback.style.color = 'var(--red)'; }\n  };\n  $$('.ac-toggle').forEach(btn => btn.onclick = async () => {\n    const id = btn.closest('tr').dataset.id;\n    const nowActive = btn.dataset.active === 'true';\n    try { await api(`/api/dash/affiliate-campaigns/${id}`, { method: 'PUT', body: JSON.stringify({ active: !nowActive }) }); navigate('affiliatecampaigns'); }\n    catch (err) { alert(err.message); }\n  });\n  $$('.ac-regenerate').forEach(btn => btn.onclick = async () => {\n    const id = btn.closest('tr').dataset.id;\n    try { await api(`/api/dash/affiliate-campaigns/${id}/regenerate`, { method: 'POST' }); navigate('affiliatecampaigns'); }\n    catch (err) { alert(err.message); }\n  });\n  $$('.ac-preview').forEach(btn => btn.onclick = () => {\n    const id = btn.closest('tr').dataset.id;\n    const c = (window.__affiliateCampaigns || []).find(x => x.id === id);\n    if (!c || !c.generated_body_html) { alert('Text sa ešte negeneroval.'); return; }\n    const w = window.open('', '_blank');\n    w.document.write(`<div style=\"max-width:520px;margin:40px auto;font-family:sans-serif\"><h2>${c.generated_subject || ''}</h2>${c.generated_body_html}<p><b>CTA:</b> ${c.generated_cta_text || ''}</p></div>`);\n  });\n  $$('.ac-delete').forEach(btn => btn.onclick = async () => {\n    if (!confirm('Zmazať túto kampaň?')) return;\n    const id = btn.closest('tr').dataset.id;\n    try { await api(`/api/dash/affiliate-campaigns/${id}`, { method: 'DELETE' }); navigate('affiliatecampaigns'); }\n    catch (err) { alert(err.message); }\n  });\n}\nfunction onAffiliateSignalChange() {\n  const val = $('.ac-signal').value;\n  $('.ac-course').style.display = val === 'course' ? '' : 'none';\n  $('.ac-exam-days').style.display = val === 'exam_soon' ? '' : 'none';\n}\n";
patched = replaceOnce(patched,
  '// ─────────────────────────── BUGS ───────────────────────────\nasync function renderBugs() {',
  CAMPAIGNS_BLOCK + '\n\n// ─────────────────────────── BUGS ───────────────────────────\nasync function renderBugs() {',
  '3: affiliate campaigns block pred renderBugs');

const backup = FILE + '.pre-affiliate-campaigns-panel-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
