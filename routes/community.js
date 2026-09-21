// Študentská komunita — feed príspevkov, komentáre, lajky, profily
// (vlastná fotka + bio) a samostatná fotogaléria. Prístup je výhradne pre
// tých, čo majú users.community_access_until v budúcnosti (nastavuje sa
// VÝHRADNE vo webhooku pri webinárovej ceste nákupu Premium/Elite na
// /ponuka — pozri main-app-patches/118-community-backend.js).
// Moderácia (mazanie cudzích príspevkov/fotiek, blokovanie používateľov,
// manuálne udelenie prístupu) žije v dash-service, nie tu — tento súbor
// rieši len bežné používateľské akcie (vlastný príspevok/komentár/fotka,
// lajky, profil, čítanie feedu).
//
// module.exports je funkcia, ktorú voláš ako require('./routes/community')(app)
// — rovnaký vzor ako routes/maintenanceMode.js a routes/autoseoWebhook.js
// (jediné dva routes/*.js súbory, ktoré server.js skutočne require()-uje;
// ostatné routes/*.js v tomto repozitári sú mŕtvy kód).
'use strict';

const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const crypto = require('crypto');
const { pickStartingModel, markModelGood, getNewestUntriedModel, tierOf } = require('./lib/resolveModel');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const POST_BODY_MAX = 4000;
const COMMENT_BODY_MAX = 1000;
const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 300;
const CAPTION_MAX = 300;
const DM_BODY_MAX = 2000;
const DM_REPORT_MAX_MESSAGES = 60;
const PAGE_SIZE = 20;

async function verifyToken(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

// Jediné miesto, ktoré rozhoduje o prístupe do komunity — rovnaký princíp
// ako getWebinarOfferStatus v server.js: jeden zdroj pravdy, používaný
// všade (access-status endpoint aj samotný gate middleware nižšie).
async function getCommunityAccess(email) {
  const { data: userRow } = await supabase
    .from('users')
    .select('community_access_until, community_banned_at')
    .eq('email', email)
    .maybeSingle();
  const banned = !!userRow?.community_banned_at;
  const hasAccess = !banned && !!userRow?.community_access_until && new Date(userRow.community_access_until) > new Date();
  return { hasAccess, banned, accessUntil: userRow?.community_access_until || null };
}

// Vygeneruje unikátne používateľské meno z lokálnej časti emailu (pred
// zavináčom) — nikdy sa nezobrazuje surový email ako identita v komunite,
// toto je fallback, kým si človek nenastaví vlastné meno.
async function generateUsername(email) {
  const base = (email.split('@')[0] || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'clen';
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = attempt === 0 ? base : base + Math.floor(1000 + Math.random() * 9000);
    const { data: taken } = await supabase.from('community_profiles').select('email').eq('username', candidate).maybeSingle();
    if (!taken) return candidate;
  }
  return base + crypto.randomBytes(3).toString('hex');
}

// Zabezpečí, že daný email má profil s vygenerovaným username (vytvorí ho
// pri prvom volaní) — volá sa pri každom prístupe do komunity aj pri
// dávkovom dopĺňaní zoznamu členov, aby email nikdy neunikol ako fallback.
async function ensureProfile(email) {
  const { data: existing } = await supabase.from('community_profiles').select('*').eq('email', email).maybeSingle();
  if (existing && existing.username) return existing;
  const username = await generateUsername(email);
  if (existing) {
    const { data: updated } = await supabase.from('community_profiles').update({ username, updated_at: new Date().toISOString() }).eq('email', email).select().single();
    return updated || existing;
  }
  const { data: created, error } = await supabase.from('community_profiles').insert({ email, username }).select().single();
  if (error) {
    // Race: iný súbežný request medzitým vytvoril profil pre ten istý
    // email (napr. dvojklik) — načítaj ho namiesto zlyhania.
    const { data: retry } = await supabase.from('community_profiles').select('*').eq('email', email).maybeSingle();
    if (retry) return retry;
    throw error;
  }
  return created;
}

async function requireCommunityAccess(req, res, next) {
  const user = await verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
  const email = (user.email || '').toString().trim().toLowerCase();
  const access = await getCommunityAccess(email);
  if (access.banned) return res.status(403).json({ error: 'Prístup do komunity je zablokovaný.' });
  if (!access.hasAccess) return res.status(403).json({ error: 'Komunita je dostupná len pre členov, ktorí si Premium/Elite kúpili cez ponuku po webinári.' });
  req.communityEmail = email;
  const googleName = user.user_metadata?.full_name || user.user_metadata?.name || null;
  const myProfile = await ensureProfile(email);
  req.communityName = myProfile.display_name || googleName;
  req.communityAvatarUrl = myProfile.avatar_url || null;
  req.communityUsername = myProfile.username;
  next();
}

// Dávkové načítanie profilov (meno/fotka/username) pre množinu emailov —
// používa sa pri vypisovaní feedu/komentárov/galérie, aby sa vždy zobrazil
// aktuálny profil, nie len snímka mena uložená pri vytvorení príspevku.
async function getProfilesMap(emails) {
  const unique = [...new Set(emails)];
  if (!unique.length) return {};
  const { data } = await supabase.from('community_profiles').select('email, display_name, avatar_url, username').in('email', unique);
  const map = {};
  for (const p of data || []) map[p.email] = p;
  return map;
}

// Meno na zobrazenie pre iného člena: vlastné meno > username > (nikdy)
// email. Použi vždy namiesto priameho `|| email` fallbacku.
function displayNameOf(profile, email) {
  return (profile && profile.display_name) || (profile && profile.username) || email;
}

function serializePost(row, likedPostIds, commentCounts, profiles) {
  const profile = profiles?.[row.author_email];
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorName: (profile && profile.display_name) || row.author_name,
    authorAvatarUrl: profile?.avatar_url || null,
    body: row.body,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    likeCount: row.like_count || 0,
    liked: likedPostIds.has(row.id),
    commentCount: commentCounts[row.id] || 0
  };
}

