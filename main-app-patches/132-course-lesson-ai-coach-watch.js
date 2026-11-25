// Frontend pre AI Coach (main-app-patches/131) — chat widget pod lekciou,
// vizuálne rovnaký ako AI Mentor v app.html, ale napojený na
// /api/courses/:slug/lessons/:lessonId/coach. Zobrazí sa len pri
// odomknutých lekciách (l.unlocked), rovnako ako komentáre.
const fs = require('fs');
const FILE = 'public/kurz-watch.html';

const LOCK = FILE + '.132-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('ai-coach')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) CSS ──
const OLD_CSS = `.comment-submit:disabled{opacity:.5;cursor:not-allowed}`;
const NEW_CSS = `.comment-submit:disabled{opacity:.5;cursor:not-allowed}
.ai-coach{margin-top:1.1rem;border-top:1px solid var(--border);padding-top:1rem}
.ai-coach-title{font-family:var(--serif);font-size:1rem;font-weight:400;margin-bottom:.35rem}
.ai-coach-hint{font-size:.78rem;color:var(--text3);margin-bottom:.8rem}
.ai-coach-history{display:flex;flex-direction:column;gap:.6rem;margin-bottom:.7rem;max-height:320px;overflow-y:auto}
.ai-coach-msg{font-size:.87rem;line-height:1.6;padding:.6rem .8rem;border-radius:8px;white-space:pre-wrap}
.ai-coach-msg.user{background:rgba(124,92,255,.1);align-self:flex-end;max-width:85%}
.ai-coach-msg.ai{background:var(--black);border-left:2px solid var(--purple2)}
.ai-coach-input-row{display:flex;gap:.5rem;align-items:flex-end}
.ai-coach-input{flex:1;background:var(--black);border:1px solid var(--border2);border-radius:8px;padding:.55rem .75rem;color:var(--text);font-family:var(--sans);font-size:.87rem;resize:vertical;min-height:44px;max-height:110px}
.ai-coach-send{background:rgba(124,92,255,.15);border:1px solid rgba(124,92,255,.3);border-radius:8px;color:var(--purple2);padding:.55rem 1rem;font-family:var(--mono);font-size:.78rem;cursor:pointer;white-space:nowrap}
.ai-coach-send:disabled{opacity:.5;cursor:wait}`;
patched = replaceOnce(patched, OLD_CSS, NEW_CSS, '1: CSS');

// ── 2) coachMount vedla commentsMount + oba return statementy v lessonHtml() ──
const OLD_MOUNT = `  const commentsMount = \`<div class="comments-mount" id="comments-\${l.id}"></div>\`;
  if (l.completed) {
    return \`<div class="lesson" id="lesson-\${l.id}"><h3>\${escapeHtml(l.title)} <span class="badge">hotovo ✓</span></h3>\${videoBlock}\${docBlock}<p class="completed-note">Lekcia dokončená.</p>\${commentsMount}</div>\`;
  }`;
const NEW_MOUNT = `  const commentsMount = \`<div class="comments-mount" id="comments-\${l.id}"></div>\`;
  const coachMount = \`<div class="coach-mount" id="coach-\${l.id}"></div>\`;
  if (l.completed) {
    return \`<div class="lesson" id="lesson-\${l.id}"><h3>\${escapeHtml(l.title)} <span class="badge">hotovo ✓</span></h3>\${videoBlock}\${docBlock}<p class="completed-note">Lekcia dokončená.</p>\${coachMount}\${commentsMount}</div>\`;
  }`;
patched = replaceOnce(patched, OLD_MOUNT, NEW_MOUNT, '2: commentsMount + completed return');

const OLD_RETURN2 = `  return \`<div class="lesson" id="lesson-\${l.id}"><h3>\${escapeHtml(l.title)}</h3>\${videoBlock}\${docBlock}\${gatesBlock}\${commentsMount}</div>\`;`;
const NEW_RETURN2 = `  return \`<div class="lesson" id="lesson-\${l.id}"><h3>\${escapeHtml(l.title)}</h3>\${videoBlock}\${docBlock}\${gatesBlock}\${coachMount}\${commentsMount}</div>\`;`;
patched = replaceOnce(patched, OLD_RETURN2, NEW_RETURN2, '3: normal return');

