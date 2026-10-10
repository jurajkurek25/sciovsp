// Prida tlacidlo "Zdielat" na stranku jednotliveho clanku (/blog/:slug).
// Na mobile pouzije natívne Web Share API (navigator.share), na desktope
// (kde navigator.share zvycajne nie je) skopiruje odkaz do schranky a
// kratko ukaze potvrdenie v tlacidle samotnom.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.146-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('shareArticle')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

let patched = src;

// -- 1) CSS: .share-btn, hned za .prose-meta pravidlami --
patched = replaceOnce(patched,
  ".prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:2rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}\n.prose-meta .tag{color:var(--purple2);text-decoration:none}\n.prose-meta .tag:hover{color:var(--volt)}",
  ".prose-meta{display:flex;gap:.75rem;align-items:center;margin-bottom:2rem;font-family:var(--mono);font-size:.72rem;color:var(--text3);flex-wrap:wrap}\n.prose-meta .tag{color:var(--purple2);text-decoration:none}\n.prose-meta .tag:hover{color:var(--volt)}\n.share-btn{margin-bottom:1.5rem;padding:.5rem .9rem;background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-family:var(--mono);font-size:.75rem;letter-spacing:.03em;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:.4rem}\n.share-btn:hover{color:var(--text);border-color:var(--purple)}",
  '1: CSS .share-btn');

// -- 2) JS: shareArticle() pred switchBlogLang --
patched = replaceOnce(patched,
  "function switchBlogLang(l){",
  "function shareArticle(btn){\n  var url = window.location.href;\n  var title = document.title;\n  var isCz = document.documentElement.lang === 'cs';\n  if (navigator.share) {\n    navigator.share({ title: title, url: url }).catch(function(){});\n    return;\n  }\n  if (navigator.clipboard && navigator.clipboard.writeText) {\n    navigator.clipboard.writeText(url).then(function(){\n      var original = btn.textContent;\n      btn.textContent = isCz ? '✓ Odkaz zkopírován' : '✓ Odkaz skopírovaný';\n      setTimeout(function(){ btn.textContent = original; }, 2000);\n    });\n  }\n}\nfunction switchBlogLang(l){",
  '2: JS shareArticle');

// -- 3) HTML: tlacidlo do stranky clanku, za .prose-meta div --
const OLD_HTML = `      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}\${t.readTime ? \`<span>\${escapeHtml(t.readTime)}</span>\` : ''}\${dateStr ? \`<time datetime="\${post.created_at}">\${dateStr}</time>\` : ''}</div>
      <img class="prose-cover" src="\${postCoverUrl(post)}" alt="\${escapeHtml(t.title)}">`;
const NEW_HTML = `      <div class="prose-meta">\${post.tag ? \`<a class="tag" href="/blog?tag=\${encodeURIComponent(post.tag)}\${langQS}">\${escapeHtml(t.tag)}</a>\` : ''}\${t.readTime ? \`<span>\${escapeHtml(t.readTime)}</span>\` : ''}\${dateStr ? \`<time datetime="\${post.created_at}">\${dateStr}</time>\` : ''}</div>
      <button class="share-btn" onclick="shareArticle(this)">↗ \${lang === 'cs' ? 'Sdílet' : 'Zdieľať'}</button>
      <img class="prose-cover" src="\${postCoverUrl(post)}" alt="\${escapeHtml(t.title)}">`;
patched = replaceOnce(patched, OLD_HTML, NEW_HTML, '3: share button HTML');

const backup = FILE + '.pre-blog-article-share-button-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
