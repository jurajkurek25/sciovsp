// BEZPEČNOSTNÁ ZÁPLATA — routes/community.js vracal reálny email KAŽDÉHO
// člena komunity v JSON odpovedi na mnohých miestach: vo feede (každý
// príspevok/komentár/fotka), v adresári členov, v rebríčku (leaderboard)
// a v súkromných správach (zoznam konverzácií aj história správ). Ktokoľvek
// s prístupom do komunity (zaplatené Premium/Elite cez webinár) tak mohol
// jednoducho scrollovaním feedu alebo jedným volaním /api/community/members
// či /api/community/leaderboard pozbierať reálne emaily celej platiacej
// komunity — ideálny zoznam na cielený phishing/spam.
//
// Kód mal už od začiatku explicitný komentár s úmyslom "nikdy sa nezobrazuje
// surový email ako identita v komunite" (displayNameOf) a vlastný username
// systém (generateUsername/ensureProfile) presne na tento účel — len sa
// nedôsledne používal všade, kde sa posiela email klientovi.
//
// Táto záplata:
//   1. Dodáva publicIdOf(profile) — vráti username, nikdy email.
//   2. Dodáva resolveIdentifierToEmail(identifier) — prijme buď username
//      (nové, verejné) ALEBO priamo email (spätná kompatibilita, keby
//      frontend/cache ešte poslal starú hodnotu) a vráti skutočný email
//      na interné použitie (DB queries), nikdy naspäť klientovi.
//   3. serializePost/serializeComment/serializePhoto: authorEmail je teraz
//      username, nie email.
//   4. /api/community/profile/:param, /api/community/conversations/:param
//      (GET aj POST messages): parameter v URL môže byť teraz username
//      ALEBO email (resolveIdentifierToEmail rozhodne), odpoveď klientovi
//      vracia len username.
//   5. /api/community/conversations (zoznam) aj história správ v
//      /api/community/conversations/:param: otherEmail a senderEmail sú
//      teraz username.
//   6. /api/community/members: email je teraz username.
//   7. /api/community/leaderboard: email je teraz username (a doplnený
//      chýbajúci `username` do SELECT, ktorý bol predtým vynechaný).
//
// ZÁMERNE nemení: pole "email" vo vlastnom profile (/api/community/profile/me)
// — to je vlastný email užívateľa jemu samému, nie leak.
//
// Vďaka tomu, že JSON kľúče (authorEmail, otherEmail, senderEmail, email)
// ostávajú rovnaké — len ich HODNOTA sa mení z emailu na username — frontend
// kód, ktorý tieto hodnoty len ďalej posiela do URL (napr.
// fetch('/api/community/profile/' + post.authorEmail)), nemusí sa meniť.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/284-community-stop-leaking-emails.js
const fs = require('fs');
const FILE = 'routes/community.js';

