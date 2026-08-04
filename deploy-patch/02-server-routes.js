/* ════════════════════════════════════════════════════════════════
   SP TRÉNER ADS + BLOG + VIDEO REWARDS — patch pre PRODUKČNÝ server.js
   ════════════════════════════════════════════════════════════════

   Toto NIE JE súbor na require() — je to kód na vloženie priamo do
   tvojho existujúceho server.js, na DVOCH miestach (presne označené
   nižšie). Používa premenné, ktoré v server.js už existujú:
   `app`, `supabase`, `stripe`, `path`, `rateLimit`, `APP_URL`.

   Predpoklad: `npm install multer` už si spustil (pozri README.md
   v tomto priečinku).


   ── MIESTO VLOŽENIA #1 ─────────────────────────────────────────
   Hneď po riadku `const app = express();` (pred webhook handlerom
   na riadku 15) vlož TENTO blok — musí bežať pred express.static,
   inak by sa ad.sptrener.online vždy servírovalo ako index.html:
   ──────────────────────────────────────────────────────────────── */

const AD_HOSTS = new Set(['ad.sptrener.online', 'ad.localhost']);
app.get('*', (req, res, next) => {
  if (!AD_HOSTS.has(req.hostname)) return next();
  res.sendFile(path.join(__dirname, 'public', 'ads.html'));
});

/* ════════════════════════════════════════════════════════════════
   ── MIESTO VLOŽENIA #2 ─────────────────────────────────────────
   Vlož TENTO (oveľa väčší) blok hneď po riadku, kde končí
   `app.get('/api/partner/ref/:refCode', ...)` handler (riadok ~2366
   vo výpise, ktorý si posielal) — teda TESNE PRED
   `app.get('/:customCode([a-z0-9-]{3,30})', ...)` na riadku ~2380.

   Musí to byť pred tým routom, inak by "/blog" skončilo v ňom
   ako pokus o custom-code lookup namiesto blogu.
   ════════════════════════════════════════════════════════════════ */

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const AD_APP_URL = process.env.AD_APP_URL || 'https://ad.sptrener.online';
const MAX_ACTIVE_BANNERS = 4;
const MAX_ACTIVE_VIDEO_ADS = 3;
const BANNER_MIME = ['image/png', 'image/gif', 'video/mp4'];
const MAX_BANNER_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MIN_VIDEO_DURATION = 5, MAX_VIDEO_DURATION = 180;
const DAILY_REWARD_LIMIT = 3;
const REWARD_GRACE_MS = 1500;

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Inzerentská autentifikácia (Supabase magic-link, rovnaký princíp ako hlavná appka) ──

async function requireAdvertiser(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Neplatný token.' });
    const email = data.user.email;
    let { data: advertiser } = await supabase.from('advertisers').select('*').eq('email', email).single();
    if (!advertiser) {
      const { data: created } = await supabase.from('advertisers').insert({ email }).select().single();
      advertiser = created;
    }
    req.advertiser = advertiser;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatný alebo expirovaný token.' });
  }
}

app.post('/api/ads-auth/magic-link', rateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Neplatný email.' });
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: AD_APP_URL + '/' }
    });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Ads magic link:', err.message);
    res.status(500).json({ error: 'Chyba odosielania emailu.' });
  }
});

app.get('/api/ads-auth/me', requireAdvertiser, async (req, res) => {
  res.json({ advertiser: { email: req.advertiser.email, companyName: req.advertiser.company_name, hasBilling: !!req.advertiser.stripe_customer_id } });
});

// ─── Bannery — fakturácia je PER BANNER, nie per účet ──────────

