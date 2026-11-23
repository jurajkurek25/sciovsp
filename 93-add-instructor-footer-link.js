const fs = require('fs');
const FILE = 'public/index.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('footerInstructorLink')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const HTML_OLD = `    <a href="/app" id="footerAppLink">Aplikácia</a>
    <a href="/blog" id="footerBlogLink">Blog</a>
    <a href="/kurzy" id="footerKurzyLink">Kurzy</a>
    <a href="mailto:juraj@jurajkurek.com" id="footerContactLink">Kontakt</a>`;
const HTML_NEW = `    <a href="/app" id="footerAppLink">Aplikácia</a>
    <a href="/blog" id="footerBlogLink">Blog</a>
    <a href="/kurzy" id="footerKurzyLink">Kurzy</a>
    <a href="https://instructor.sptrener.online" id="footerInstructorLink">Inštruktori</a>
    <a href="mailto:juraj@jurajkurek.com" id="footerContactLink">Kontakt</a>`;

const JS_OLD = `sT('footerAppLink', t.footerApp); sT('footerBlogLink', t.footerBlog); sT('footerContactLink', t.footerContact);`;
const JS_NEW = `sT('footerAppLink', t.footerApp); sT('footerBlogLink', t.footerBlog); sT('footerContactLink', t.footerContact); sT('footerInstructorLink', t.footerInstructor);`;

const SK_OLD = `footerApp:'Aplikácia',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Súkromie',`;
const SK_NEW = `footerApp:'Aplikácia',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Súkromie',footerInstructor:'Inštruktori',`;

const CZ_OLD = `footerApp:'Aplikace',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Soukromí',`;
const CZ_NEW = `footerApp:'Aplikace',footerBlog:'Blog',footerContact:'Kontakt',footerVop:'VOP',footerPrivacy:'Soukromí',footerInstructor:'Instruktoři',`;

const anchors = [
  ['HTML footer block', HTML_OLD],
  ['JS setter calls', JS_OLD],
  ['SK translations', SK_OLD],
  ['CZ translations', CZ_OLD],
];
for (const [name, anchor] of anchors) {
  const count = src.split(anchor).length - 1;
  if (count !== 1) {
    console.error(`Kotva '${name}' nie je jednoznacna (najdenych: ${count}). Nic som nezmenil. Posli mi presny okolity text z live suboru.`);
    process.exit(1);
  }
}

let patched = src;
patched = patched.replace(HTML_OLD, HTML_NEW);
patched = patched.replace(JS_OLD, JS_NEW);
patched = patched.replace(SK_OLD, SK_NEW);
patched = patched.replace(CZ_OLD, CZ_NEW);

const backup = FILE + '.pre-instructor-footer-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Inštruktori pridani do footera (HTML + i18n SK/CZ).');
