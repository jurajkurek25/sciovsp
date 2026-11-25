// Bezpečnostná oprava: course.sales_content sa ukladal do DB bez sanitizácie
// a potom sa (a) vykresľoval na verejnej stránke kurzu cez ${course.sales_content}
// BEZ escapovania a (b) načítaval v dash-i (dash.sptrener.online) cez
// quill.root.innerHTML pri editácii kurzu superadminom. Tento editor
// (instructor.sptrener.online) je plain <textarea> — nič tu neobmedzuje,
// čo inštruktor zadá, takže bez tejto opravy by mohol zákerný/kompromitovaný
// inštruktor dostať <script>/onerror payload priamo do SUPERADMIN session
// pri review kurzu. Táto oprava sanitizuje sales_content pri KAŽDOM
// uložení (POST aj PUT) cez sanitize-html s allowlistom.
//
// Pred spustením treba nainštalovať závislosť:
//   npm install sanitize-html
//
// Spusti z koreňa instructor-service:
//   node patches/10-sanitize-sales-content.js
// Potom: pm2 restart <meno instructor procesu>

const fs = require('fs');
const FILE = require('path').join(process.cwd(), 'routes', 'courses.js');
if (!fs.existsSync(FILE)) { console.error('❌ Nenašiel som routes/courses.js — spusti z koreňa instructor-service.'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('sanitizeSalesContent')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error('❌ ' + label + ' kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const REQUIRE_OLD = `const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { requireTermsAccepted } = require('./legal');
const { supabase: mainDb } = require('../lib/db-main');`;
const REQUIRE_NEW = `const express = require('express');
const router = express.Router();
const sanitizeHtml = require('sanitize-html');
const { requireInstructorAuth } = require('../lib/auth');
const { requireTermsAccepted } = require('./legal');
const { supabase: mainDb } = require('../lib/db-main');

// course.sales_content ide priamo do DB a potom sa (a) vykresľuje na
// verejnej stránke kurzu a (b) načítava cez quill.root.innerHTML pri
// editácii v dash-i — bez sanitizácie by mohol inštruktor dostať XSS
// payload do SUPERADMIN session pri review kurzu.
const SALES_CONTENT_SANITIZE_OPTS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) }
};
function sanitizeSalesContent(html) {
  if (!html) return html;
  return sanitizeHtml(html, SALES_CONTENT_SANITIZE_OPTS);
}`;
src = replaceOnce(src, REQUIRE_OLD, REQUIRE_NEW, 'require block');

const POST_OLD = `cover_image_url: coverImageUrl || null, sales_content: salesContent || null,`;
const POST_NEW = `cover_image_url: coverImageUrl || null, sales_content: sanitizeSalesContent(salesContent) || null,`;
src = replaceOnce(src, POST_OLD, POST_NEW, 'POST sales_content');

const PUT_OLD = `if (salesContent !== undefined) update.sales_content = salesContent;`;
const PUT_NEW = `if (salesContent !== undefined) update.sales_content = sanitizeSalesContent(salesContent);`;
src = replaceOnce(src, PUT_OLD, PUT_NEW, 'PUT sales_content');

const backup = FILE + '.pre-10-sanitize-sales-content-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);
console.log('✅ routes/courses.js prepísaný (sales_content sa teraz sanitizuje pri POST aj PUT). Záloha:', backup);
console.log('');
console.log('Over: node -c routes/courses.js');
console.log('Ak ešte nemáš nainštalované: npm install sanitize-html');
console.log('Reštart: pm2 restart <meno instructor procesu>');