function serializeComment(row, likedCommentIds, likeCounts, profiles) {
  const profile = profiles?.[row.author_email];
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorName: (profile && profile.display_name) || row.author_name,
    authorAvatarUrl: profile?.avatar_url || null,
    body: row.body,
    createdAt: row.created_at,
    likeCount: likeCounts[row.id] || 0,
    liked: likedCommentIds.has(row.id)
  };
}

function serializePhoto(row, profiles) {
  const profile = profiles?.[row.author_email];
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorName: (profile && profile.display_name) || row.author_name,
    authorAvatarUrl: profile?.avatar_url || null,
    imageUrl: row.image_url,
    caption: row.caption,
    createdAt: row.created_at
  };
}

async function uploadToCommunityBucket(prefix, email, file) {
  const path = prefix + '/' + email.replace(/[^a-z0-9]/gi, '_') + '/' + Date.now() + '-' + crypto.randomBytes(4).toString('hex');
  const { error } = await supabase.storage.from('community').upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('community').getPublicUrl(path);
  return pub.publicUrl;
}

// ── Súkromné 1:1 správy ──────────────────────────────────────────────────
// Obsah konverzácie je úplne súkromný (žiadny dash-service endpoint ho
// nevystavuje). Jediná moderácia je AI posúdenie pri nahlásení — pozri
// callClaudeJudge nižšie a db/migrate_community_dm.sql.

function conversationPair(a, b) { return a < b ? [a, b] : [b, a]; }

async function getOrCreateConversation(emailA, emailB) {
  const [userA, userB] = conversationPair(emailA, emailB);
  const { data: existing } = await supabase.from('community_conversations').select('*').eq('user_a', userA).eq('user_b', userB).maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabase.from('community_conversations').insert({ user_a: userA, user_b: userB }).select().single();
  if (error) {
    // Race: druhý paralelný request medzitým vytvoril tú istú konverzáciu
    // (unique constraint na user_a/user_b) — skús ju načítať znova namiesto
    // toho, aby sa celá požiadavka zbytočne zamietla chybou.
    const { data: retry } = await supabase.from('community_conversations').select('*').eq('user_a', userA).eq('user_b', userB).maybeSingle();
    if (retry) return retry;
    throw error;
  }
  return created;
}

function buildReportPrompt(messages, reporterEmail, reportedEmail) {
  const transcript = messages.map(m => `[${m.sender_email === reportedEmail ? 'NAHLÁSENÝ' : 'DRUHÁ STRANA'}] ${m.body}`).join('\n');
  return `Si moderátor súkromných správ v komunite pre študentov, ktorí sa pripravujú na vysokoškolské prijímacie testy (typicky 17-20 rokov, blízko plnoletosti alebo už plnoletí). Účastník ${reporterEmail} nahlásil konverzáciu s účastníkom ${reportedEmail}. Tvoja jediná úloha: posúdiť, či správanie účastníka označeného v prepise ako "NAHLÁSENÝ" porušuje bežné pravidlá slušného správania — obťažovanie, vyhrážky, sexuálne obťažovanie, nenávistné prejavy, nátlak, spam/podvod, alebo inak jasne neprijateľné správanie.

Bežná nezhoda, hádka bez urážok, alebo len nepríjemná no civilná konverzácia NIE JE dôvod na zablokovanie — ľudia majú právo sa nezhodnúť alebo si niekoho nevšímať. Ak si nie si istý/á a v prepise nie je jasný, konkrétny dôkaz porušenia, rozhodni v prospech "dismiss".

Prepis konverzácie (chronologicky, najnovšie posledné):
${transcript}

Odpovedz VÝHRADNE validným JSON objektom, žiadny iný text:
{"verdict": "block" alebo "dismiss", "reasoning": "jedna až dve vety po slovensky, prečo"}`;
}

