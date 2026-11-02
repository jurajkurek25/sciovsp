// Bezpečnostná oprava: course.sales_content sa doteraz vykresľoval na
// verejnej stránke kurzu (/kurzy/:slug) priamo cez ${course.sales_content}
// BEZ escapovania/sanitizácie — potvrdená stored-XSS diera (Quill editor
// v dash/instructor uloží raw innerHTML do DB, sem sa to vráti 1:1).
// Táto oprava je defense-in-depth na poslednom mieste, kde sa to reálne
// zobrazí verejne — sanitizuje sa priamo pri vykresľovaní (chráni aj
// staré, už uložené záznamy, nielen nové).
// Hlavná oprava (write-time, sanitizuje pri uložení) je v
// dash-service/patches/18 a instructor-service/patches/10.
//
// Pred spustením treba nainštalovať závislosť:
//   npm install sanitize-html
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/225-sanitize-sales-content-render.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.');
  process.exit(1);
}
let src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('SALES_CONTENT_SANITIZE')) {
  console.log('ℹ️  Už je aplikované, preskakujem.');
  process.exit(0);
}

const OLD = '    const salesHtml = course.sales_content ? `<article class="prose course-sales">${course.sales_content}</article>` : \'\';';
const count = src.split(OLD).length - 1;
if (count === 0) {
  console.error('❌ Nenašiel som presnú kotvu (salesHtml riadok). Pošli mi aktuálny obsah okolo "course-sales" v server.js, over znova.');
  process.exit(1);
}
if (count > 1) {
  console.error('❌ Kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
  process.exit(1);
}

const NEW = '    const salesHtml = course.sales_content ? `<article class="prose course-sales">${(() => { /* SALES_CONTENT_SANITIZE */ const sanitizeHtml = require(\'sanitize-html\'); return sanitizeHtml(course.sales_content, { allowedTags: [\'p\',\'br\',\'strong\',\'b\',\'em\',\'i\',\'h2\',\'h3\',\'ul\',\'ol\',\'li\',\'blockquote\',\'a\'], allowedAttributes: { a: [\'href\',\'target\',\'rel\'] }, allowedSchemes: [\'http\',\'https\',\'mailto\'], transformTags: { a: sanitizeHtml.simpleTransform(\'a\', { target: \'_blank\', rel: \'noopener noreferrer nofollow\' }) } }); })()}</article>` : \'\';';

src = src.replace(OLD, () => NEW);

const backup = SERVER_PATH + '.pre-225-sanitize-sales-content-render-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, src);
console.log('✅ server.js prepísaný (sales_content sa pri vykresľovaní na /kurzy/:slug teraz sanitizuje). Záloha:', backup);
console.log('');
console.log('Over: node -c server.js');
console.log('Ak ešte nemáš nainštalované: npm install sanitize-html');
console.log('Reštart: pm2 restart <meno procesu hlavnej appky>');
