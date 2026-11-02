// Vytvára public/robots.txt, ktorý na produkcii úplne chýbal (potvrdené
// príkazom `cat public/robots.txt 2>/dev/null || echo "NO robots.txt FOUND"`).
// Súčasť SEO maximalizácie blogu — explicitne povoľuje AI crawlery
// (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, OAI-SearchBot) a
// odkazuje na existujúci dynamický /sitemap.xml (viď 14-blog-seo-and-
// reading-experience.js). Blokuje len /api/ (backend, nie obsah) a /app
// (prihlásená appka bez SEO hodnoty — vyhýba sa tenkému/duplicitnému obsahu
// v indexe).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/38-robots-txt.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'robots.txt');

if (fs.existsSync(FILE_PATH)) {
  console.error('❌ public/robots.txt už existuje. Nič som nezmenil (zmaž ho ručne, ak ho chceš prepísať).');
  process.exit(1);
}

const CONTENT = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /app

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://sptrener.online/sitemap.xml
`;

fs.writeFileSync(FILE_PATH, CONTENT);

console.log('✅ public/robots.txt vytvorený.');
console.log('   Over na https://sptrener.online/robots.txt po reštarte servera.');
