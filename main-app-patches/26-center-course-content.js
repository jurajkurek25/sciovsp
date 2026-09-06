const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `.course-sales{margin:2rem 0}
</style>\`;`;
const NEW = `.course-sales{margin:2rem 0}
.hero-title{text-align:center}
.course-tagline{text-align:center}
.course-outline-heading{text-align:center}
.course-buy-box{justify-content:center;text-align:center}
.bp-mount{margin-left:auto;margin-right:auto}
</style>\`;`;

if (src.includes('.hero-title{text-align:center}')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som koniec KURZY_STYLE kotvu. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-center-course-content-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
