// Panel moderacie komunity: nav odkaz, polozka v PAGES routeri, a cely
// blok renderCommunity() + suvisiacich funkcii (zoznam prispevkov/
// komentarov so zmazanim, blokovanie/odblokovanie, manualne udelenie/
// odobratie pristupu mimo webinarovej cesty). Spustat z korena
// dash-service. Vyzaduje uz nasadeny dash-service/patches/01 (routes
// wiring) a routes/community.js nahrany na serveri.
const fs = require('fs');
const FILE = 'public/index.html';

const LOCK = FILE + '.02-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('renderCommunity')) {
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
  '    <a class="navlink" data-page="webinar">Webinár — kontakty</a>\n',
  '    <a class="navlink" data-page="webinar">Webinár — kontakty</a>\n    <a class="navlink" data-page="community">Komunita</a>\n',
  '1: nav link');

// -- 2) PAGES router --
patched = replaceOnce(patched,
  'webinar: renderWebinar };',
  'webinar: renderWebinar, community: renderCommunity };',
  '2: PAGES entry');

// -- 3) renderCommunity() + pomocne funkcie, pred renderWebinar() --
const COMMUNITY_BLOCK = "async function renderCommunity() {\n  const html = `\n    <div class=\"pagehead\"><h2>Komunita</h2><button class=\"btn secondary\" onclick=\"navigate('community')\">Obnoviť</button></div>\n    <div class=\"table-wrap\" style=\"margin-bottom:1.25rem;padding:1rem\">\n      <div class=\"pagehead\" style=\"margin-bottom:.5rem\"><h3 style=\"margin:0\">Zablokovať / odblokovať používateľa</h3></div>\n      <div style=\"display:flex;gap:.5rem;flex-wrap:wrap;align-items:center\">\n        <input id=\"communityBanEmail\" type=\"email\" placeholder=\"email@example.com\" style=\"flex:1;min-width:220px\">\n        <button class=\"btn\" onclick=\"communityBan()\">Zablokovať</button>\n        <button class=\"btn secondary\" onclick=\"communityUnban()\">Odblokovať</button>\n      </div>\n      <div id=\"communityBanMsg\" class=\"muted\" style=\"margin-top:.5rem\"></div>\n    </div>\n    <div class=\"table-wrap\" style=\"margin-bottom:1.25rem;padding:1rem\">\n      <div class=\"pagehead\" style=\"margin-bottom:.5rem\"><h3 style=\"margin:0\">Udeliť / odobrať prístup manuálne</h3></div>\n      <div class=\"muted\" style=\"margin-bottom:.5rem\">Mimo bežnej cesty (webinárový nákup Premium/Elite) — napr. pre partnera alebo testera.</div>\n      <div style=\"display:flex;gap:.5rem;flex-wrap:wrap;align-items:center\">\n        <input id=\"communityAccessEmail\" type=\"email\" placeholder=\"email@example.com\" style=\"flex:1;min-width:220px\">\n        <input id=\"communityAccessDays\" type=\"number\" placeholder=\"dní\" value=\"30\" min=\"1\" max=\"3650\" style=\"width:90px\">\n        <button class=\"btn\" onclick=\"communityGrantAccess()\">Udeliť prístup</button>\n        <button class=\"btn secondary\" onclick=\"communityRevokeAccess()\">Odobrať prístup</button>\n      </div>\n      <div id=\"communityAccessMsg\" class=\"muted\" style=\"margin-top:.5rem\"></div>\n    </div>\n    <div class=\"table-wrap\" style=\"margin-bottom:1.25rem\">\n      <div class=\"pagehead\" style=\"margin-bottom:.5rem\"><h3 style=\"margin:0\">Príspevky</h3></div>\n      <table>\n        <thead><tr><th>Čas</th><th>Autor</th><th>Text</th><th>Obrázok</th><th></th></tr></thead>\n        <tbody id=\"communityPostsTbody\"><tr><td class=\"muted\" colspan=\"5\">načítavam…</td></tr></tbody>\n      </table>\n    </div>\n    <div class=\"table-wrap\">\n      <div class=\"pagehead\" style=\"margin-bottom:.5rem\"><h3 style=\"margin:0\">Komentáre</h3></div>\n      <table>\n        <thead><tr><th>Čas</th><th>Autor</th><th>Text</th><th></th></tr></thead>\n        <tbody id=\"communityCommentsTbody\"><tr><td class=\"muted\" colspan=\"4\">načítavam…</td></tr></tbody>\n      </table>\n    </div>`;\n  $('#main').innerHTML = html;\n  loadCommunityPosts();\n  loadCommunityComments();\n}\n\nasync function loadCommunityPosts() {\n  const tbody = document.getElementById('communityPostsTbody');\n  if (!tbody) return;\n  try {\n    const d = await api('/api/dash/community/posts');\n    tbody.innerHTML = (d.posts || []).map(p => `<tr>\n      <td class=\"muted\">${new Date(p.created_at).toLocaleString('sk-SK')}</td>\n      <td>${p.author_name ? p.author_name + ' — ' : ''}${p.author_email}</td>\n      <td>${(p.body || '').replace(/</g, '&lt;')}</td>\n      <td>${p.image_url ? `<a href=\"${p.image_url}\" target=\"_blank\">obrázok</a>` : '—'}</td>\n      <td><button class=\"btn secondary\" data-post-id=\"${p.id}\" onclick=\"communityDeletePost(this)\">Zmazať</button></td>\n    </tr>`).join('') || '<tr><td class=\"muted\" colspan=\"5\">Zatiaľ žiadne príspevky.</td></tr>';\n  } catch (e) {\n    tbody.innerHTML = '<tr><td class=\"muted\" colspan=\"5\">Chyba načítania.</td></tr>';\n  }\n}\n\nasync function loadCommunityComments() {\n  const tbody = document.getElementById('communityCommentsTbody');\n  if (!tbody) return;\n  try {\n    const d = await api('/api/dash/community/comments');\n    tbody.innerHTML = (d.comments || []).map(c => `<tr>\n      <td class=\"muted\">${new Date(c.created_at).toLocaleString('sk-SK')}</td>\n      <td>${c.author_name ? c.author_name + ' — ' : ''}${c.author_email}</td>\n      <td>${(c.body || '').replace(/</g, '&lt;')}</td>\n      <td><button class=\"btn secondary\" data-comment-id=\"${c.id}\" onclick=\"communityDeleteComment(this)\">Zmazať</button></td>\n    </tr>`).join('') || '<tr><td class=\"muted\" colspan=\"4\">Zatiaľ žiadne komentáre.</td></tr>';\n  } catch (e) {\n    tbody.innerHTML = '<tr><td class=\"muted\" colspan=\"4\">Chyba načítania.</td></tr>';\n  }\n}\n\nasync function communityDeletePost(btn) {\n  if (!confirm('Zmazať tento príspevok?')) return;\n  try { await api(`/api/dash/community/posts/${btn.dataset.postId}`, { method: 'DELETE' }); loadCommunityPosts(); }\n  catch (e) { alert('Chyba pri mazaní.'); }\n}\n\nasync function communityDeleteComment(btn) {\n  if (!confirm('Zmazať tento komentár?')) return;\n  try { await api(`/api/dash/community/comments/${btn.dataset.commentId}`, { method: 'DELETE' }); loadCommunityComments(); }\n  catch (e) { alert('Chyba pri mazaní.'); }\n}\n\nasync function communityBan() {\n  const email = document.getElementById('communityBanEmail').value.trim();\n  const msg = document.getElementById('communityBanMsg');\n  if (!email) { msg.textContent = 'Zadaj email.'; return; }\n  try { await api(`/api/dash/community/users/${encodeURIComponent(email)}/ban`, { method: 'POST' }); msg.textContent = 'Zablokované: ' + email; }\n  catch (e) { msg.textContent = 'Chyba.'; }\n}\n\nasync function communityUnban() {\n  const email = document.getElementById('communityBanEmail').value.trim();\n  const msg = document.getElementById('communityBanMsg');\n  if (!email) { msg.textContent = 'Zadaj email.'; return; }\n  try { await api(`/api/dash/community/users/${encodeURIComponent(email)}/unban`, { method: 'POST' }); msg.textContent = 'Odblokované: ' + email; }\n  catch (e) { msg.textContent = 'Chyba.'; }\n}\n\nasync function communityGrantAccess() {\n  const email = document.getElementById('communityAccessEmail').value.trim();\n  const days = document.getElementById('communityAccessDays').value.trim();\n  const msg = document.getElementById('communityAccessMsg');\n  if (!email) { msg.textContent = 'Zadaj email.'; return; }\n  try {\n    const d = await api(`/api/dash/community/users/${encodeURIComponent(email)}/grant-access`, { method: 'POST', body: JSON.stringify({ days: parseInt(days, 10) }) });\n    msg.textContent = 'Prístup udelený do: ' + new Date(d.accessUntil).toLocaleString('sk-SK');\n  } catch (e) { msg.textContent = 'Chyba.'; }\n}\n\nasync function communityRevokeAccess() {\n  const email = document.getElementById('communityAccessEmail').value.trim();\n  const msg = document.getElementById('communityAccessMsg');\n  if (!email) { msg.textContent = 'Zadaj email.'; return; }\n  try { await api(`/api/dash/community/users/${encodeURIComponent(email)}/revoke-access`, { method: 'POST' }); msg.textContent = 'Prístup odobraný: ' + email; }\n  catch (e) { msg.textContent = 'Chyba.'; }\n}\n";
patched = replaceOnce(patched,
  'async function renderWebinar() {',
  COMMUNITY_BLOCK + '\n\nasync function renderWebinar() {',
  '3: community block pred renderWebinar');

const backup = FILE + '.pre-community-panel-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
