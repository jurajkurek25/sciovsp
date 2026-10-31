// /legal returns HTTP 200 but the browser shows "404" — there's no
// dedicated server route for the extension-less path, so it falls through
// to the SPA catch-all (serves index.html), whose client-side JS doesn't
// recognize /legal and renders a not-found state, even though the HTTP
// status itself is 200. Adding a direct route bypasses that fallback
// entirely, regardless of what index.html's client-side logic does.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/legal'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const ANCHOR = "app.get('/kam-na-vysokou', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'kam-na-vysoku.html')); });";

const count = src.split(ANCHOR).length - 1;
if (count !== 1) {
  console.error(`ABORT: anchor occurs ${count} times (expected 1). No changes made. (Pošli mi 'grep -n "kam-na-vysokou" server.js', ak sa formátovanie líši.)`);
  process.exit(1);
}

const ADDITION = ANCHOR + "\napp.get('/legal', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'legal.html')); });";

const backup = FILE + '.pre-legal-clean-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(ANCHOR).join(ADDITION));
console.log('OK - zaloha:', backup);
