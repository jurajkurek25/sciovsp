require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const PORT = process.env.PORT || 3849;
const APP_URL = process.env.APP_URL || 'https://ad.sptrener.online';
const MAIN_APP_ORIGIN = process.env.MAIN_APP_ORIGIN || 'https://sptrener.online';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(express.json());
app.use(cors({ origin: [MAIN_APP_ORIGIN, APP_URL], methods: ['GET', 'POST'] }));

const upload = multer({ storage: multer.memoryStorage() });

// ─── Jednoduchý in-memory rate limiter (žiadna zdieľaná infra s hlavnou appkou) ──
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 60_000, max = 20;
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (arr.length > max) return res.status(429).json({ error: 'Príliš veľa požiadaviek, skús to prosím o chvíľu.' });
  next();
}

const MAX_ACTIVE_BANNERS = 4;
const MAX_ACTIVE_VIDEO_ADS = 3;
const BANNER_MIME = ['image/png', 'image/gif', 'video/mp4'];
const MAX_BANNER_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const MIN_VIDEO_DURATION = 5, MAX_VIDEO_DURATION = 180;

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
      options: { emailRedirectTo: APP_URL + '/' }
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
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/?payment=cancelled`,
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
    const session = await stripe.billingPortal.sessions.create({ customer: req.advertiser.stripe_customer_id, return_url: `${APP_URL}/` });
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

// ─── Verejné — volá ich hlavná appka (sptrener.online) cez CORS ────

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
      success_url: `${APP_URL}/?payment=success`,
      cancel_url: `${APP_URL}/?payment=cancelled`,
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

// Verejný presmerovací endpoint pre video reklamy — volá ho hlavná appka
// (rewards flow tam beží aj naďalej priamo v jej server.js, toto je len klik-tracking).
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

app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — magic-link presmeruje sem s tokenom v URL, ads.html si ho spracuje na klientovi
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ads.html'));
});

app.listen(PORT, () => {
  console.log(`SP Tréner Ads beží na porte ${PORT} (${APP_URL})`);
});
