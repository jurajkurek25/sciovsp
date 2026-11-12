// FUNKCIA: zákaz používania celej appky pre účty zneužívajúce duplicitné
// registrácie na obchádzanie limitu bezplatných AI testov (3 testy/účet).
// Existujúci users.community_banned_at (routes/community.js) blokuje len
// prístup do komunity -- toto je nové, samostatné pole pre zákaz CELEJ
// appky, nastavované z nového dash panelu (dash-service/routes/users.js)
// ALEBO automaticky pri podozrivej novej registrácii (pozri bod 4).
//
// Vyžaduje vopred spustenú DB migráciu: db/migrate_app_ban.sql
// (users.app_banned_at, users.app_ban_reason, users.signup_name).
//
// Mení server.js na štyroch miestach:
//   1. Nové globálne middleware na /api/* -- overí Bearer token (alebo
//      body.token pre /api/auth/verify) voči zoznamu zabanovaných emailov
//      PRED akýmkoľvek /api endpointom. Jedno centrálne miesto namiesto
//      úpravy requireLogin/requirePremium/requireElite/requireCourseBuyer/
//      verifySupabaseToken zvlášť.
//   2. Auto-odbanovanie pri kúpe Premium/Elite cez /ponuka (jednorazová
//      platba, metadata.type === 'membership_purchase').
//   3. Auto-odbanovanie pri bežnom mesačnom/ročnom predplatnom (hlavný
//      checkout.session.completed branch bez metadata.type).
//   Zámerne NEPLATÍ pre darčekové karty (gift_card redeem) -- inak by sa
//   dalo odbanovanie kúpiť lacno cez kartu zakúpenú na inom duplicitnom
//   účte.
//   4. Auto-BAN pri registrácii v /api/auth/verify -- ak sa zakladá nový
//      účet (prvé prihlásenie tohto emailu) s rovnakým Google menom ako
//      iný, už existujúci účet, KTORÝ UŽ VYČERPAL bezplatné testy
//      (trial_count >= 3), nový účet sa rovno vytvorí zabanovaný, skôr
//      než stihne spraviť čo i len jeden test. Presne podľa zadania:
//      rovnaké meno + pôvodný účet bez voľných kreditov + hneď nato nová
//      registrácia (čo je práve táto chvíľa -- prvý insert nového riadku).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/298-app-ban-duplicate-accounts.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE.replace(/[\\/]/g, '-') + '.298-lock';
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

