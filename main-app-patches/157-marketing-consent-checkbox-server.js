// Zapoji marketingConsent (z patchu 156) do /api/stripe/checkout —
// uklada sa ako marketing_emails_opt_out = !marketingConsent. Aktualizuje
// sa vzdy ked klient hodnotu posle (aj pre existujuceho zakaznika, aby
// sa rešpektovala jeho najaktualnejsia volba pri kazdom nakupe).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.157-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('marketingConsent')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnceRegex(s, regex, buildNew, label) {
  const g = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
  const matches = s.match(g);
  const count = matches ? matches.length : 0;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(regex, buildNew);
}

const patched = replaceOnceRegex(src,
  /const \{ refCode, refType, plan \} = req\.body;/,
  `const { refCode, refType, plan, marketingConsent } = req.body;
    if (marketingConsent !== undefined) {
      await supabase.from('users').update({ marketing_emails_opt_out: !marketingConsent }).eq('email', email);
    }`,
  '1: /api/stripe/checkout marketingConsent wiring');

const backup = FILE + '.pre-marketing-consent-checkbox-server-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
