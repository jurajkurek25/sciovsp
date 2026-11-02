// Bonus pre partnera za bezplatného (free-tier) používateľa, ktorého priviedol
// a ktorý si v appke pozrie odmeňované video — samostatné od platených
// konverzií (tie naďalej idú cez checkout.session.completed webhook).
//
// Predpoklad: db/add_referred_by_partner_code.sql už bola spustená
// (stĺpec users.referred_by_partner_code existuje) a partner appka má
// zapojený POST /api/partner/webhook/video-watch-bonus (commit 0f3c613
// v jurajkurek25/partner).
//
// Presný textový match proti overenému živému kódu server.js.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/48-partner-free-video-bonus.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(SERVER_PATH, 'utf8');

if (src.includes('notifyPartnerVideoBonus')) {
  console.error('❌ Vyzerá to, že partner video bonus už je zapojený. Nič som nezmenil.');
  process.exit(1);
}

const OLD_HELPER_ANCHOR = `const https = require('https');`;

const NEW_HELPER_ANCHOR = `const https = require('https');

function notifyPartnerVideoBonus(payload) {
  if (!process.env.PARTNER_SERVER_URL || !process.env.PARTNER_WEBHOOK_KEY) return;
  try {
    const body = JSON.stringify(payload);
    const url = new URL(process.env.PARTNER_SERVER_URL + '/api/partner/webhook/video-watch-bonus');
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-webhook-key': process.env.PARTNER_WEBHOOK_KEY
      }
    });
    req.on('error', (e) => console.error('partner video bonus webhook error:', e.message));
    req.write(body);
    req.end();
  } catch (e) {
    console.error('partner video bonus webhook error:', e.message);
  }
}`;

const OLD_REWARD_COMPLETE = `           await adsDb.query('UPDATE video_ad_views SET completed_at = NOW(), reward_granted = 1 WHERE id = ?', [view.id]);

           // Odmena = zníž trial_count o 1 (min. 0), nech ďalší /api/trial/check znova prejde
           const { data: user } = await supabase.from('users').select('trial_count').eq('email', email).single();
           if (user) {
             await supabase.from('users').update({ trial_count: Math.max(0, (user.trial_count || 0) - 1) }).eq('email', email);
           }

           res.json({ allowed: true, dailyRemaining: Math.max(0, DAILY_REWARD_LIMIT - used - 1) });`;

const NEW_REWARD_COMPLETE = `           await adsDb.query('UPDATE video_ad_views SET completed_at = NOW(), reward_granted = 1 WHERE id = ?', [view.id]);

           // Odmena = zníž trial_count o 1 (min. 0), nech ďalší /api/trial/check znova prejde
           const { data: user } = await supabase.from('users').select('trial_count, referred_by_partner_code').eq('email', email).single();
           if (user) {
             await supabase.from('users').update({ trial_count: Math.max(0, (user.trial_count || 0) - 1) }).eq('email', email);
             if (user.referred_by_partner_code) {
               notifyPartnerVideoBonus({ refCode: user.referred_by_partner_code, referredEmail: email, sessionToken });
             }
           }

           res.json({ allowed: true, dailyRemaining: Math.max(0, DAILY_REWARD_LIMIT - used - 1) });`;

const OLD_ROUTE_ANCHOR = `app.post('/api/rewards/video/complete', rateLimit, async (req, res) => {`;

const NEW_ROUTE_ANCHOR = `app.post('/api/referral/attach-partner', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  const { refCode } = req.body || {};
  if (!refCode) return res.status(400).json({ error: 'Chýba refCode.' });
  try {
    const { data: partner } = await supabase.from('partners').select('ref_code').eq('ref_code', refCode).single();
    if (!partner) return res.json({ ok: true, attached: false });

    const { data: user } = await supabase.from('users').select('referred_by_partner_code').eq('email', email).single();
    if (!user || user.referred_by_partner_code) return res.json({ ok: true, attached: false });

    await supabase.from('users').update({ referred_by_partner_code: refCode }).eq('email', email);
    res.json({ ok: true, attached: true });
  } catch (e) {
    console.error('attach-partner error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/complete', rateLimit, async (req, res) => {`;

const REPLACEMENTS = [
  ['https helper + notifyPartnerVideoBonus', OLD_HELPER_ANCHOR, NEW_HELPER_ANCHOR],
  ['reward complete partner bonus hook', OLD_REWARD_COMPLETE, NEW_REWARD_COMPLETE],
  ['attach-partner route', OLD_ROUTE_ANCHOR, NEW_ROUTE_ANCHOR]
];

for (const [name, needle] of REPLACEMENTS) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v server.js. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = SERVER_PATH + '.pre-partner-free-video-bonus-' + Date.now();
fs.copyFileSync(SERVER_PATH, backupPath);
let out = src;
for (const [, oldStr, newStr] of REPLACEMENTS) {
  out = out.replace(oldStr, newStr);
}
fs.writeFileSync(SERVER_PATH, out);

console.log('✅ Partner free-video-bonus zapojený (notifyPartnerVideoBonus, /api/rewards/video/complete, /api/referral/attach-partner).');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
console.log('   Nezabudni: db/add_referred_by_partner_code.sql musí byť spustená pred reštartom.');
