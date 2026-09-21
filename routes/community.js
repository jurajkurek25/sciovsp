// Študentská komunita — feed príspevkov, komentáre, lajky. Prístup je
// výhradne pre tých, čo majú users.community_access_until v budúcnosti
// (nastavuje sa VÝHRADNE vo webhooku pri webinárovej ceste nákupu Premium/
// Elite na /ponuka — pozri main-app-patches/118-community-backend.js).
// Moderácia (mazanie cudzích príspevkov, blokovanie používateľov) žije v
// dash-service, nie tu — tento súbor rieši len bežné používateľské akcie
// (vlastný príspevok/komentár, lajky, čítanie feedu).
//
// module.exports je funkcia, ktorú voláš ako require('./routes/community')(app)
// — rovnaký vzor ako routes/maintenanceMode.js a routes/autoseoWebhook.js
// (jediné dva routes/*.js súbory, ktoré server.js skutočne require()-uje;
// ostatné routes/*.js v tomto repozitári sú mŕtvy kód).
'use strict';

const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const POST_BODY_MAX = 4000;
const COMMENT_BODY_MAX = 1000;
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

async function requireCommunityAccess(req, res, next) {
  const user = await verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
  const email = (user.email || '').toString().trim().toLowerCase();
  const access = await getCommunityAccess(email);
  if (access.banned) return res.status(403).json({ error: 'Prístup do komunity je zablokovaný.' });
  if (!access.hasAccess) return res.status(403).json({ error: 'Komunita je dostupná len pre členov, ktorí si Premium/Elite kúpili cez ponuku po webinári.' });
  req.communityEmail = email;
  req.communityName = user.user_metadata?.full_name || user.user_metadata?.name || null;
  next();
}

function serializePost(row, likedPostIds, commentCounts) {
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorName: row.author_name,
    body: row.body,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    likeCount: row.like_count || 0,
    liked: likedPostIds.has(row.id),
    commentCount: commentCounts[row.id] || 0
  };
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
      res.json({
        posts: (posts || []).map(p => serializePost({ ...p, like_count: likeCounts[p.id] || 0 }, likedPostIds, commentCounts)),
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
          const path = req.communityEmail.replace(/[^a-z0-9]/gi, '_') + '/' + Date.now() + '-' + require('crypto').randomBytes(4).toString('hex');
          const { error: upErr } = await supabase.storage.from('community').upload(path, req.file.buffer, { contentType: req.file.mimetype });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from('community').getPublicUrl(path);
          imageUrl = pub.publicUrl;
        }
        const { data: post, error } = await supabase.from('community_posts').insert({
          author_email: req.communityEmail,
          author_name: req.communityName,
          body: body || null,
          image_url: imageUrl
        }).select().single();
        if (error) throw error;
        res.json({ post: serializePost({ ...post, like_count: 0 }, new Set(), {}) });
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
      res.json({
        comments: (comments || []).map(c => ({
          id: c.id, authorEmail: c.author_email, authorName: c.author_name, body: c.body, createdAt: c.created_at,
          likeCount: likeCounts[c.id] || 0, liked: likedCommentIds.has(c.id)
        }))
      });
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
      res.json({ comment: { id: comment.id, authorEmail: comment.author_email, authorName: comment.author_name, body: comment.body, createdAt: comment.created_at, likeCount: 0, liked: false } });
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
};
