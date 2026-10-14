// Oprava: main-app-patches/132 vkladalo l.id (course_lessons.id je UUID,
// nie číslo) do onclick/onkeydown atribútov BEZ úvodzoviek —
// napr. onclick="sendCoachMessage(599fbcf5-84a7-4c09-92ea-490889adedc5)"
// nie je platný JS (pomlčky sa vyhodnotia ako odčítanie), takže tlačidlo
// "Spýtať sa" vôbec nereagovalo (Uncaught SyntaxError v konzole).
// Oprava obalí l.id do úvodzoviek — funguje rovnako správne aj keby id
// bolo číslo.
const fs = require('fs');
const FILE = 'public/kurz-watch.html';

const LOCK = FILE + '.133-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes(`sendCoachMessage('\${l.id}')`)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes('function loadCoach(l)')) {
  console.error('main-app-patches/132 este nie je aplikovany (loadCoach nenajdene). Nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = `        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCoachMessage(\${l.id})}"></textarea>
      <button class="ai-coach-send" id="coach-send-\${l.id}" onclick="sendCoachMessage(\${l.id})">Spýtať sa →</button>`;
const NEW = `        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCoachMessage('\${l.id}')}"></textarea>
      <button class="ai-coach-send" id="coach-send-\${l.id}" onclick="sendCoachMessage('\${l.id}')">Spýtať sa →</button>`;

const patched = replaceOnce(src, OLD, NEW, 'coach onclick/onkeydown quoting');

const backup = FILE + '.pre-course-coach-uuid-onclick-fix-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