async function callClaudeJudge(prompt) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { verdict: 'dismiss', reasoning: 'AI kontrola nie je nakonfigurovaná (chýba ANTHROPIC_API_KEY) — nahlásenie nebolo možné automaticky posúdiť.' };
  }
  let response;
  const triedModels = [];
  let model = pickStartingModel();
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      triedModels.push(model);
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'user', content: prompt }] })
      });
      if (response.ok) { markModelGood(model); break; }
      const errText = await response.text();
      const looksLikeModelIssue = response.status === 404 || /model/i.test(errText);
      if (!looksLikeModelIssue) {
        console.error('community report AI error:', errText);
        return { verdict: 'dismiss', reasoning: 'AI kontrola zlyhala — nahlásenie nebolo možné automaticky posúdiť.' };
      }
      const next = await getNewestUntriedModel(triedModels, tierOf(model));
      if (!next) {
        console.error('community report AI error:', errText);
        return { verdict: 'dismiss', reasoning: 'AI kontrola zlyhala — nahlásenie nebolo možné automaticky posúdiť.' };
      }
      model = next;
    }
  } catch (e) {
    console.error('community report AI call error:', e.message);
    return { verdict: 'dismiss', reasoning: 'AI kontrola zlyhala — nahlásenie nebolo možné automaticky posúdiť.' };
  }
  const data = await response.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);
    return { verdict: parsed.verdict === 'block' ? 'block' : 'dismiss', reasoning: (parsed.reasoning || '').toString().slice(0, 500) };
  } catch (e) {
    console.error('community report AI parse error:', text);
    return { verdict: 'dismiss', reasoning: 'Odpoveď AI kontroly sa nepodarila spracovať.' };
  }
}