app.post('/api/ads/banners/:id/checkout', requireAdvertiser, async (req, res) => {
  try {
    const { data: banner } = await supabase.from('ad_banners').select('*').eq('id', req.params.id).eq('advertiser_id', req.advertiser.id).single();
    if (!banner) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    if (banner.status === 'active' && (!banner.current_period_end || new Date(banner.current_period_end) > new Date())) {
      return res.status(400).json({ error: 'Tento banner je už zaplatený a aktívny.' });
    }

    const { count } = await supabase.from('ad_banners').select('*', { count: 'exact', head: true })
      .eq('status', 'active').gt('current_period_end', new Date().toISOString());
    if ((count || 0) >= MAX_ACTIVE_BANNERS) {
      return res.status(409).json({ error: 'Aktuálne máme plný počet bannerov v rotácii. Skús to prosím neskôr.' });
    }

    let customerId = req.advertiser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.advertiser.email, metadata: { advertiserId: req.advertiser.id } });
      customerId = customer.id;
      await supabase.from('advertisers').update({ stripe_customer_id: customerId }).eq('id', req.advertiser.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_AD_PRICE_ID, quantity: 1 }],
      success_url: `${AD_APP_URL}/?payment=success`,
      cancel_url: `${AD_APP_URL}/?payment=cancelled`,
      metadata: { advertiserId: req.advertiser.id, bannerId: banner.id },
      subscription_data: { metadata: { advertiserId: req.advertiser.id, bannerId: banner.id } }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('ads banner checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

app.post('/api/ads/portal', requireAdvertiser, async (req, res) => {
  try {
    if (!req.advertiser.stripe_customer_id) return res.status(400).json({ error: 'Zatiaľ nemáš žiadnu platbu.' });
    const session = await stripe.billingPortal.sessions.create({ customer: req.advertiser.stripe_customer_id, return_url: `${AD_APP_URL}/` });
    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: 'Nepodarilo sa otvoriť portál.' });
  }
});

