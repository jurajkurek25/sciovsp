const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("app.get('/kod'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

// 1) require('qrcode')
const REQ_OLD = `const PDFDocument = require('pdfkit');`;
const REQ_NEW = `const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');`;
const reqCount = src.split(REQ_OLD).length - 1;
if (reqCount !== 1) { console.error('require kotva nie je jednoznacna (najdenych: ' + reqCount + '). Nic som nezmenil.'); process.exit(1); }

// 2) /kod redirect, inserted before the SPA fallback (same safe spot as other page routes).
const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;
const spaCount = src.split(SPA_MARKER).length - 1;
if (spaCount !== 1) { console.error('SPA fallback kotva nie je jednoznacna (najdenych: ' + spaCount + '). Nic som nezmenil.'); process.exit(1); }
const KOD_ROUTE = `app.get('/kod', (req, res) => { res.redirect('/uplatnit-darcek'); });

` + SPA_MARKER;

// 3) PDF: swap footer link to the short URL + embed a QR code pointing at it.
const PDF_OLD = `    doc.fillColor('#5c5c7a').fontSize(8).font('Helvetica').text('Uplatni na sptrener.online/uplatnit-darcek', 30, 245);
    doc.end();`;
const PDF_NEW = `    doc.fillColor('#5c5c7a').fontSize(8).font('Helvetica').text('Uplatni na sptrener.online/kod', 30, 245);
    try {
      const qrBuffer = await QRCode.toBuffer('https://sptrener.online/kod', { errorCorrectionLevel: 'M', width: 200, margin: 0 });
      doc.image(qrBuffer, 352, 20, { width: 46, height: 46 });
    } catch (qrErr) {
      console.error('gift card pdf QR error:', qrErr.message);
    }
    doc.end();`;
const pdfCount = src.split(PDF_OLD).length - 1;
if (pdfCount !== 1) { console.error('PDF footer kotva nie je jednoznacna (najdenych: ' + pdfCount + '). Nic som nezmenil.'); process.exit(1); }

const patched = src
  .replace(REQ_OLD, REQ_NEW)
  .replace(SPA_MARKER, KOD_ROUTE)
  .replace(PDF_OLD, PDF_NEW);

const backup = FILE + '.pre-kod-redirect-qr-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
