const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('myCoursesRoot')) {
  console.error('Uz je aplikovane (najdene myCoursesRoot), nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

// 1) HTML container right below the ad banner slot.
const HTML_OLD = `  <div class="ad-slot" id="adSlot"></div>

  <footer>`;
const HTML_NEW = `  <div class="ad-slot" id="adSlot"></div>

  <div id="myCoursesRoot"></div>

  <footer>`;

// 2) Loader function, placed right next to loadCourseOwnership (var-hoisting keeps this safe
// even if something calls loadMyCourses before this line executes).
const FN_OLD = `var userHasCourse=false;
async function loadCourseOwnership(){
  if(!currentUser){userHasCourse=false;return;}
  try{
    const headers=await getAuthHeader();
    const res=await fetch('/api/user/has-course',{headers});
    const data=await res.json();
    userHasCourse=!!data.hasCourse;
  }catch(e){userHasCourse=false;}
}`;
const FN_NEW = `var userHasCourse=false;
async function loadCourseOwnership(){
  if(!currentUser){userHasCourse=false;return;}
  try{
    const headers=await getAuthHeader();
    const res=await fetch('/api/user/has-course',{headers});
    const data=await res.json();
    userHasCourse=!!data.hasCourse;
  }catch(e){userHasCourse=false;}
}
function escapeHtmlMC(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function loadMyCourses(){
  const mcRoot=document.getElementById('myCoursesRoot');
  if(!mcRoot)return;
  if(!currentUser){mcRoot.innerHTML='';return;}
  try{
    const headers=await getAuthHeader();
    const res=await fetch('/api/user/my-courses',{headers});
    const data=await res.json();
    const courses=data.courses||[];
    if(!courses.length){mcRoot.innerHTML='';return;}
    mcRoot.innerHTML=\`<div style="font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin:1.5rem 0 .8rem;">🎓 Moje kurzy</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.8rem">
        \${courses.map(c=>\`<a href="/kurzy/\${c.slug}/watch" style="display:block;background:var(--black2);border:1px solid var(--border2);border-radius:12px;padding:1rem;text-decoration:none;color:var(--text)">
          <div style="font-weight:600;margin-bottom:.4rem">\${escapeHtmlMC(c.title)}</div>
          <div style="font-size:.78rem;color:var(--text3);font-family:var(--mono)">\${c.completedLessons}/\${c.totalLessons} lekcií · Pokračovať →</div>
        </a>\`).join('')}
      </div>\`;
  }catch(e){mcRoot.innerHTML='';}
}`;

// 3) Wire into login/logout.
const WIRE_OLD = `  loadScioDateFromCloud();
  await loadCourseOwnership();renderDashboard();
}
function onUserLoggedOut(){
  currentUser=null;localStorage.removeItem('vsp_user_email');localStorage.removeItem('vsp_premium');
  userHasCourse=false;
  renderAuthButton();updateHomeStats();
}`;
const WIRE_NEW = `  loadScioDateFromCloud();
  await loadCourseOwnership();renderDashboard();loadMyCourses();
}
function onUserLoggedOut(){
  currentUser=null;localStorage.removeItem('vsp_user_email');localStorage.removeItem('vsp_premium');
  userHasCourse=false;
  const mcRoot=document.getElementById('myCoursesRoot');if(mcRoot)mcRoot.innerHTML='';
  renderAuthButton();updateHomeStats();
}`;

let patched = src;
patched = replaceOnce(patched, HTML_OLD, HTML_NEW, 'HTML container');
patched = replaceOnce(patched, FN_OLD, FN_NEW, 'loader function');
patched = replaceOnce(patched, WIRE_OLD, WIRE_NEW, 'login/logout wiring');

const backup = FILE + '.pre-my-courses-ui-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