if (src.includes('app_banned_at')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1. Globálne middleware na /api/* ──────────────────────────
const OLD_1 = `app.use(express.json({ limit: '20kb' }));
require('./routes/community')(app);
require('./routes/generalka')(app);
require('./routes/sutaz')(app);
require('./routes/shop')(app);`;

const NEW_1 = `app.use(express.json({ limit: '20kb' }));

// Zákaz používania appky pre duplicitné účty zneužívajúce bezplatné AI
// testy (users.app_banned_at, nastavuje sa z dash-service). Jedno
// centrálne miesto namiesto úpravy requireLogin/requirePremium/
// requireElite/requireCourseBuyer/verifySupabaseToken zvlášť -- over
// Bearer token (alebo body.token, ktorý ako jediný používa /api/auth/verify
// mimo Authorization hlavičky) voči zoznamu zabanovaných e-mailov pred
// KAŽDÝM /api/* requestom. Fail-open pri chybe overenia, aby prípadný
// výpadok tejto kontroly nespadol celú appku bežným (nezabanovaným) userom.
app.use('/api', async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim() || (req.body && req.body.token) || '';
  if (!token) return next();
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return next();
    const { data: banRow } = await supabase.from('users').select('app_banned_at').eq('email', user.email).maybeSingle();
    if (banRow?.app_banned_at) {
      return res.status(403).json({ error: 'Tvoj účet bol pozastavený pre podozrenie na zneužitie (duplicitné účty). Pre obnovenie si zakúp Premium alebo Elite predplatné.', accountBanned: true });
    }
  } catch (e) {
    console.error('app ban check error:', e.message);
  }
  next();
});

require('./routes/community')(app);
require('./routes/generalka')(app);
require('./routes/sutaz')(app);
require('./routes/shop')(app);`;

src = replaceExactCount(src, OLD_1, NEW_1, 1, 'globálne /api ban-check middleware');

// ── 2. Auto-odbanovanie pri /ponuka membership_purchase ───────
const OLD_2 = `          const membershipUpsert = {
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString()
          };`;

const NEW_2 = `          const membershipUpsert = {
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString(),
            // Reálna platba je presne ten moment, kedy sa má zrušiť
            // prípadný zákaz appky za duplicitné účty -- zámerne sa toto
            // NEDEJE pri darčekovej karte (gift_card redeem), aby sa
            // odbanovanie nedalo obísť kartou kúpenou na inom účte.
            app_banned_at: null,
            app_ban_reason: null
          };`;

src = replaceExactCount(src, OLD_2, NEW_2, 1, 'auto-odbanovanie — membership_purchase (/ponuka)');

// ── 3. Auto-odbanovanie pri bežnom predplatnom ────────────────
const OLD_3 = `        // Aktivuj Premium
        await supabase.from('users').update({
          is_premium: true,
          subscription_status: 'active',
          stripe_customer_id: session.customer,
          plan: sessionPlan
        }).eq('email', email);`;

const NEW_3 = `        // Aktivuj Premium
        await supabase.from('users').update({
          is_premium: true,
          subscription_status: 'active',
          stripe_customer_id: session.customer,
          plan: sessionPlan,
          app_banned_at: null,
          app_ban_reason: null
        }).eq('email', email);`;

src = replaceExactCount(src, OLD_3, NEW_3, 1, 'auto-odbanovanie — bežné mesačné/ročné predplatné');

// ── 4. Auto-ban pri registrácii — rovnaké meno + vyčerpané testy ──
const OLD_4 = `    let { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (!user) {
      const { data: newUser } = await supabase.from('users').insert({ email, is_premium: false }).select().single();
      user = newUser;
    } else {
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('email', email);
    }
    res.json({ success: true, email, isPremium: user?.is_premium || false, status: user?.subscription_status || 'free' });`;

const NEW_4 = `    let { data: user } = await supabase.from('users').select('*').eq('email', email).single();
    if (!user) {
      // Auto-zákaz duplicitných účtov: ak sa PRÁVE TERAZ (prvé prihlásenie
      // tohto emailu) zakladá nový účet s rovnakým Google menom ako iný
      // existujúci účet, ktorý si už minul všetky bezplatné testy, ide s
      // vysokou pravdepodobnosťou o obchádzanie limitu -- nový účet sa
      // rovno založí ako zabanovaný, skôr než stihne spraviť čo i len
      // jeden bezplatný test.
      const signupName = (data.user.user_metadata?.full_name || data.user.user_metadata?.name || '').toString().trim();
      let autoBan = null;
      if (signupName) {
        const { data: sameNameRows } = await supabase.from('users')
          .select('email, trial_count').ilike('signup_name', signupName).gte('trial_count', 3).limit(1);
        if (sameNameRows && sameNameRows.length) {
          autoBan = {
            app_banned_at: new Date().toISOString(),
            app_ban_reason: 'Auto: rovnaké meno ako ' + sameNameRows[0].email + ', ktorý už vyčerpal bezplatné testy.'
          };
          console.warn('🚨 Auto-zabanovaný nový účet (duplicitné meno):', email, '↔', sameNameRows[0].email);
        }
      }
      const { data: newUser } = await supabase.from('users').insert({
        email, is_premium: false, signup_name: signupName || null, ...(autoBan || {})
      }).select().single();
      user = newUser;
      if (autoBan) {
        return res.status(403).json({ error: 'Tento účet bol automaticky pozastavený pre podozrenie na zneužitie (duplicitné účty). Pre obnovenie si zakúp Premium alebo Elite predplatné.', accountBanned: true });
      }
    } else {
      await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('email', email);
    }
    res.json({ success: true, email, isPremium: user?.is_premium || false, status: user?.subscription_status || 'free' });`;

src = replaceExactCount(src, OLD_4, NEW_4, 1, 'auto-ban pri registrácii — rovnaké meno + vyčerpané testy');

const backup = FILE.replace(/[\\/]/g, '-') + '.pre-298-app-ban-duplicate-accounts-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: zákaz appky za duplicitné účty je zapojený (ban-check middleware + auto-odbanovanie pri reálnej platbe).');
console.log('   Záloha:', backup);
console.log('   Over, že si PRED reštartom spustil(a) aj db/migrate_app_ban.sql v Supabase.');
console.log('   pm2 restart sptrener-main');
