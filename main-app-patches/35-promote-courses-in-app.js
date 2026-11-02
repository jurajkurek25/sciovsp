const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('loadCourseOwnership')) {
  console.error('Uz je aplikovane (najdene loadCourseOwnership), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

// 1) Global state + loader, placed right before getAuthHeader (var = safe even if
// referenced before this line runs, since var hoists as undefined, not a TDZ crash).
const A_OLD = `async function getAuthHeader() {
  if (!_supabase) return {};
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { 'Authorization': 'Bearer ' + session.access_token };
}`;
const A_NEW = `var userHasCourse=false;
async function loadCourseOwnership(){
  if(!currentUser){userHasCourse=false;return;}
  try{
    const headers=await getAuthHeader();
    const res=await fetch('/api/user/has-course',{headers});
    const data=await res.json();
    userHasCourse=!!data.hasCourse;
  }catch(e){userHasCourse=false;}
}
async function getAuthHeader() {
  if (!_supabase) return {};
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { 'Authorization': 'Bearer ' + session.access_token };
}`;

// 2) Wire the check into login/logout.
const B_OLD = `  renderAuthButton();updateHomeStats();loadRefCard();renderEliteHomeCards();initEliteFeatures();
  if(isPremium()){const ol=document.getElementById('paywall-overlay');if(ol)ol.remove();}
  loadScioDateFromCloud();
}
function onUserLoggedOut(){
  currentUser=null;localStorage.removeItem('vsp_user_email');localStorage.removeItem('vsp_premium');
  renderAuthButton();updateHomeStats();
}`;
const B_NEW = `  renderAuthButton();updateHomeStats();loadRefCard();renderEliteHomeCards();initEliteFeatures();
  if(isPremium()){const ol=document.getElementById('paywall-overlay');if(ol)ol.remove();}
  loadScioDateFromCloud();
  await loadCourseOwnership();renderDashboard();
}
function onUserLoggedOut(){
  currentUser=null;localStorage.removeItem('vsp_user_email');localStorage.removeItem('vsp_premium');
  userHasCourse=false;
  renderAuthButton();updateHomeStats();
}`;

// 3) Dashboard promo card.
const C_OLD = `    <div class="dash-countdown">${'$'}{countdownHtml}<span class="dash-set-date" onclick="setSCIODate()">${'$'}{t('setDateBtn')}</span></div>\`;
}`;
const C_NEW = `    <div class="dash-countdown">${'$'}{countdownHtml}<span class="dash-set-date" onclick="setSCIODate()">${'$'}{t('setDateBtn')}</span></div>
    ${'$'}{!userHasCourse ? \`<a href="/kurzy" class="dash-course-promo" style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-top:1rem;padding:.9rem 1rem;background:var(--black3);border:1px solid var(--border2);border-radius:10px;text-decoration:none;color:var(--text);font-size:.85rem"><span>🎓 Pozri si video kurzy — štruktúrovaná príprava krok za krokom</span><span style="color:var(--volt);font-family:var(--mono);white-space:nowrap">→</span></a>\` : ''}\`;
}`;

// 4) AI Coach analysis nudge.
const D_OLD = `      <div class="am-section">
        <div class="am-section-label">Cieľ pre ďalší test</div>
        <div class="am-goal">${'$'}{a.next_test_goal || ''}</div>
      </div>
    </div>\`;

  contentEl.style.display = '';
}`;
const D_NEW = `      <div class="am-section">
        <div class="am-section-label">Cieľ pre ďalší test</div>
        <div class="am-goal">${'$'}{a.next_test_goal || ''}</div>
      </div>

      ${'$'}{!userHasCourse ? \`<div class="am-section"><a href="/kurzy" style="display:block;padding:.9rem 1rem;background:var(--black3);border:1px solid var(--border2);border-radius:10px;text-decoration:none;color:var(--text);font-size:.85rem">🎓 Chceš sa pripraviť ešte dôkladnejšie? Pozri si video kurzy →</a></div>\` : ''}
    </div>\`;

  contentEl.style.display = '';
}`;

let patched = src;
patched = replaceOnce(patched, A_OLD, A_NEW, 'A (loader)');
patched = replaceOnce(patched, B_OLD, B_NEW, 'B (login/logout wiring)');
patched = replaceOnce(patched, C_OLD, C_NEW, 'C (dashboard card)');
patched = replaceOnce(patched, D_OLD, D_NEW, 'D (AI Coach nudge)');

const backup = FILE + '.pre-promote-courses-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