module.exports = function registerCommunity(app) {
  // GET /api/community/access-status — ľahká kontrola pre frontend pred
  // zobrazením UI (nie samotné dáta, len či má daný účet prístup).
  app.get('/api/community/access-status', async (req, res) => {
    const user = await verifyToken(req);
    if (!user) return res.json({ hasAccess: false, banned: false, accessUntil: null });
    const access = await getCommunityAccess((user.email || '').toString().trim().toLowerCase());
    res.json(access);
  });

  // GET /api/community/posts?before=<postId> — feed, najnovšie prvé.
  app.get('/api/community/posts', requireCommunityAccess, async (req, res) => {
    try {
      let query = supabase.from('community_posts').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(PAGE_SIZE);
      const before = parseInt(req.query.before, 10);
      if (before) query = query.lt('id', before);
      const { data: posts, error } = await query;
      if (error) throw error;
      const postIds = (posts || []).map(p => p.id);
      let likedPostIds = new Set();
      let commentCounts = {};
      let likeCounts = {};
      if (postIds.length) {
        const [{ data: myLikes }, { data: comments }, { data: allLikes }] = await Promise.all([
          supabase.from('community_likes').select('post_id').eq('author_email', req.communityEmail).in('post_id', postIds),
          supabase.from('community_comments').select('post_id').is('deleted_at', null).in('post_id', postIds),
          supabase.from('community_likes').select('post_id').in('post_id', postIds)
        ]);
        likedPostIds = new Set((myLikes || []).map(l => l.post_id));
        for (const c of comments || []) commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
        for (const l of allLikes || []) likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
      }
      const profiles = await getProfilesMap((posts || []).map(p => p.author_email));
      res.json({
        posts: (posts || []).map(p => serializePost({ ...p, like_count: likeCounts[p.id] || 0 }, likedPostIds, commentCounts, profiles)),
        hasMore: (posts || []).length === PAGE_SIZE
      });
    } catch (e) {
      console.error('community posts list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/community/posts — nový príspevok, voliteľne s jedným obrázkom.
  app.post('/api/community/posts', requireCommunityAccess, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'Obrázok sa nepodarilo nahrať (max 5 MB).' });
      const body = (req.body?.body || '').toString().trim();
      if (!body && !req.file) return res.status(400).json({ error: 'Príspevok nemôže byť prázdny.' });
      if (body.length > POST_BODY_MAX) return res.status(400).json({ error: 'Príspevok je príliš dlhý.' });
      try {
        let imageUrl = null;
        if (req.file) {
          if (!IMAGE_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú len PNG, JPG, WEBP alebo GIF.' });
          imageUrl = await uploadToCommunityBucket('posts', req.communityEmail, req.file);
        }
        const { data: post, error } = await supabase.from('community_posts').insert({
          author_email: req.communityEmail,
          author_name: req.communityName,
          body: body || null,
          image_url: imageUrl
        }).select().single();
        if (error) throw error;
        const profiles = { [req.communityEmail]: { display_name: req.communityName, avatar_url: req.communityAvatarUrl } };
        res.json({ post: serializePost({ ...post, like_count: 0 }, new Set(), {}, profiles) });
      } catch (e) {
        console.error('community post create error:', e.message);
        res.status(500).json({ error: 'Chyba pri ukladaní príspevku.' });
      }
    });
  });

  // DELETE /api/community/posts/:id — len autor (moderácia je v dash-service).
  app.delete('/api/community/posts/:id', requireCommunityAccess, async (req, res) => {
    try {
      const { data: post } = await supabase.from('community_posts').select('author_email').eq('id', req.params.id).maybeSingle();
      if (!post) return res.status(404).json({ error: 'Príspevok sa nenašiel.' });
      if (post.author_email !== req.communityEmail) return res.status(403).json({ error: 'Môžeš zmazať len vlastný príspevok.' });
      await supabase.from('community_posts').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
      res.json({ ok: true });
    } catch (e) {
      console.error('community post delete error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/community/posts/:id/comments
  app.get('/api/community/posts/:id/comments', requireCommunityAccess, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      const { data: comments, error } = await supabase.from('community_comments').select('*').eq('post_id', postId).is('deleted_at', null).order('created_at', { ascending: true });
      if (error) throw error;
      const commentIds = (comments || []).map(c => c.id);
      let likedCommentIds = new Set();
      let likeCounts = {};
      if (commentIds.length) {
        const [{ data: myLikes }, { data: allLikes }] = await Promise.all([
          supabase.from('community_likes').select('comment_id').eq('author_email', req.communityEmail).in('comment_id', commentIds),
          supabase.from('community_likes').select('comment_id').in('comment_id', commentIds)
        ]);
        likedCommentIds = new Set((myLikes || []).map(l => l.comment_id));
        for (const l of allLikes || []) likeCounts[l.comment_id] = (likeCounts[l.comment_id] || 0) + 1;
      }
      const profiles = await getProfilesMap((comments || []).map(c => c.author_email));
      res.json({ comments: (comments || []).map(c => serializeComment(c, likedCommentIds, likeCounts, profiles)) });
    } catch (e) {
      console.error('community comments list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/community/posts/:id/comments
  app.post('/api/community/posts/:id/comments', requireCommunityAccess, async (req, res) => {
    const body = (req.body?.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Komentár nemôže byť prázdny.' });
    if (body.length > COMMENT_BODY_MAX) return res.status(400).json({ error: 'Komentár je príliš dlhý.' });
    try {
      const postId = parseInt(req.params.id, 10);
      const { data: post } = await supabase.from('community_posts').select('id').eq('id', postId).is('deleted_at', null).maybeSingle();
      if (!post) return res.status(404).json({ error: 'Príspevok sa nenašiel.' });
      const { data: comment, error } = await supabase.from('community_comments').insert({
        post_id: postId, author_email: req.communityEmail, author_name: req.communityName, body
      }).select().single();
      if (error) throw error;
      const profiles = { [req.communityEmail]: { display_name: req.communityName, avatar_url: req.communityAvatarUrl } };
      res.json({ comment: serializeComment(comment, new Set(), {}, profiles) });
    } catch (e) {
      console.error('community comment create error:', e.message);
      res.status(500).json({ error: 'Chyba pri ukladaní komentára.' });
    }
  });

  // DELETE /api/community/comments/:id — len autor.
  app.delete('/api/community/comments/:id', requireCommunityAccess, async (req, res) => {
    try {
      const { data: comment } = await supabase.from('community_comments').select('author_email').eq('id', req.params.id).maybeSingle();
      if (!comment) return res.status(404).json({ error: 'Komentár sa nenašiel.' });
      if (comment.author_email !== req.communityEmail) return res.status(403).json({ error: 'Môžeš zmazať len vlastný komentár.' });
      await supabase.from('community_comments').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
      res.json({ ok: true });
    } catch (e) {
      console.error('community comment delete error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST/DELETE /api/community/posts/:id/like — toggle lajku na príspevku.
  app.post('/api/community/posts/:id/like', requireCommunityAccess, async (req, res) => {
    try {
      const { error } = await supabase.from('community_likes').insert({ post_id: parseInt(req.params.id, 10), author_email: req.communityEmail });
      if (error && error.code !== '23505') throw error; // 23505 = unique_violation (uz lajkovane), ticho ignoruj
      res.json({ ok: true });
    } catch (e) {
      console.error('community post like error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
  app.delete('/api/community/posts/:id/like', requireCommunityAccess, async (req, res) => {
    try {
      await supabase.from('community_likes').delete().eq('post_id', req.params.id).eq('author_email', req.communityEmail);
      res.json({ ok: true });
    } catch (e) {
      console.error('community post unlike error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST/DELETE /api/community/comments/:id/like — toggle lajku na komentári.
  app.post('/api/community/comments/:id/like', requireCommunityAccess, async (req, res) => {
    try {
      const { error } = await supabase.from('community_likes').insert({ comment_id: parseInt(req.params.id, 10), author_email: req.communityEmail });
      if (error && error.code !== '23505') throw error;
      res.json({ ok: true });
    } catch (e) {
      console.error('community comment like error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
  app.delete('/api/community/comments/:id/like', requireCommunityAccess, async (req, res) => {
    try {
      await supabase.from('community_likes').delete().eq('comment_id', req.params.id).eq('author_email', req.communityEmail);
      res.json({ ok: true });
    } catch (e) {
      console.error('community comment unlike error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/community/profile/me — vlastný profil, na predvyplnenie
  // editačného formulára (surové dáta vrátane bio, bez cudzích príspevkov).
  app.get('/api/community/profile/me', requireCommunityAccess, async (req, res) => {
    try {
      const profileRow = await ensureProfile(req.communityEmail);
      res.json({
        profile: {
          email: req.communityEmail,
          displayName: profileRow.display_name || req.communityName,
          username: profileRow.username,
          avatarUrl: profileRow.avatar_url || null,
          bio: profileRow.bio || null
        }
      });
    } catch (e) {
      console.error('community profile me error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  // PUT /api/community/profile — upraviť vlastné zobrazované meno, username a bio.
  app.put('/api/community/profile', requireCommunityAccess, async (req, res) => {
    const displayName = (req.body?.displayName || '').toString().trim().slice(0, DISPLAY_NAME_MAX) || null;
    const bio = (req.body?.bio || '').toString().trim().slice(0, BIO_MAX) || null;
    const usernameRaw = req.body?.username;
    try {
      const patch = { email: req.communityEmail, display_name: displayName, bio, updated_at: new Date().toISOString() };
      if (usernameRaw != null && usernameRaw !== '') {
        const username = usernameRaw.toString().trim().toLowerCase();
        if (!USERNAME_RE.test(username)) return res.status(400).json({ error: 'Používateľské meno smie mať 3-20 znakov: malé písmená, čísla, podčiarknik.' });
        const { data: taken } = await supabase.from('community_profiles').select('email').eq('username', username).neq('email', req.communityEmail).maybeSingle();
        if (taken) return res.status(400).json({ error: 'Toto používateľské meno je už obsadené.' });
        patch.username = username;
      }
      const { error } = await supabase.from('community_profiles').upsert(patch, { onConflict: 'email' });
      if (error) throw error;
      res.json({ ok: true });
    } catch (e) {
      console.error('community profile update error:', e.message);
      res.status(500).json({ error: 'Chyba pri ukladaní profilu.' });
    }
  });

  // POST /api/community/profile/avatar — nahratie vlastnej profilovej fotky.
  app.post('/api/community/profile/avatar', requireCommunityAccess, (req, res) => {
    upload.single('avatar')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'Obrázok sa nepodarilo nahrať (max 5 MB).' });
      if (!req.file) return res.status(400).json({ error: 'Chýba obrázok.' });
      if (!IMAGE_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú len PNG, JPG, WEBP alebo GIF.' });
      try {
        const avatarUrl = await uploadToCommunityBucket('avatars', req.communityEmail, req.file);
        const { error } = await supabase.from('community_profiles')
          .upsert({ email: req.communityEmail, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: 'email' });
        if (error) throw error;
        res.json({ ok: true, avatarUrl });
      } catch (e) {
        console.error('community avatar upload error:', e.message);
        res.status(500).json({ error: 'Chyba pri nahrávaní fotky.' });
      }
    });
  });

  // GET /api/community/profile/:email — profil niekoho iného v rámci
  // komunity (fotka, bio) + jeho posledné príspevky.
  app.get('/api/community/profile/:email', requireCommunityAccess, async (req, res) => {
    try {
      const email = (req.params.email || '').toString().trim().toLowerCase();
      const targetAccess = await getCommunityAccess(email);
      if (!targetAccess.hasAccess) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
      const profileRow = await ensureProfile(email);
      const { data: posts, error } = await supabase.from('community_posts').select('*').eq('author_email', email).is('deleted_at', null).order('created_at', { ascending: false }).limit(PAGE_SIZE);
      if (error) throw error;
      const postIds = (posts || []).map(p => p.id);
      let likedPostIds = new Set();
      let commentCounts = {};
      let likeCounts = {};
      if (postIds.length) {
        const [{ data: myLikes }, { data: comments }, { data: allLikes }] = await Promise.all([
          supabase.from('community_likes').select('post_id').eq('author_email', req.communityEmail).in('post_id', postIds),
          supabase.from('community_comments').select('post_id').is('deleted_at', null).in('post_id', postIds),
          supabase.from('community_likes').select('post_id').in('post_id', postIds)
        ]);
        likedPostIds = new Set((myLikes || []).map(l => l.post_id));
        for (const c of comments || []) commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
        for (const l of allLikes || []) likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
      }
      const profiles = { [email]: profileRow };
      res.json({
        profile: {
          email,
          displayName: displayNameOf(profileRow, email),
          avatarUrl: profileRow?.avatar_url || null,
          bio: profileRow?.bio || null
        },
        posts: (posts || []).map(p => serializePost({ ...p, like_count: likeCounts[p.id] || 0 }, likedPostIds, commentCounts, profiles))
      });
    } catch (e) {
      console.error('community profile view error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/community/photos?before=<id>&author=<email> — galéria,
  // nezávislá od feedu príspevkov. Bez author= vracia celú komunitnú
  // galériu, s author= len fotky danej osoby (profilová stránka).
  app.get('/api/community/photos', requireCommunityAccess, async (req, res) => {
    try {
      let query = supabase.from('community_photos').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(PAGE_SIZE);
      const before = parseInt(req.query.before, 10);
      if (before) query = query.lt('id', before);
      const author = (req.query.author || '').toString().trim().toLowerCase();
      if (author) query = query.eq('author_email', author);
      const { data: photos, error } = await query;
      if (error) throw error;
      const profiles = await getProfilesMap((photos || []).map(p => p.author_email));
      res.json({ photos: (photos || []).map(p => serializePhoto(p, profiles)), hasMore: (photos || []).length === PAGE_SIZE });
    } catch (e) {
      console.error('community photos list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/community/photos — nahratie fotky do galérie (samostatnej
  // od príspevkov vo feede), voliteľne s popisom.
  app.post('/api/community/photos', requireCommunityAccess, (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'Obrázok sa nepodarilo nahrať (max 5 MB).' });
      if (!req.file) return res.status(400).json({ error: 'Chýba obrázok.' });
      if (!IMAGE_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú len PNG, JPG, WEBP alebo GIF.' });
      const caption = (req.body?.caption || '').toString().trim().slice(0, CAPTION_MAX) || null;
      try {
        const imageUrl = await uploadToCommunityBucket('gallery', req.communityEmail, req.file);
        const { data: photo, error } = await supabase.from('community_photos').insert({
          author_email: req.communityEmail, author_name: req.communityName, image_url: imageUrl, caption
        }).select().single();
        if (error) throw error;
        const profiles = { [req.communityEmail]: { display_name: req.communityName, avatar_url: req.communityAvatarUrl } };
        res.json({ photo: serializePhoto(photo, profiles) });
      } catch (e) {
        console.error('community photo upload error:', e.message);
        res.status(500).json({ error: 'Chyba pri nahrávaní fotky.' });
      }
    });
  });

  // DELETE /api/community/photos/:id — len autor (moderácia je v dash-service).
  app.delete('/api/community/photos/:id', requireCommunityAccess, async (req, res) => {
    try {
      const { data: photo } = await supabase.from('community_photos').select('author_email').eq('id', req.params.id).maybeSingle();
      if (!photo) return res.status(404).json({ error: 'Fotka sa nenašla.' });
      if (photo.author_email !== req.communityEmail) return res.status(403).json({ error: 'Môžeš zmazať len vlastnú fotku.' });
      await supabase.from('community_photos').update({ deleted_at: new Date().toISOString() }).eq('id', req.params.id);
      res.json({ ok: true });
    } catch (e) {
      console.error('community photo delete error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/community/leaderboard — komunitný rebríček, kombinuje
  // zapojenie v komunite (lajky získané na príspevkoch/komentároch +
  // počet príspevkov/komentárov) s najlepším dosiahnutým percentilom v SP
  // Tréner testoch (training_streaks.best_percentile, rovnaký zdroj ako
  // percentilový tracker/streak v hlavnej appke). Váhy sú zámerne také,
  // aby ani jeden faktor jednostranne neprevážil: lajky a príspevky sú
  // hlavný pohon, percentil je bonus (max +20 bodov pri P100).
  app.get('/api/community/leaderboard', requireCommunityAccess, async (req, res) => {
    try {
      const [{ data: posts }, { data: comments }, { data: likes }, { data: profiles }, { data: streaks }] = await Promise.all([
        supabase.from('community_posts').select('id, author_email, author_name').is('deleted_at', null).limit(5000),
        supabase.from('community_comments').select('id, author_email, author_name').is('deleted_at', null).limit(5000),
        supabase.from('community_likes').select('post_id, comment_id').limit(20000),
        supabase.from('community_profiles').select('email, display_name, avatar_url'),
        supabase.from('training_streaks').select('email, best_percentile')
      ]);

      const postAuthor = {};
      const postCount = {};
      const nameSeen = {};
      for (const p of posts || []) {
        postAuthor[p.id] = p.author_email;
        postCount[p.author_email] = (postCount[p.author_email] || 0) + 1;
        if (p.author_name) nameSeen[p.author_email] = p.author_name;
      }
      const commentAuthor = {};
      const commentCount = {};
      for (const c of comments || []) {
        commentAuthor[c.id] = c.author_email;
        commentCount[c.author_email] = (commentCount[c.author_email] || 0) + 1;
        if (c.author_name) nameSeen[c.author_email] = c.author_name;
      }
      const likesReceived = {};
      for (const l of likes || []) {
        const author = l.post_id != null ? postAuthor[l.post_id] : commentAuthor[l.comment_id];
        if (author) likesReceived[author] = (likesReceived[author] || 0) + 1;
      }
      const profileMap = {};
      for (const p of profiles || []) profileMap[p.email] = p;
      const percentileMap = {};
      for (const s of streaks || []) percentileMap[s.email] = s.best_percentile;

      const authors = new Set([...Object.keys(postCount), ...Object.keys(commentCount)]);
      const rows = [...authors].map(email => {
        const postN = postCount[email] || 0;
        const commentN = commentCount[email] || 0;
        const likeN = likesReceived[email] || 0;
        const percentile = percentileMap[email] != null ? Number(percentileMap[email]) : null;
        const score = likeN * 2 + postN * 3 + commentN * 1 + (percentile != null ? Math.round(percentile / 5) : 0);
        const profile = profileMap[email];
        return {
          email,
          displayName: (profile && profile.display_name) || nameSeen[email] || (profile && profile.username) || email,
          avatarUrl: profile?.avatar_url || null,
          postCount: postN,
          commentCount: commentN,
          likesReceived: likeN,
          bestPercentile: percentile,
          score
        };
      });
      rows.sort((a, b) => b.score - a.score);
      res.json({ leaderboard: rows.slice(0, 20) });
    } catch (e) {
      console.error('community leaderboard error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/community/conversations — zoznam mojich konverzácií, najnovšie
  // hore, s náhľadom poslednej správy.
  app.get('/api/community/conversations', requireCommunityAccess, async (req, res) => {
    try {
      const { data: convos, error } = await supabase.from('community_conversations')
        .select('*')
        .or(`user_a.eq.${req.communityEmail},user_b.eq.${req.communityEmail}`)
        .order('last_message_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const otherEmails = (convos || []).map(c => c.user_a === req.communityEmail ? c.user_b : c.user_a);
      const profiles = await getProfilesMap(otherEmails);
      const convoIds = (convos || []).map(c => c.id);
      const lastMessages = {};
      if (convoIds.length) {
        const { data: msgs } = await supabase.from('community_messages').select('conversation_id, body, created_at').in('conversation_id', convoIds).order('created_at', { ascending: false });
        for (const m of msgs || []) { if (!lastMessages[m.conversation_id]) lastMessages[m.conversation_id] = m; }
      }
      res.json({
        conversations: (convos || []).map(c => {
          const otherEmail = c.user_a === req.communityEmail ? c.user_b : c.user_a;
          const profile = profiles[otherEmail];
          const last = lastMessages[c.id];
          return {
            otherEmail,
            otherName: displayNameOf(profile, otherEmail),
            otherAvatarUrl: profile?.avatar_url || null,
            lastMessage: last ? last.body : null,
            lastMessageAt: c.last_message_at
          };
        })
      });
    } catch (e) {
      console.error('community conversations list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/community/conversations/:email — otvorí (alebo vytvorí)
  // konverzáciu s daným účastníkom a vráti históriu správ.
  app.get('/api/community/conversations/:email', requireCommunityAccess, async (req, res) => {
    try {
      const otherEmail = (req.params.email || '').toString().trim().toLowerCase();
      if (!otherEmail || otherEmail === req.communityEmail) return res.status(400).json({ error: 'Neplatný príjemca.' });
      const otherAccess = await getCommunityAccess(otherEmail);
      if (!otherAccess.hasAccess) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
      const convo = await getOrCreateConversation(req.communityEmail, otherEmail);
      const { data: messages, error } = await supabase.from('community_messages').select('*').eq('conversation_id', convo.id).order('created_at', { ascending: true }).limit(200);
      if (error) throw error;
      const profileRow = await ensureProfile(otherEmail);
      res.json({
        conversationId: convo.id,
        other: { email: otherEmail, displayName: displayNameOf(profileRow, otherEmail), avatarUrl: profileRow?.avatar_url || null },
        messages: (messages || []).map(m => ({ id: m.id, senderEmail: m.sender_email, body: m.body, createdAt: m.created_at }))
      });
    } catch (e) {
      console.error('community conversation view error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/community/conversations/:email/messages — odoslanie správy.
  app.post('/api/community/conversations/:email/messages', requireCommunityAccess, async (req, res) => {
    const body = (req.body?.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Správa nemôže byť prázdna.' });
    if (body.length > DM_BODY_MAX) return res.status(400).json({ error: 'Správa je príliš dlhá.' });
    try {
      const otherEmail = (req.params.email || '').toString().trim().toLowerCase();
      if (!otherEmail || otherEmail === req.communityEmail) return res.status(400).json({ error: 'Neplatný príjemca.' });
      const otherAccess = await getCommunityAccess(otherEmail);
      if (!otherAccess.hasAccess) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
      const convo = await getOrCreateConversation(req.communityEmail, otherEmail);
      const { data: message, error } = await supabase.from('community_messages').insert({
        conversation_id: convo.id, sender_email: req.communityEmail, body
      }).select().single();
      if (error) throw error;
      await supabase.from('community_conversations').update({ last_message_at: message.created_at }).eq('id', convo.id);
      res.json({ message: { id: message.id, senderEmail: message.sender_email, body: message.body, createdAt: message.created_at } });
    } catch (e) {
      console.error('community message send error:', e.message);
      res.status(500).json({ error: 'Chyba pri odosielaní správy.' });
    }
  });

  // POST /api/community/conversations/:id/report — nahlásenie konverzácie.
  // AI (Claude) posúdi poslednú históriu a buď nahláseného zablokuje
  // (rovnaké pole ako manuálny ban v dash-service), alebo nahlásenie
  // zamietne ako neopodstatnené. Obsah správ sa nikam mimo tejto funkcie
  // nezobrazuje — do audit tabuľky ide len verdikt a krátke zdôvodnenie.
  app.post('/api/community/conversations/:id/report', requireCommunityAccess, async (req, res) => {
    try {
      const convoId = parseInt(req.params.id, 10);
      const { data: convo } = await supabase.from('community_conversations').select('*').eq('id', convoId).maybeSingle();
      if (!convo) return res.status(404).json({ error: 'Konverzácia sa nenašla.' });
      if (convo.user_a !== req.communityEmail && convo.user_b !== req.communityEmail) return res.status(403).json({ error: 'Nemáš prístup k tejto konverzácii.' });
      const reportedEmail = convo.user_a === req.communityEmail ? convo.user_b : convo.user_a;
      const { data: messages, error } = await supabase.from('community_messages').select('sender_email, body, created_at').eq('conversation_id', convoId).order('created_at', { ascending: false }).limit(DM_REPORT_MAX_MESSAGES);
      if (error) throw error;
      const ordered = (messages || []).slice().reverse();
      if (!ordered.length) return res.status(400).json({ error: 'Konverzácia je prázdna, nie je čo nahlásiť.' });
      const verdict = await callClaudeJudge(buildReportPrompt(ordered, req.communityEmail, reportedEmail));
      await supabase.from('community_message_reports').insert({
        conversation_id: convoId, reporter_email: req.communityEmail, reported_email: reportedEmail,
        ai_verdict: verdict.verdict, ai_reasoning: verdict.reasoning
      });
      if (verdict.verdict === 'block') {
        await supabase.from('users').update({ community_banned_at: new Date().toISOString() }).eq('email', reportedEmail);
      }
      res.json({ verdict: verdict.verdict, reasoning: verdict.reasoning });
    } catch (e) {
      console.error('community report error:', e.message);
      res.status(500).json({ error: 'Chyba pri spracovaní nahlásenia.' });
    }
  });

  // GET /api/community/members — zoznam všetkých aktívnych členov komunity
  // (adresár), abecedne podľa zobrazovaného mena.
  app.get('/api/community/members', requireCommunityAccess, async (req, res) => {
    try {
      const { data: activeUsers, error } = await supabase.from('users')
        .select('email, community_access_until')
        .gt('community_access_until', new Date().toISOString())
        .is('community_banned_at', null)
        .limit(200);
      if (error) throw error;
      const emails = (activeUsers || []).map(u => u.email);
      let profiles = await getProfilesMap(emails);
      // Členovia, čo ešte nikdy neotvorili /komunita (napr. prístup im
      // udelil admin manuálne), nemajú profil s username — doplň ho teraz,
      // nech sa v adresári nikdy nezobrazí surový email.
      const missing = emails.filter(e => !profiles[e] || !profiles[e].username);
      if (missing.length) {
        await Promise.all(missing.map(e => ensureProfile(e)));
        profiles = await getProfilesMap(emails);
      }
      const members = (activeUsers || []).map(u => {
        const profile = profiles[u.email];
        return {
          email: u.email,
          displayName: displayNameOf(profile, u.email),
          avatarUrl: profile?.avatar_url || null,
          bio: profile?.bio || null
        };
      });
      members.sort((a, b) => a.displayName.localeCompare(b.displayName, 'sk'));
      res.json({ members });
    } catch (e) {
      console.error('community members list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
};
