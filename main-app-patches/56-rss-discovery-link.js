const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('type="application/rss+xml"')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const patched = replaceOnce(src,
  '<link rel="alternate" hreflang="x-default" href="https://sptrener.online/">',
  '<link rel="alternate" hreflang="x-default" href="https://sptrener.online/">\n<link rel="alternate" type="application/rss+xml" title="SP Tréner Blog" href="/blog/rss.xml">',
  'hreflang x-default link');

const backup = FILE + '.pre-rss-discovery-link-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
