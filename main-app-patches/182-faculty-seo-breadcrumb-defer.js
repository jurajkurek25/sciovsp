// SEO audit fix, časť 1/N:
//  1) Pridáva BreadcrumbList JSON-LD na fakultné stránky (v HTML už je
//     viditeľný breadcrumb nav od patchu 173, ale chýbala mu structured
//     data — bez toho Google nemôže zobraziť breadcrumb rich snippet
//     vo výsledkoch vyhľadávania).
//  2) Pridáva defer na <script src> pre supabase-js, qrcode-generator
//     a faculty-quiz-full.js — doteraz boli tieto 3 externé skripty
//     BLOKUJÚCE parsovanie stránky na KAŽDEJ z ~150 fakultných stránok,
//     čo zbytočne škodí Core Web Vitals (LCP) = ranking faktor.
//     DÔLEŽITÉ: defer sa musí dať na VŠETKY TRI naraz (nie len na CDN
//     skripty) — inak by faculty-quiz-full.js (ktorý čaká, kým existuje
//     window.supabase/window.qrcode) mohol spustiť skôr než sa deferred
//     CDN skripty stihnú vykonať, a celá registrácia by spadla na
//     "window.supabase is undefined".
//
// Predpoklad: main-app-patches/173, 177, 178, 181 uz su aplikovane.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/182-faculty-seo-breadcrumb-defer.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.182-faculty-seo-breadcrumb-defer-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes("'@type': 'BreadcrumbList'") && server.includes('faculty-quiz-full.js?v=4" defer>')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) BreadcrumbList JSON-LD ═══════════════════════
const OLD_JSONLD = `  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: rec.university,
    department: { '@type': 'CollegeOrUniversity', name: rec.faculty },
    address: { '@type': 'PostalAddress', addressLocality: rec.city, addressCountry: rec.country }
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(function(item) { return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }; })
  }];`;

const NEW_JSONLD = `  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: rec.university,
    department: { '@type': 'CollegeOrUniversity', name: rec.faculty },
    address: { '@type': 'PostalAddress', addressLocality: rec.city, addressCountry: rec.country }
  }, {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqItems.map(function(item) { return { '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }; })
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SP Tréner', item: BASE_URL_BLOG + '/' },
      { '@type': 'ListItem', position: 2, name: 'Fakulty', item: BASE_URL_BLOG + '/skola' },
      { '@type': 'ListItem', position: 3, name: rec.faculty, item: BASE_URL_BLOG + '/skola/' + rec.uSlug + '/' + rec.fSlug }
    ]
  }];`;

server = replaceOnce(server, OLD_JSONLD, NEW_JSONLD, 'jsonLd -> pridanie BreadcrumbList');

// ═══════════════════════ 2) defer na externé skripty (Core Web Vitals) ═══════════════════════
const OLD_SCRIPTS = `    + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
    + '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>'
    + '<script src="/js/faculty-quiz-full.js?v=4"></script>';`;

const NEW_SCRIPTS = `    + '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer></script>'
    + '<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js" defer></script>'
    + '<script src="/js/faculty-quiz-full.js?v=4" defer></script>';`;

server = replaceOnce(server, OLD_SCRIPTS, NEW_SCRIPTS, 'script tagy -> defer (poradie zachované, spoločne)');

const backup = SERVER_PATH + '.pre-faculty-seo-breadcrumb-defer-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ BreadcrumbList JSON-LD pridaný + 3 externé skripty na fakultných stránkach už neblokujú parsovanie (defer).');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
