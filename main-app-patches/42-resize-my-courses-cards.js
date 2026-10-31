const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `async function loadMyCourses(){
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
const NEW = `async function loadMyCourses(){
  const mcRoot=document.getElementById('myCoursesRoot');
  if(!mcRoot)return;
  if(!currentUser){mcRoot.innerHTML='';return;}
  try{
    const headers=await getAuthHeader();
    const res=await fetch('/api/user/my-courses',{headers});
    const data=await res.json();
    const courses=data.courses||[];
    if(!courses.length){
      mcRoot.innerHTML=\`<div style="font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin:1.5rem 0 .8rem;">🎓 Moje kurzy</div>
        <div class="mode-grid">
          <a class="mode-card" href="/kurzy"><span class="card-icon">🎓</span><div class="card-title">Zatiaľ nemáš žiadny kurz</div><div class="card-desc">Pozri si ponuku video kurzov →</div></a>
        </div>\`;
      return;
    }
    mcRoot.innerHTML=\`<div style="font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin:1.5rem 0 .8rem;">🎓 Moje kurzy</div>
      <div class="mode-grid">
        \${courses.map(c=>\`<a class="mode-card" href="/kurzy/\${c.slug}/watch"><span class="card-icon">🎓</span><div class="card-title">\${escapeHtmlMC(c.title)}</div><div class="card-desc">\${c.completedLessons}/\${c.totalLessons} lekcií dokončených · Pokračovať →</div></a>\`).join('')}
      </div>\`;
  }catch(e){mcRoot.innerHTML='';}
}`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-resize-my-courses-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
