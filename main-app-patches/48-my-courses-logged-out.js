const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('Prihlás sa a zobrazíme tvoje kurzy')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const FN_OLD = `async function loadMyCourses(){
  const mcRoot=document.getElementById('myCoursesRoot');
  if(!mcRoot)return;
  if(!currentUser){mcRoot.innerHTML='';return;}
  try{`;
const FN_NEW = `async function loadMyCourses(){
  const mcRoot=document.getElementById('myCoursesRoot');
  if(!mcRoot)return;
  if(!currentUser){
    mcRoot.innerHTML=\`<h2 style="font-family:var(--serif);font-size:1.4rem;font-weight:400;color:var(--text);margin:1.8rem 0 .9rem;">🎓 Moje kurzy</h2>
      <div class="mode-grid">
        <div class="mode-card" onclick="loginWithGoogle()" style="cursor:pointer"><span class="card-icon">🎓</span><div class="card-title">Prihlás sa a zobrazíme tvoje kurzy</div><div class="card-desc">Prihlásenie cez Google →</div></div>
      </div>\`;
    return;
  }
  try{`;

let patched = replaceOnce(src, FN_OLD, FN_NEW, 'loadMyCourses logged-out branch');

const INIT_OLD = `initAuth();
</script>`;
const INIT_NEW = `initAuth();
loadMyCourses();
</script>`;
patched = replaceOnce(patched, INIT_OLD, INIT_NEW, 'unconditional init call');

const backup = FILE + '.pre-my-courses-logged-out-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
