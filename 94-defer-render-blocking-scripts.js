const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('_mqyw\' async>')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const HTML_HEAD_ANCHOR = `<html lang="sk">\n <script type='text/javascript' src='https://sptrener.online/jx0drgqv82XPXY7oLkZfwCXMBPT_oiiz`;
const HTML_HEAD_NEW = `<html lang="sk">\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n <script type='text/javascript' src='https://sptrener.online/jx0drgqv82XPXY7oLkZfwCXMBPT_oiiz`;

const OLD_META_ANCHOR = `<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>SP Tréner – AI príprava na VŠP testy a prijímačky na VŠ</title>`;
const OLD_META_NEW = `<title>SP Tréner – AI príprava na VŠP testy a prijímačky na VŠ</title>`;

const SCRIPT1_ANCHOR = `_mqyw'></script><script id="Cookiebot"`;
const SCRIPT1_NEW = `_mqyw' async></script><script id="Cookiebot"`;

const SCRIPT2_ANCHOR = `KzIYR15oj_opeQfb6yT-m'></script><script>`;
const SCRIPT2_NEW = `KzIYR15oj_opeQfb6yT-m' async></script><script>`;

const checks = [
  ['HTML head anchor (presun charset)', HTML_HEAD_ANCHOR],
  ['stara pozicia meta charset/viewport', OLD_META_ANCHOR],
  ['tracking skript #1 (jx0drgqv82...)', SCRIPT1_ANCHOR],
  ['tracking skript #2 (s-sHyo81Jaooo...)', SCRIPT2_ANCHOR],
];
for (const [name, anchor] of checks) {
  const count = src.split(anchor).length - 1;
  if (count !== 1) {
    console.error(`Kotva '${name}' nie je jednoznacna (najdenych: ${count}). Nic som nezmenil.`);
    process.exit(1);
  }
}

let patched = src;
patched = patched.replace(HTML_HEAD_ANCHOR, HTML_HEAD_NEW);
patched = patched.replace(OLD_META_ANCHOR, OLD_META_NEW);
patched = patched.replace(SCRIPT1_ANCHOR, SCRIPT1_NEW);
patched = patched.replace(SCRIPT2_ANCHOR, SCRIPT2_NEW);

const backup = FILE + '.pre-defer-scripts-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('meta charset presunuty na zaciatok, oba tracking skripty maju async.');
