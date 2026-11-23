// Adds clean-URL routes for the new career quiz landing page:
//   /kam-na-vysoku  (SK)
//   /kam-na-vysokou (CZ spelling alias, same page — same pattern as /vianoce + /vanoce)
// Anchored right after the confirmed-live /vianoce route. Idempotent — safe to re-run.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("'/kam-na-vysoku'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = "app.get('/vianoce', (req,res)=>{res.sendFile(path.join(__dirname,'public','vianoce.html'));});";

const count = src.split(ANCHOR).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made. (Ak tento anchor v server.js nemáš presne takto, pošli mi aktuálny riadok s /vianoce routou a ja upravím patch.)`);
  process.exit(1);
}

const ADDITION = ANCHOR + "\napp.get('/kam-na-vysoku', (req,res)=>{res.sendFile(path.join(__dirname,'public','kam-na-vysoku.html'));});\napp.get('/kam-na-vysokou', (req,res)=>{res.sendFile(path.join(__dirname,'public','kam-na-vysoku.html'));});";

const backup = FILE + '.pre-kam-na-vysoku-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(ANCHOR).join(ADDITION));
console.log('OK - zaloha:', backup);
