const fs = require('fs');
const FILE = 'public/darcekova-karta.html';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes("sessionStorage.getItem('partner_ref')")) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
const OLD = `    const res = await fetch('/api/gift-cards/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        optionId: selectedOption.id, buyerEmail, includeCourse: includeAddon,
        recipientName: $('#recipientName').value.trim(), message: $('#giftMessage').value.trim()
      })
    });`;
const NEW = `    const res = await fetch('/api/gift-cards/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        optionId: selectedOption.id, buyerEmail, includeCourse: includeAddon,
        recipientName: $('#recipientName').value.trim(), message: $('#giftMessage').value.trim(),
        refCode: sessionStorage.getItem('partner_ref') || null
      })
    });`;
const count = src.split(OLD).length - 1;
if (count !== 1) { console.error(`ABORT: anchor occurs ${count} times. No changes.`); process.exit(1); }
const backup = FILE + '.pre-partner-refcode-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(OLD).join(NEW));
console.log('OK - zaloha:', backup);
