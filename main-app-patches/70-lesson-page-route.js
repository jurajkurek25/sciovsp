const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/kurzy/:slug/watch/:lessonId'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD = "app.get('/kurzy/:slug/watch', (req, res) => {\n  res.sendFile(path.join(__dirname, 'public', 'kurz-watch.html'));\n});\n";
const NEW = OLD + "\napp.get('/kurzy/:slug/watch/:lessonId', (req, res) => {\n  res.sendFile(path.join(__dirname, 'public', 'kurz-watch.html'));\n});\n";

const patched = replaceOnce(src, OLD, NEW, '/kurzy/:slug/watch route');

const backup = FILE + '.pre-lesson-page-route-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