app.get('/api/ads/banners', requireAdvertiser, async (req, res) => {
  try {
    const { data: banners } = await supabase.from('ad_banners').select('*').eq('advertiser_id', req.advertiser.id).order('created_at', { ascending: false });
    const withStats = await Promise.all((banners || []).map(async b => {
      const { count: impressions } = await supabase.from('ad_events').select('*', { count: 'exact', head: true }).eq('banner_id', b.id).eq('event_type', 'impression');
      const { count: clicks } = await supabase.from('ad_events').select('*', { count: 'exact', head: true }).eq('banner_id', b.id).eq('event_type', 'click');
      return { ...b, impressions: impressions || 0, clicks: clicks || 0 };
    }));
    res.json({ banners: withStats });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/ads/banners', requireAdvertiser, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    const { linkUrl } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (!BANNER_MIME.includes(req.file.mimetype)) return res.status(400).json({ error: 'Povolené sú PNG, GIF alebo MP4.' });
    if (req.file.size > MAX_BANNER_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 8 MB).' });
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL (vrátane https://).' });

    try {
      const ext = req.file.originalname.split('.').pop();
      const storagePath = `${req.advertiser.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('ad-banners').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('ad-banners').getPublicUrl(storagePath);

      const { data: banner } = await supabase.from('ad_banners').insert({
        advertiser_id: req.advertiser.id,
        storage_path: storagePath,
        public_url: pub.publicUrl,
        mime_type: req.file.mimetype,
        link_url: linkUrl
      }).select().single();
      res.status(201).json({ banner });
    } catch (e) {
      console.error('ads banner upload error:', e);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

app.patch('/api/ads/banners/:id', requireAdvertiser, async (req, res) => {
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
  const patch = {};
  if (typeof active === 'boolean') patch.active = active;
  if (linkUrl) patch.link_url = linkUrl;
  try {
    const { data: banner } = await supabase.from('ad_banners').update(patch).eq('id', req.params.id).eq('advertiser_id', req.advertiser.id).select().single();
    if (!banner) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    res.json({ banner });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.delete('/api/ads/banners/:id', requireAdvertiser, async (req, res) => {
  try {
    const { data: banner } = await supabase.from('ad_banners').select('stripe_subscription_id, storage_path').eq('id', req.params.id).eq('advertiser_id', req.advertiser.id).single();
    if (!banner) return res.status(404).json({ error: 'Banner sa nenašiel.' });
    if (banner.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(banner.stripe_subscription_id); } catch (e) { console.error('cancel sub error:', e); }
    }
    await supabase.storage.from('ad-banners').remove([banner.storage_path]).catch(() => {});
    await supabase.from('ad_banners').delete().eq('id', req.params.id).eq('advertiser_id', req.advertiser.id);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// Verejné: /api/ads/serve a /api/ads/go/:id — /api/ads/file/:id NIE JE potrebné,
// public_url zo storage bucketu appka použije priamo.

app.get('/api/ads/serve', async (req, res) => {
  try {
    const { data } = await supabase.from('ad_banners').select('id, public_url, mime_type')
      .eq('active', true).eq('status', 'active').gt('current_period_end', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(20);
    res.json({ banners: (data || []).map(b => ({ id: b.id, url: b.public_url, mimeType: b.mime_type })) });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/ads/go/:id', async (req, res) => {
  try {
    const { data: banner } = await supabase.from('ad_banners').select('link_url').eq('id', req.params.id).single();
    if (!banner) return res.status(404).send('Banner sa nenašiel.');
    supabase.from('ad_events').insert({ banner_id: req.params.id, event_type: 'click' }).then(() => {});
    res.redirect(302, banner.link_url);
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.post('/api/ads/impression/:id', async (req, res) => {
  supabase.from('ad_events').insert({ banner_id: req.params.id, event_type: 'impression' }).then(() => {}).catch(() => {});
  res.status(204).end();
});

// ─── Video reklamy — rovnaký princíp, iný bucket, + duration_s ────

app.post('/api/video-ads/:id/checkout', requireAdvertiser, async (req, res) => {
  try {
    const { data: ad } = await supabase.from('video_ads').select('*').eq('id', req.params.id).eq('advertiser_id', req.advertiser.id).single();
    if (!ad) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    if (ad.status === 'active' && (!ad.current_period_end || new Date(ad.current_period_end) > new Date())) {
      return res.status(400).json({ error: 'Toto video je už zaplatené a aktívne.' });
    }
    const { count } = await supabase.from('video_ads').select('*', { count: 'exact', head: true })
      .eq('status', 'active').gt('current_period_end', new Date().toISOString());
    if ((count || 0) >= MAX_ACTIVE_VIDEO_ADS) {
      return res.status(409).json({ error: 'Aktuálne máme plný počet video reklám v rotácii. Skús to prosím neskôr.' });
    }

    let customerId = req.advertiser.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: req.advertiser.email, metadata: { advertiserId: req.advertiser.id } });
      customerId = customer.id;
      await supabase.from('advertisers').update({ stripe_customer_id: customerId }).eq('id', req.advertiser.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_VIDEO_AD_PRICE_ID, quantity: 1 }],
      success_url: `${AD_APP_URL}/?payment=success`,
      cancel_url: `${AD_APP_URL}/?payment=cancelled`,
      metadata: { advertiserId: req.advertiser.id, videoAdId: ad.id },
      subscription_data: { metadata: { advertiserId: req.advertiser.id, videoAdId: ad.id } }
    });
    res.json({ url: session.url });
  } catch (e) {
    console.error('video ad checkout error:', e);
    res.status(500).json({ error: 'Nepodarilo sa vytvoriť platobný link.' });
  }
});

app.get('/api/video-ads', requireAdvertiser, async (req, res) => {
  try {
    const { data: ads } = await supabase.from('video_ads').select('*').eq('advertiser_id', req.advertiser.id).order('created_at', { ascending: false });
    const withStats = await Promise.all((ads || []).map(async a => {
      const { count: views } = await supabase.from('video_ad_views').select('*', { count: 'exact', head: true }).eq('video_ad_id', a.id).not('completed_at', 'is', null);
      const { count: clicks } = await supabase.from('video_ad_views').select('*', { count: 'exact', head: true }).eq('video_ad_id', a.id).eq('clicked', true);
      return { ...a, views: views || 0, clicks: clicks || 0 };
    }));
    res.json({ videoAds: withStats });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/video-ads', requireAdvertiser, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Nahrávanie zlyhalo.' });
    const { linkUrl, durationS } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Chýba súbor.' });
    if (req.file.mimetype !== 'video/mp4') return res.status(400).json({ error: 'Povolené je len MP4.' });
    if (req.file.size > MAX_VIDEO_SIZE) return res.status(400).json({ error: 'Súbor je príliš veľký (max 25 MB).' });
    if (!linkUrl || !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
    const duration = parseInt(durationS, 10);
    if (!Number.isFinite(duration) || duration < MIN_VIDEO_DURATION || duration > MAX_VIDEO_DURATION) {
      return res.status(400).json({ error: `Zadaj dĺžku videa v sekundách (${MIN_VIDEO_DURATION}–${MAX_VIDEO_DURATION}).` });
    }

    try {
      const storagePath = `${req.advertiser.id}/${Date.now()}.mp4`;
      const { error: upErr } = await supabase.storage.from('video-ads').upload(storagePath, req.file.buffer, { contentType: 'video/mp4' });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('video-ads').getPublicUrl(storagePath);

      const { data: ad } = await supabase.from('video_ads').insert({
        advertiser_id: req.advertiser.id,
        storage_path: storagePath,
        public_url: pub.publicUrl,
        mime_type: 'video/mp4',
        duration_s: duration,
        link_url: linkUrl
      }).select().single();
      res.status(201).json({ videoAd: ad });
    } catch (e) {
      console.error('video ad upload error:', e);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });
});

app.patch('/api/video-ads/:id', requireAdvertiser, async (req, res) => {
  const { active, linkUrl } = req.body || {};
  if (linkUrl && !/^https?:\/\//.test(linkUrl)) return res.status(400).json({ error: 'Zadaj platnú cieľovú URL.' });
  const patch = {};
  if (typeof active === 'boolean') patch.active = active;
  if (linkUrl) patch.link_url = linkUrl;
  try {
    const { data: ad } = await supabase.from('video_ads').update(patch).eq('id', req.params.id).eq('advertiser_id', req.advertiser.id).select().single();
    if (!ad) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    res.json({ videoAd: ad });
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.delete('/api/video-ads/:id', requireAdvertiser, async (req, res) => {
  try {
    const { data: ad } = await supabase.from('video_ads').select('stripe_subscription_id, storage_path').eq('id', req.params.id).eq('advertiser_id', req.advertiser.id).single();
    if (!ad) return res.status(404).json({ error: 'Video reklama sa nenašla.' });
    if (ad.stripe_subscription_id) {
      try { await stripe.subscriptions.cancel(ad.stripe_subscription_id); } catch (e) { console.error('cancel sub error:', e); }
    }
    await supabase.storage.from('video-ads').remove([ad.storage_path]).catch(() => {});
    await supabase.from('video_ads').delete().eq('id', req.params.id).eq('advertiser_id', req.advertiser.id);
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.get('/api/video-ads/go/:id', async (req, res) => {
  try {
    const { data: ad } = await supabase.from('video_ads').select('link_url').eq('id', req.params.id).single();
    if (!ad) return res.status(404).send('Reklama sa nenašla.');
    if (req.query.session) {
      supabase.from('video_ad_views').update({ clicked: true }).eq('session_token', req.query.session).then(() => {});
    }
    res.redirect(302, ad.link_url);
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

// ─── Rewards — pozri video, získaj +1 test (max 3×/deň) ────────
// Integruje sa priamo do existujúceho trial_count na users — po
// overenom dopozretí ho jednoducho o 1 znížime, žiadny nový stĺpec.

async function getSupaUserEmail(req) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.email;
}

async function todaysRewardCount(email) {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabase.from('video_ad_views').select('*', { count: 'exact', head: true })
    .eq('user_email', email).eq('reward_granted', true).gte('completed_at', startOfDay.toISOString());
  return count || 0;
}

app.get('/api/rewards/video-status', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  try {
    const { data: user } = await supabase.from('users').select('is_premium, premium_expires_at').eq('email', email).single();
    const bonusActive = user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
    if (user?.is_premium || bonusActive) return res.json({ available: false, dailyRemaining: 0 });

    const { count: adsAvailable } = await supabase.from('video_ads').select('*', { count: 'exact', head: true })
      .eq('active', true).eq('status', 'active').gt('current_period_end', new Date().toISOString());
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
    if (used >= DAILY_REWARD_LIMIT) return res.status(429).json({ error: `Dnes si už vyčerpal denný limit ${DAILY_REWARD_LIMIT} bonus testov za reklamu.` });

    const { data: ads } = await supabase.from('video_ads').select('id, public_url, duration_s, link_url')
      .eq('active', true).eq('status', 'active').gt('current_period_end', new Date().toISOString());
    if (!ads || !ads.length) return res.status(404).json({ error: 'Momentálne nemáme dostupnú video reklamu.' });
    const ad = ads[Math.floor(Math.random() * ads.length)];

    const sessionToken = require('crypto').randomBytes(24).toString('hex');
    await supabase.from('video_ad_views').insert({ video_ad_id: ad.id, user_email: email, session_token: sessionToken });

    res.json({ sessionToken, videoAdId: ad.id, durationS: ad.duration_s, fileUrl: ad.public_url, linkUrl: ad.link_url });
  } catch (e) {
    console.error('reward start error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

app.post('/api/rewards/video/complete', rateLimit, async (req, res) => {
  const email = await getSupaUserEmail(req);
  if (!email) return res.status(401).json({ error: 'Chýba prihlásenie.' });
  const { sessionToken } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'Chýba session token.' });

  try {
    const { data: view } = await supabase.from('video_ad_views').select('id, started_at, completed_at, video_ad_id').eq('session_token', sessionToken).eq('user_email', email).single();
    if (!view) return res.status(404).json({ error: 'Neplatná session.' });
    if (view.completed_at) return res.status(400).json({ error: 'Táto reklama už bola vyhodnotená.' });

    const { data: ad } = await supabase.from('video_ads').select('duration_s').eq('id', view.video_ad_id).single();
    const elapsedMs = Date.now() - new Date(view.started_at).getTime();
    if (elapsedMs < ad.duration_s * 1000 - REWARD_GRACE_MS) {
      return res.status(400).json({ error: 'Video nebolo dopozreté celé.' });
    }

    const used = await todaysRewardCount(email);
    if (used >= DAILY_REWARD_LIMIT) {
      await supabase.from('video_ad_views').update({ completed_at: new Date().toISOString() }).eq('id', view.id);
      return res.status(429).json({ error: `Dnes si už vyčerpal denný limit ${DAILY_REWARD_LIMIT} bonus testov za reklamu.` });
    }

    await supabase.from('video_ad_views').update({ completed_at: new Date().toISOString(), reward_granted: true }).eq('id', view.id);

    // Odmena = zníž trial_count o 1 (min. 0), nech ďalší /api/trial/check znova prejde
    const { data: user } = await supabase.from('users').select('trial_count').eq('email', email).single();
    if (user) {
      await supabase.from('users').update({ trial_count: Math.max(0, (user.trial_count || 0) - 1) }).eq('email', email);
    }

    res.json({ allowed: true, dailyRemaining: Math.max(0, DAILY_REWARD_LIMIT - used - 1) });
  } catch (e) {
    console.error('reward complete error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

// ─── Blog ───────────────────────────────────────────────────────

function blogLayout({ title, description, body }) {
  return `<!DOCTYPE html><html lang="sk"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
:root{--black:#08080d;--black2:#0f0f18;--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.13);--text:#eeeef5;--text2:#a1a1bc;--text3:#5c5c7a;--volt:#c8ff00;--purple:#7c5cff;--purple2:#b09bff;--serif:'Instrument Serif',Georgia,serif;--mono:'DM Mono',monospace;--sans:'DM Sans',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}body{background:var(--black);color:var(--text);font-family:var(--sans);line-height:1.65}
nav{position:sticky;top:0;padding:1.1rem 2rem;display:flex;justify-content:space-between;align-items:center;background:rgba(8,8,13,.88);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:var(--mono);font-size:13px;letter-spacing:.15em;color:var(--text);text-decoration:none}
.nav-cta{padding:.65rem 1.1rem;background:var(--volt);color:var(--black);border-radius:8px;font-weight:700;font-family:var(--mono);font-size:.78rem;text-decoration:none}
.page{max-width:900px;margin:0 auto;padding:3rem 2rem 6rem}
.hero-title{font-family:var(--serif);font-size:clamp(2.2rem,5vw,3.6rem);line-height:1.08;margin-bottom:1rem}
.hero-title em{font-style:italic;color:var(--purple2)}
.post-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;margin-top:2rem}
.post-card{background:rgba(15,15,24,.82);border:1px solid var(--border);border-radius:16px;padding:1.5rem;text-decoration:none;color:inherit}
.post-card-title{font-family:var(--serif);font-size:1.4rem;color:var(--text);margin:.6rem 0}
.post-card-excerpt{color:var(--text2);font-size:.9rem}
.prose{max-width:720px;margin:0 auto}
.prose h2{font-family:var(--serif);font-size:1.9rem;margin:2.2rem 0 1rem}
.prose p{color:var(--text2);margin-bottom:1.1rem}
.prose ul{color:var(--text2);margin:0 0 1.1rem 1.2rem}
</style></head><body>
<nav><a href="/" class="nav-logo">SP TRÉNER</a><a href="/app" class="nav-cta">Prejsť do aplikácie →</a></nav>
${body}
</body></html>`;
}

app.get('/blog', async (req, res) => {
  try {
    const { data: posts } = await supabase.from('blog_posts').select('slug,title,excerpt,tag,read_time,created_at').eq('published', true).order('created_at', { ascending: false });
    const body = `<main class="page">
      <h1 class="hero-title">Ako sa <em>naozaj</em> pripraviť na prijímacie testy.</h1>
      <div class="post-grid">${(posts || []).map(p => `
        <a class="post-card" href="/blog/${escapeHtml(p.slug)}">
          <div class="post-card-title">${escapeHtml(p.title)}</div>
          <div class="post-card-excerpt">${escapeHtml(p.excerpt)}</div>
        </a>`).join('')}</div>
    </main>`;
    res.send(blogLayout({ title: 'Blog — SP Tréner', description: 'Postupy a stratégie príprav na prijímacie testy.', body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const { data: post } = await supabase.from('blog_posts').select('*').eq('slug', req.params.slug).eq('published', true).single();
    if (!post) return res.status(404).send(blogLayout({ title: 'Nenájdené', description: '', body: '<main class="page"><div class="prose"><h2>Článok sa nenašiel</h2></div></main>' }));
    const body = `<main class="page"><article class="prose">
      <h1 class="hero-title">${escapeHtml(post.title)}</h1>
      ${post.content}
    </article></main>`;
    res.send(blogLayout({ title: post.title + ' — SP Tréner', description: post.excerpt, body }));
  } catch (e) {
    res.status(500).send('Chyba servera.');
  }
});

/* ════════════════════════════════════════════════════════════════
   KONIEC PATCHU
   ════════════════════════════════════════════════════════════════ */
