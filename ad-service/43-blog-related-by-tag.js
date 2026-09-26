// "Ďalšie články" na konci každého blog postu doteraz brali jednoducho
// 3 NAJNOVŠIE články bez ohľadu na tému (napr. pod článkom o zebrách sa
// mohol zobraziť článok o práve, hoci existuje tematicky bližší článok
// o analógiách). Toto je reálna SEO aj UX slabina — chýbajúce prelinkovanie
// medzi tematicky príbuznými článkami oslabuje "topic cluster" signál pre
// vyhľadávače a znižuje šancu, že čitateľ zostane na webe dlhšie.
//
// Mení logiku na: najprv vezmi až 3 najnovšie články s ROVNAKÝM tagom, a
// ak ich je menej ako 3, doplň zvyšok najnovšími článkami odkiaľkoľvek
// (aby sekcia nikdy nebola prázdna/kratšia, ako predtým).
//
// Presný textový match proti overenému živému kódu (server.js:3119-3121).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/43-blog-related-by-tag.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('RELATED_FIELDS')) {
  console.error('❌ Vyzerá to, že oprava je už aplikovaná. Nič som nezmenil.');
  process.exit(1);
}

const OLD = `    const t = blogLocalized(post, lang);
    const { data: related } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs').eq('published', true).neq('slug', req.params.slug).order('created_at', { ascending: false }).limit(3);
    const relatedList = related || [];`;

const NEW = `    const t = blogLocalized(post, lang);
    const RELATED_FIELDS = 'slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs';
    let relatedList = [];
    if (post.tag) {
      const { data: sameTag } = await supabase.from('blog_posts').select(RELATED_FIELDS).eq('published', true).eq('tag', post.tag).neq('slug', req.params.slug).order('created_at', { ascending: false }).limit(3);
      relatedList = sameTag || [];
    }
    if (relatedList.length < 3) {
      const usedSlugs = [req.params.slug, ...relatedList.map(p => p.slug)];
      const { data: fillIn } = await supabase.from('blog_posts').select(RELATED_FIELDS).eq('published', true).not('slug', 'in', \`(\${usedSlugs.map(s => '"' + s + '"').join(',')})\`).order('created_at', { ascending: false }).limit(3 - relatedList.length);
      relatedList = relatedList.concat(fillIn || []);
    }`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presný očakávaný blok pre "related" query. Nič som nezmenil.');
  console.error('   Pošli mi aktuálny výstup: sed -n "3115,3125p" server.js');
  process.exit(1);
}

const backupPath = SERVER_PATH + '.pre-blog-related-tag-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
const out = src.replace(OLD, NEW);
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ "Ďalšie články" teraz uprednostňujú rovnaký tag pred najnovšími.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