const LOCK = FILE.replace('/', '_') + '.284-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('function publicIdOf(')) {
  console.error('❌ ' + FILE + ': už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) Nové helpery, hneď po getProfilesMap ─────────────────────
const HELPERS_OLD = `// Meno na zobrazenie pre iného člena: vlastné meno > username > (nikdy)
// email. Použi vždy namiesto priameho \`|| email\` fallbacku.
function displayNameOf(profile, email) {
  return (profile && profile.display_name) || (profile && profile.username) || email;
}`;

const HELPERS_NEW = `// Meno na zobrazenie pre iného člena: vlastné meno > username > (nikdy)
// email. Použi vždy namiesto priameho \`|| email\` fallbacku.
function displayNameOf(profile, email) {
  return (profile && profile.display_name) || (profile && profile.username) || email;
}

// Verejný identifikátor pre iného člena, posielaný klientovi (feed, adresár,
// rebríček, konverzácie) — VŽDY username, NIKDY email. null ak profil ešte
// nemá username (nemalo by nastať, ensureProfile ho vytvára pri každom
// prístupe, ale nech sa email nikdy nedostane do JSON ani ako fallback).
function publicIdOf(profile) {
  return (profile && profile.username) || null;
}

// Prijme identifikátor z URL parametra, ktorý môže byť buď username (nové,
// verejné -- čo teraz vracajú authorEmail/otherEmail/email polia) alebo
// priamo email (spätná kompatibilita so starými/vyrcachovanými hodnotami) --
// a vráti skutočný email na interné DB queries. Nikdy sa neposiela naspäť
// klientovi.
async function resolveIdentifierToEmail(identifier) {
  const raw = (identifier || '').toString().trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes('@')) return raw;
  const { data } = await supabase.from('community_profiles').select('email').eq('username', raw).maybeSingle();
  return data?.email || null;
}`;

src = replaceExactCount(src, HELPERS_OLD, HELPERS_NEW, 1, 'helper functions insertion point');

// ── 2) serializePost/serializeComment/serializePhoto: authorEmail -> username ──
src = replaceExactCount(
  src,
  `authorEmail: row.author_email,`,
  `authorEmail: publicIdOf(profile),`,
  3, 'serializePost/serializeComment/serializePhoto authorEmail field'
);

// ── 3) /api/community/profile/:email route ──────────────────────
const PROFILE_OLD = `  app.get('/api/community/profile/:email', requireCommunityAccess, async (req, res) => {
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
  });`;

const PROFILE_NEW = `  app.get('/api/community/profile/:email', requireCommunityAccess, async (req, res) => {
    try {
      const email = await resolveIdentifierToEmail(req.params.email);
      if (!email) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
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
          email: publicIdOf(profileRow),
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
  });`;

src = replaceExactCount(src, PROFILE_OLD, PROFILE_NEW, 1, '/api/community/profile/:email route');

// ── 4) /api/community/leaderboard: doplň username do SELECT + email -> username ──
src = replaceExactCount(
  src,
  `supabase.from('community_profiles').select('email, display_name, avatar_url'),`,
  `supabase.from('community_profiles').select('email, display_name, avatar_url, username'),`,
  1, 'leaderboard community_profiles select'
);

const LEADER_OLD = `        const profile = profileMap[email];
        return {
          email,
          displayName: (profile && profile.display_name) || nameSeen[email] || (profile && profile.username) || email,
          avatarUrl: profile?.avatar_url || null,`;

const LEADER_NEW = `        const profile = profileMap[email];
        return {
          email: publicIdOf(profile),
          displayName: (profile && profile.display_name) || nameSeen[email] || (profile && profile.username) || 'Člen komunity',
          avatarUrl: profile?.avatar_url || null,`;

src = replaceExactCount(src, LEADER_OLD, LEADER_NEW, 1, 'leaderboard row serialization');

// ── 5) /api/community/conversations (zoznam): otherEmail -> username ──
const CONVOLIST_OLD = `          const otherEmail = c.user_a === req.communityEmail ? c.user_b : c.user_a;
          const profile = profiles[otherEmail];
          const last = lastMessages[c.id];
          return {
            otherEmail,
            otherName: displayNameOf(profile, otherEmail),`;

const CONVOLIST_NEW = `          const otherEmail = c.user_a === req.communityEmail ? c.user_b : c.user_a;
          const profile = profiles[otherEmail];
          const last = lastMessages[c.id];
          return {
            otherEmail: publicIdOf(profile),
            otherName: displayNameOf(profile, otherEmail),`;

src = replaceExactCount(src, CONVOLIST_OLD, CONVOLIST_NEW, 1, 'conversations list otherEmail field');

// ── 6) /api/community/conversations/:email GET: resolve param + senderEmail -> username ──
const CONVO_GET_OLD = `  app.get('/api/community/conversations/:email', requireCommunityAccess, async (req, res) => {
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
  });`;

const CONVO_GET_NEW = `  app.get('/api/community/conversations/:email', requireCommunityAccess, async (req, res) => {
    try {
      const otherEmail = await resolveIdentifierToEmail(req.params.email);
      if (!otherEmail || otherEmail === req.communityEmail) return res.status(400).json({ error: 'Neplatný príjemca.' });
      const otherAccess = await getCommunityAccess(otherEmail);
      if (!otherAccess.hasAccess) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
      const convo = await getOrCreateConversation(req.communityEmail, otherEmail);
      const { data: messages, error } = await supabase.from('community_messages').select('*').eq('conversation_id', convo.id).order('created_at', { ascending: true }).limit(200);
      if (error) throw error;
      const profileRow = await ensureProfile(otherEmail);
      const myProfileRow = await ensureProfile(req.communityEmail);
      const senderPublicId = (senderEmail) => senderEmail === req.communityEmail ? publicIdOf(myProfileRow) : publicIdOf(profileRow);
      res.json({
        conversationId: convo.id,
        other: { email: publicIdOf(profileRow), displayName: displayNameOf(profileRow, otherEmail), avatarUrl: profileRow?.avatar_url || null },
        messages: (messages || []).map(m => ({ id: m.id, senderEmail: senderPublicId(m.sender_email), body: m.body, createdAt: m.created_at }))
      });
    } catch (e) {
      console.error('community conversation view error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });`;

src = replaceExactCount(src, CONVO_GET_OLD, CONVO_GET_NEW, 1, '/api/community/conversations/:email GET route');

// ── 7) /api/community/conversations/:email/messages POST: resolve param ──
const CONVO_POST_OLD = `      const otherEmail = (req.params.email || '').toString().trim().toLowerCase();
      if (!otherEmail || otherEmail === req.communityEmail) return res.status(400).json({ error: 'Neplatný príjemca.' });
      const otherAccess = await getCommunityAccess(otherEmail);
      if (!otherAccess.hasAccess) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
      const convo = await getOrCreateConversation(req.communityEmail, otherEmail);
      const { data: message, error } = await supabase.from('community_messages').insert({`;

const CONVO_POST_NEW = `      const otherEmail = await resolveIdentifierToEmail(req.params.email);
      if (!otherEmail || otherEmail === req.communityEmail) return res.status(400).json({ error: 'Neplatný príjemca.' });
      const otherAccess = await getCommunityAccess(otherEmail);
      if (!otherAccess.hasAccess) return res.status(404).json({ error: 'Tento používateľ nie je v komunite.' });
      const convo = await getOrCreateConversation(req.communityEmail, otherEmail);
      const { data: message, error } = await supabase.from('community_messages').insert({`;

src = replaceExactCount(src, CONVO_POST_OLD, CONVO_POST_NEW, 1, '/api/community/conversations/:email/messages POST route');

// ── 8) /api/community/members: email -> username ────────────────
const MEMBERS_OLD = `      const members = (activeUsers || []).map(u => {
        const profile = profiles[u.email];
        return {
          email: u.email,
          displayName: displayNameOf(profile, u.email),`;

const MEMBERS_NEW = `      const members = (activeUsers || []).map(u => {
        const profile = profiles[u.email];
        return {
          email: publicIdOf(profile),
          displayName: displayNameOf(profile, u.email),`;

src = replaceExactCount(src, MEMBERS_OLD, MEMBERS_NEW, 1, '/api/community/members route');

const backup = FILE.replace('/', '_') + '.pre-284-community-stop-leaking-emails-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ ' + FILE + ': všetky verejné polia (authorEmail, otherEmail, senderEmail, email v members/leaderboard/profile) teraz vracajú username, nikdy reálny email.');
console.log('✅ Routes podľa identifikátora (/profile/:param, /conversations/:param) prijímajú username ALEBO email (spätná kompatibilita).');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ: pm2 restart sptrener-main, potom over v komunite na stránke:');
console.log('   1. Feed, komentáre, fotky -- zobrazujú sa mená správne (nie "undefined"/"null").');
console.log('   2. Kliknutie na autora príspevku otvorí jeho profil.');
console.log('   3. Adresár členov (/api/community/members) a rebríček zobrazujú mená správne.');
console.log('   4. Otvorenie/odoslanie súkromnej správy funguje (zoznam konverzácií aj detail).');
console.log('   Ak niekde uvidíš "undefined" namiesto mena, je to znak, že nejaký člen ešte nemá username -- nemalo by nastať (ensureProfile ho vytvára vždy), ale daj vedieť, ak sa to objaví.');