// ── 3) showLesson() — zavolaj loadCoach() vedla loadComments() ──
const OLD_SHOW = `function showLesson(l) {
  const mainCol = document.getElementById('mainCol');
  mainCol.innerHTML = \`<div id="lessonsRoot">\${lessonHtml(l)}</div>\`;
  if (l.videoUrl) {
    const mount = document.getElementById('bp-' + l.id);
    if (mount) mountBrandedPlayer(mount, mount.dataset.src);
  }
  if (!l.completed) {
    const hasQuiz = (l.quizQuestions || []).length > 0;
    if (hasQuiz && !l.quizPassed) bindQuiz(l, courseToken);
    if (l.requiresUpload && !l.uploadPassed) bindUpload(l, courseToken);
  }
  loadComments(l, courseToken);
}`;
const NEW_SHOW = `function showLesson(l) {
  const mainCol = document.getElementById('mainCol');
  mainCol.innerHTML = \`<div id="lessonsRoot">\${lessonHtml(l)}</div>\`;
  if (l.videoUrl) {
    const mount = document.getElementById('bp-' + l.id);
    if (mount) mountBrandedPlayer(mount, mount.dataset.src);
  }
  if (!l.completed) {
    const hasQuiz = (l.quizQuestions || []).length > 0;
    if (hasQuiz && !l.quizPassed) bindQuiz(l, courseToken);
    if (l.requiresUpload && !l.uploadPassed) bindUpload(l, courseToken);
  }
  loadComments(l, courseToken);
  if (l.unlocked) loadCoach(l);
}`;
patched = replaceOnce(patched, OLD_SHOW, NEW_SHOW, '4: showLesson wiring');

// ── 4) loadCoach() + sendCoachMessage() — hned za bindCommentForm() ──
const OLD_FN_END = `    } catch (e) {
      feedback.textContent = 'Chyba servera.'; feedback.className = 'feedback err'; btn.disabled = false;
    }
  };
}

function bindQuiz(l, token) {`;
const NEW_FN_END = `    } catch (e) {
      feedback.textContent = 'Chyba servera.'; feedback.className = 'feedback err'; btn.disabled = false;
    }
  };
}

function loadCoach(l) {
  const mount = document.getElementById('coach-' + l.id);
  if (!mount) return;
  mount.innerHTML = \`<div class="ai-coach">
    <h4 class="ai-coach-title">🤖 AI Coach</h4>
    <p class="ai-coach-hint">Pýtaj sa do hĺbky na čokoľvek z tejto lekcie. Coach si odpoveď overuje vo viacerých zdrojoch, chvíľu to trvá.</p>
    <div class="ai-coach-history" id="coach-history-\${l.id}"></div>
    <div class="ai-coach-input-row">
      <textarea class="ai-coach-input" id="coach-input-\${l.id}" placeholder="Napíš svoju otázku…" rows="1"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCoachMessage(\${l.id})}"></textarea>
      <button class="ai-coach-send" id="coach-send-\${l.id}" onclick="sendCoachMessage(\${l.id})">Spýtať sa →</button>
    </div>
  </div>\`;
}

async function sendCoachMessage(lessonId) {
  const input = document.getElementById('coach-input-' + lessonId);
  const btn = document.getElementById('coach-send-' + lessonId);
  const history = document.getElementById('coach-history-' + lessonId);
  if (!input || !btn || !history) return;
  const question = input.value.trim();
  if (!question) return;
  history.innerHTML += \`<div class="ai-coach-msg user">\${escapeHtml(question)}</div>\`;
  input.value = '';
  btn.disabled = true;
  btn.textContent = '⏳';
  history.scrollTop = history.scrollHeight;
  const loadId = 'coach-load-' + Date.now();
  history.innerHTML += \`<div class="ai-coach-msg ai" id="\${loadId}" style="color:var(--text3);font-style:italic">Hľadám a overujem zdroje…</div>\`;
  history.scrollTop = history.scrollHeight;
  try {
    const res = await fetch(\`/api/courses/\${slug}/lessons/\${lessonId}/coach\`, {
      method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + courseToken },
      body: JSON.stringify({ question })
    });
    const data = await res.json();
    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = \`<div class="ai-coach-msg ai">\${escapeHtml(res.ok ? (data.reply || 'Skús otázku preformulovať.') : (data.error || 'Chyba.'))}</div>\`;
  } catch (e) {
    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.outerHTML = \`<div class="ai-coach-msg ai" style="color:var(--text3)">Chyba spojenia.</div>\`;
  }
  btn.disabled = false;
  btn.textContent = 'Spýtať sa →';
  history.scrollTop = history.scrollHeight;
}

function bindQuiz(l, token) {`;
patched = replaceOnce(patched, OLD_FN_END, NEW_FN_END, '5: loadCoach + sendCoachMessage');

const backup = FILE + '.pre-course-lesson-ai-coach-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Vyzaduje uz nasadeny main-app-patches/131-course-lesson-ai-coach-server.js.');
