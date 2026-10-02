// Registers app-wide maintenance mode BEFORE the AutoSEO webhook route,
// so when maintenance is ON it blocks literally everything — including
// the webhook — per "bez ohľadu na to či stránka existuje alebo nie".
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const MARKER = "require('./routes/maintenanceMode')(app);";
if (src.includes(MARKER)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = "require('./routes/autoseoWebhook')(app);";
const NEW = "require('./routes/maintenanceMode')(app);\nrequire('./routes/autoseoWebhook')(app);";

const patched = replaceOnce(src, OLD, NEW, 'autoseoWebhook require');

const backup = FILE + '.pre-maintenance-mode-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK — zálohované do', backup, '— maintenance mode zaregistrovaný. Reštartni proces.');
