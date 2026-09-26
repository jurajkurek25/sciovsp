// Súčasť delenia reklám podľa jazyka publika (SK vs CZ):
//   1) /blog listing filtruje články podľa target_lang vs aktuálny ?lang=
//   2) /api/rewards/video-status a /api/rewards/video/start filtrujú
//      video_ads (MySQL) podľa ?lang= query parametra z appky
//   3) /api/internal/publish-blog-post prijíma target_lang z appky
//      ad.sptrener.online a ukladá ho
//
// Poznámka ku konvencii: appka ad.sptrener.online aj hlavná appka (app.html)
// používajú 'sk'/'cz'. Blog interne používa 'cs' (nie 'cz') pre český jazyk —
// prevod sa deje len na tomto jednom mieste (audienceLangs nižšie).
//
// Presný textový match proti overenému živému kódu server.js.
// Predpoklad: db/add_target_lang_column.sql už bola spustená (stĺpec
// blog_posts.target_lang existuje) a 45-internal-publish-blog-post.js
// už bol aplikovaný.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/46-target-lang-blog-rewards.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('audienceLangs')) {
  console.error('❌ Vyzerá to, že target_lang filtrovanie už je zapojené. Nič som nezmenil.');
  process.exit(1);
}

const OLD_BLOG_LIST = `    const tagFilter = req.query.tag ? String(req.query.tag).slice(0, 100) : null;
    let query = supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs,created_at').eq('published', true);
    if (tagFilter) query = query.eq('tag', tagFilter);`;

const NEW_BLOG_LIST = `    const tagFilter = req.query.tag ? String(req.query.tag).slice(0, 100) : null;
    const audienceLangs = lang === 'cs' ? ['cz', 'both'] : ['sk', 'both'];
    let query = supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,title_cs,excerpt_cs,tag_cs,read_time_cs,created_at,target_lang').eq('published', true).in('target_lang', audienceLangs);
    if (tagFilter) query = query.eq('tag', tagFilter);`;

const OLD_REWARDS = `    const [[{ cnt: adsAvailable }]] = await adsDb.query(
      "SELECT COUNT(*) AS cnt FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW()"
    );
    const used = await todaysRewardCount(email);
    const dailyRemaining = Math.max(0, DAILY_REWARD_LIMIT - used);
    res.json({ available: (adsAvailable || 0) > 0 && dailyRemaining > 0, dailyRemaining });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/start', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) return res.status(429).json({ error: \`Dnes si už vyčerpal denný limit \${DAILY_REWARD_LIMIT} bonus testov za reklamu.\` });

    const [ads] = await adsDb.query(
      "SELECT id, public_url, duration_s, link_url FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW()"
    );`;

const NEW_REWARDS = `    const rewardLang = ['sk', 'cz'].includes(req.query.lang) ? req.query.lang : null;
    const rewardLangClause = rewardLang ? "AND (target_lang = 'both' OR target_lang = ?)" : '';
    const rewardLangParams = rewardLang ? [rewardLang] : [];
    const [[{ cnt: adsAvailable }]] = await adsDb.query(
      \`SELECT COUNT(*) AS cnt FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW() \${rewardLangClause}\`,
      rewardLangParams
    );
    const used = await todaysRewardCount(email);
    const dailyRemaining = Math.max(0, DAILY_REWARD_LIMIT - used);
    res.json({ available: (adsAvailable || 0) > 0 && dailyRemaining > 0, dailyRemaining });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/start', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) return res.status(429).json({ error: \`Dnes si už vyčerpal denný limit \${DAILY_REWARD_LIMIT} bonus testov za reklamu.\` });

    const startLang = ['sk', 'cz'].includes(req.query.lang) ? req.query.lang : null;
    const startLangClause = startLang ? "AND (target_lang = 'both' OR target_lang = ?)" : '';
    const startLangParams = startLang ? [startLang] : [];
    const [ads] = await adsDb.query(
      \`SELECT id, public_url, duration_s, link_url FROM video_ads WHERE active = 1 AND status = 'active' AND current_period_end > NOW() \${startLangClause}\`,
      startLangParams
    );`;

const OLD_INTERNAL_PUBLISH_DESTRUCTURE = `  const { slug, title, excerpt, content, tag, read_time, title_cs, excerpt_cs, content_cs, tag_cs, read_time_cs, sponsor_name } = req.body || {};`;

const NEW_INTERNAL_PUBLISH_DESTRUCTURE = `  const { slug, title, excerpt, content, tag, read_time, title_cs, excerpt_cs, content_cs, tag_cs, read_time_cs, sponsor_name, target_lang } = req.body || {};`;

const OLD_INTERNAL_PUBLISH_INSERT = `      sponsored: true, sponsor_name: sponsor_name || null, published: true
    }).select('slug').single();`;

const NEW_INTERNAL_PUBLISH_INSERT = `      sponsored: true, sponsor_name: sponsor_name || null, published: true,
      target_lang: ['sk', 'cz', 'both'].includes(target_lang) ? target_lang : 'both'
    }).select('slug').single();`;

const REPLACEMENTS = [
  ['blog listing filter', OLD_BLOG_LIST, NEW_BLOG_LIST],
  ['reward video lang filter', OLD_REWARDS, NEW_REWARDS],
  ['internal publish destructure', OLD_INTERNAL_PUBLISH_DESTRUCTURE, NEW_INTERNAL_PUBLISH_DESTRUCTURE],
  ['internal publish insert', OLD_INTERNAL_PUBLISH_INSERT, NEW_INTERNAL_PUBLISH_INSERT]
];

for (const [name, needle] of REPLACEMENTS) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v server.js. Nič som nezmenil.`);
    console.error('   Over, či sú aplikované 43-blog-related-by-tag.js, 45-internal-publish-blog-post.js a či existuje adsDb pool (reward video flow).');
    process.exit(1);
  }
}

const backupPath = SERVER_PATH + '.pre-target-lang-blog-rewards-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
let out = src;
for (const [, oldStr, newStr] of REPLACEMENTS) {
  out = out.replace(oldStr, newStr);
}
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ target_lang filtrovanie zapojené (/blog listing, reward video, internal publish endpoint).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
