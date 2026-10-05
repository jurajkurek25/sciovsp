// Jednorazové vyčistenie: kurzy vytvorené/upravené PRED patchom 18 mohli
// mať v sales_content uložený nesanitizovaný HTML (potenciálne aj
// <script>/onerror payload). Patch 18 chráni len NOVÉ uloženia -- tento
// skript prejde VŠETKY existujúce kurzy a sales_content prepíše na
// sanitizovanú verziu (rovnaký allowlist ako patch 18), aby bola DB
// čistá aj retroaktívne.
//
// Najprv spusti bez --apply (dry run, nič nezapíše, len vypíše, ktoré
// kurzy by sa zmenili a čo presne by sa odstránilo):
//   node patches/19-sanitize-existing-sales-content-cleanup.js
//
// Keď výstup vyzerá v poriadku, spusti so zápisom do DB:
//   node patches/19-sanitize-existing-sales-content-cleanup.js --apply
//
// Vyžaduje nainštalované sanitize-html (npm install sanitize-html) a
// spustenie z koreňa dash-service (potrebuje ../lib/db-main).

require('dotenv').config();
const sanitizeHtml = require('sanitize-html');
const { supabase: mainDb } = require('../lib/db-main');

const SALES_CONTENT_SANITIZE_OPTS = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }) }
};
function sanitizeSalesContent(html) {
  if (!html) return html;
  return sanitizeHtml(html, SALES_CONTENT_SANITIZE_OPTS);
}

const APPLY = process.argv.includes('--apply');

async function run() {
  const { data: courses, error } = await mainDb.from('courses').select('id, slug, title, sales_content');
  if (error) { console.error('❌ Chyba DB:', error.message); process.exit(1); }

  let changed = 0;
  for (const c of (courses || [])) {
    if (!c.sales_content) continue;
    const clean = sanitizeSalesContent(c.sales_content);
    if (clean === c.sales_content) continue;

    changed++;
    console.log('════════════ kurz "' + c.title + '" (' + c.slug + ', id=' + c.id + ') ════════════');
    console.log('PRED:', JSON.stringify(c.sales_content));
    console.log('PO:  ', JSON.stringify(clean));
    console.log('');

    if (APPLY) {
      const { error: updErr } = await mainDb.from('courses').update({ sales_content: clean }).eq('id', c.id);
      if (updErr) console.error('  ❌ Zápis zlyhal:', updErr.message);
      else console.log('  ✅ Uložené.');
    }
  }

  console.log('');
  console.log('Celkovo kurzov:', (courses || []).length, '| zmenených:', changed, '| mód:', APPLY ? 'APPLY (zapísané)' : 'DRY RUN (nič sa nezapísalo)');
  if (!APPLY && changed > 0) console.log('Spusti znova s --apply, aby sa zmeny naozaj uložili.');
}

run().catch(e => { console.error('CHYBA', e); process.exit(1); });
