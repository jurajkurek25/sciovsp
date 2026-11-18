// Registers the AutoSEO webhook + /blog/:slug fallback route as early as
// possible in server.js (right after `const app = express();`), so:
//   1. its own express.raw() middleware sees the request before the
//      app-wide express.json() parser touches the body (needed for HMAC
//      signature verification over the raw bytes), and
//   2. its GET /blog/:slug handler runs before whatever /blog/:slug route
//      already exists further down in server.js, falling through via
//      next() when there's no AutoSEO match so existing posts are
//      completely unaffected.
// All actual logic lives in routes/autoseoWebhook.js — this patch only
// adds the one require+invoke line.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const MARKER = "require('./routes/autoseoWebhook')(app);";
if (src.includes(MARKER)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = 'const app = express();';
const NEW = "const app = express();\nrequire('./routes/autoseoWebhook')(app);";

const patched = replaceOnce(src, OLD, NEW, 'express app init');

const backup = FILE + '.pre-autoseo-webhook-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK — zálohované do', backup, '— AutoSEO webhook zaregistrovaný na /api/webhooks/autoseo. Reštartni proces.');
