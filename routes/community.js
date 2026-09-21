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
  const googleName = user.user_metadata?.full_name || user.user_metadata?.name || null;
  const { data: myProfile } = await supabase.from('community_profiles').select('display_name, avatar_url').eq('email', email).maybeSingle();
  req.communityName = (myProfile && myProfile.display_name) || googleName;
  req.communityAvatarUrl = myProfile?.avatar_url || null;
  next();
}

// Dávkové načítanie profilov (meno/fotka) pre množinu emailov — používa sa
// pri vypisovaní feedu/komentárov/galérie, aby sa vždy zobrazil aktuálny
// profil, nie len snímka mena uložená pri vytvorení príspevku.
async function getProfilesMap(emails) {
  const unique = [...new Set(emails)];
  if (!unique.length) return {};
  const { data } = await supabase.from('community_profiles').select('email, display_name, avatar_url').in('email', unique);
  const map = {};
  for (const p of data || []) map[p.email] = p;
  return map;
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
      const { data: profileRow } = await supabase.from('community_profiles').select('*').eq('email', req.communityEmail).maybeSingle();
      res.json({
        profile: {
          email: req.communityEmail,
          displayName: (profileRow && profileRow.display_name) || req.communityName,
          avatarUrl: profileRow?.avatar_url || null,
          bio: profileRow?.bio || null
        }
      });
    } catch (e) {
      console.error('community profile me error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // PUT /api/community/profile — upraviť vlastné zobrazované meno a bio.
  app.put('/api/community/profile', requireCommunityAccess, async (req, res) => {
    const displayName = (req.body?.displayName || '').toString().trim().slice(0, DISPLAY_NAME_MAX) || null;
    const bio = (req.body?.bio || '').toString().trim().slice(0, BIO_MAX) || null;
    try {
      const { error } = await supabase.from('community_profiles')
        .upsert({ email: req.communityEmail, display_name: displayName, bio, updated_at: new Date().toISOString() }, { onConflict: 'email' });
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
      const { data: profileRow } = await supabase.from('community_profiles').select('*').eq('email', email).maybeSingle();
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
      const profiles = profileRow ? { [email]: profileRow } : {};
      res.json({
        profile: {
          email,
          displayName: profileRow?.display_name || null,
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
          displayName: (profile && profile.display_name) || nameSeen[email] || email,
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
};
