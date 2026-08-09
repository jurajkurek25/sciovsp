const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('// Len explicitná "false" odpoveď')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = L(
  "async function loadCourseOwnership(){",
  "  if(!currentUser){userHasCourse=false;return;}",
  "  try{",
  "    const headers=await getAuthHeader();",
  "    const res=await fetch('/api/user/has-course',{headers});",
  "    const data=await res.json();",
  "    userHasCourse=!!data.hasCourse;",
  "  }catch(e){userHasCourse=false;}",
  "}"
);

const NEW = L(
  "async function loadCourseOwnership(){",
  "  if(!currentUser){userHasCourse=false;return;}",
  "  // Len explicitná \"false\" odpoveď zo servera zmení stav — dočasné zlyhanie",
  "  // (401 pri overovaní session, výpadok siete) sa raz zopakuje a inak nechá",
  "  // predošlý známy stav tak, aby sa vlastníkovi kurzu chybne nezobrazila výzva na kúpu.",
  "  const attempt=async()=>{",
  "    const headers=await getAuthHeader();",
  "    const res=await fetch('/api/user/has-course',{headers});",
  "    if(!res.ok)return null;",
  "    const data=await res.json();",
  "    return !!data.hasCourse;",
  "  };",
  "  try{",
  "    let result=await attempt();",
  "    if(result===null)result=await attempt();",
  "    if(result!==null)userHasCourse=result;",
  "  }catch(e){",
  "    try{",
  "      const headers=await getAuthHeader();",
  "      const res=await fetch('/api/user/has-course',{headers});",
  "      if(res.ok){const data=await res.json();userHasCourse=!!data.hasCourse;}",
  "    }catch(e2){}",
  "  }",
  "}"
);

const patched = replaceOnce(src, OLD, NEW, 'loadCourseOwnership body');

const backup = FILE + '.pre-fix-course-ownership-race-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
