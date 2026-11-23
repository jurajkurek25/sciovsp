const fs = require('fs');
const FILES = [
  'public/darcekova-karta-hotovo.html',
  'public/darek.html',
  'public/legal.html',
  'public/uplatnit-darcek.html'
];

// Matches the fixed IP:port prefix regardless of the (apparently per-file)
// random token — bounded by the literal single quotes delimiting src=.
const PATTERN = /<script type='text\/javascript' src='https:\/\/91\.99\.188\.203:8443\/[^']*'><\/script>/g;

for (const FILE of FILES) {
  if (!fs.existsSync(FILE)) { console.log(`SKIP: ${FILE} not found`); continue; }
  const src = fs.readFileSync(FILE, 'utf8');
  const matches = src.match(PATTERN);
  if (!matches || matches.length === 0) {
    console.log(`SKIP: ${FILE} — no match found`);
    continue;
  }
  console.log(`${FILE}: found ${matches.length} match(es):`);
  matches.forEach(m => console.log('  ' + m.slice(0, 90) + '...'));
  const backup = FILE + '.pre-remove-suspicious-script-v2-' + Date.now();
  fs.copyFileSync(FILE, backup);
  fs.writeFileSync(FILE, src.replace(PATTERN, ''));
  console.log(`OK: ${FILE} cleaned (backup: ${backup})`);
}
