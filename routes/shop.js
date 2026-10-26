// Obchod s digitálnymi produktami (PDF, EPUB, MOBI, .skill, ZIP...).
// Jednorazové platby cez Stripe (mode: 'payment'), súbory v privátnom
// Supabase Storage buckete "digital-products", doručenie cez podpísaný
// (časovo obmedzený) link -- hneď na success stránke AJ emailom ako
// záloha (webhook v server.js spracuje checkout.session.completed s
// metadata.type === 'digital_product_purchase').
//
// module.exports je funkcia, ktorú voláš ako require('./routes/shop')(app)
// -- rovnaký vzor ako routes/community.js.
'use strict';

const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const multer = require('multer');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const BASE_URL = (process.env.BASE_URL || 'https://sptrener.online').replace(/\/$/, '');
const STORAGE_BUCKET = 'digital-products';
const DOWNLOAD_URL_TTL_SECONDS = 60 * 60; // 1 hodina

const PRODUCT_FILE_MAX_BYTES = 80 * 1024 * 1024; // 80 MB (ebooky, .skill balíky)
const COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['pdf', 'epub', 'mobi', 'skill', 'zip'];
const ALLOWED_COVER_MIME = ['image/png', 'image/jpeg', 'image/webp'];

const productUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: PRODUCT_FILE_MAX_BYTES }
});

function slugify(s) {
  return (s || '').toString().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 80) || 'produkt';
}

function extensionFor(fileType) {
  return fileType === 'skill' ? '.skill' : '.' + fileType;
}

// Popis produktu sa píše ako viacero odstavcov oddelených prázdnym riadkom
// (hook / ako to funguje / čo dostaneš) -- tieto dve pomocné funkcie z toho
// urobia buď len prvú vetu (katalóg, meta description, JSON-LD) alebo
// poriadne odstavce na predajnej stránke namiesto jedného bloku textu.
function firstParagraph(text) {
  return (text || '').split(/\n\s*\n/)[0].trim();
}
function descriptionHtml(text, escapeHtml) {
  return (text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p>${escapeHtml(p)}</p>`).join('');
}

// ── Admin auth ───────────────────────────────────────────────────────────
// Žiadny existujúci "requireAdmin" v appke nie je -- správa komunity/ads
// žije v samostatnom dash-service. Pre tento shop: Bearer token + email
// musí byť v SHOP_ADMIN_EMAILS (čiarkou oddelený zoznam v .env), s
// fallbackom na ADMIN_EMAIL, ak SHOP_ADMIN_EMAILS nie je nastavené.
function shopAdminAllowlist() {
  const raw = process.env.SHOP_ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function requireShopAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Prihlás sa.' });
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Neplatná session.' });
    const email = (data.user.email || '').toLowerCase();
    if (!shopAdminAllowlist().includes(email)) return res.status(403).json({ error: 'Nemáš prístup do administrácie obchodu.' });
    req.adminEmail = email;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Neplatná session.' });
  }
}

// Keď produkt nemá nahratý obal, použi brandovaný SVG cover generovaný za
// behu z názvu -- presne ten istý princíp ako courseCoverUrl() pre kurzy
// (/kurzy-cover/:slug.svg). Žiadny externý image-gen, žiadne nové závislosti.
function productCoverUrl(p) {
  return p.cover_image_url || (BASE_URL + '/obchod-cover/' + p.slug + '.svg');
}

function serializeProduct(p, { includeInternal = false } = {}) {
  const out = {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    priceCents: p.price_cents,
    fileType: p.file_type,
    coverImageUrl: productCoverUrl(p),
    active: p.active
  };
  if (includeInternal) {
    out.storagePath = p.storage_path;
    out.createdAt = p.created_at;
    out.updatedAt = p.updated_at;
  }
  return out;
}

async function signedDownloadUrl(storagePath) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storagePath, DOWNLOAD_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

module.exports = function registerShop(app) {
  // ── Verejné ──────────────────────────────────────────────────────────

  // GET /api/shop/config — verejné pripojovacie údaje pre klientský
  // Supabase Auth (admin stránka sa prihlasuje cez Google OAuth). Anon
  // key je svojou podstatou verejný (rovnaká logika ako SUPABASE_ANON_KEY
  // už vložený v iných klientských stránkach appky), nejde o secret.
  app.get('/api/shop/config', (req, res) => {
    res.json({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: process.env.SUPABASE_ANON_KEY });
  });

  // GET /obchod-cover/:slug.svg — brandovaný cover produktu generovaný za
  // behu z názvu (rovnaký princíp ako /kurzy-cover/:slug.svg), použitý
  // ako fallback vo vrátenom coverImageUrl, kým produkt nemá vlastný obal.
  app.get('/obchod-cover/:slug.svg', async (req, res) => {
    const escapeXml = app.locals.escapeXml;
    const wrapSvgLines = app.locals.wrapSvgLines;
    if (!escapeXml || !wrapSvgLines) {
      console.error('obchod-cover: app.locals helpers chýbajú -- je aplikovaný main-app-patches/292-expose-svg-cover-helpers-for-shop.js?');
      return res.status(500).send('');
    }
    try {
      const { data: product } = await supabase.from('digital_products').select('title, file_type').eq('slug', req.params.slug).maybeSingle();
      const title = product ? product.title : 'SP Tréner';
      const label = product ? (product.file_type || 'produkt').toUpperCase() : 'OBCHOD';
      const lines = wrapSvgLines(title, 24, 4);
      const lineHeight = 62;
      const titleBlockHeight = lines.length * lineHeight;
      const startY = 315 - titleBlockHeight / 2 + lineHeight * 0.7;
      const tspans = lines.map((line, i) => `<tspan x="80" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`).join('');
      const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f18"/>
      <stop offset="100%" stop-color="#08080d"/>
    </linearGradient>
    <radialGradient id="glow" cx="88%" cy="10%" r="60%">
      <stop offset="0%" stop-color="#c8ff00" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#c8ff00" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <circle cx="1130" cy="55" r="8" fill="#7c5cff"/>
  <text x="80" y="78" font-family="'DM Mono', monospace" font-size="24" letter-spacing="4" fill="#eeeef5">SP TRÉNER</text>
  <text x="80" y="${Math.max(startY - 55, 130)}" font-family="'DM Mono', monospace" font-size="22" letter-spacing="2" fill="#c8ff00">${escapeXml(label)}</text>
  <text font-family="Georgia, serif" font-size="52" fill="#eeeef5">${tspans}</text>
  <rect x="80" y="565" width="64" height="4" fill="#7c5cff"/>
</svg>`;
      res.type('image/svg+xml');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(svg);
    } catch (e) {
      res.status(500).send('');
    }
  });

  // GET /api/shop/products — zoznam aktívnych produktov (bez storage_path).
  app.get('/api/shop/products', async (req, res) => {
    try {
      const { data, error } = await supabase.from('digital_products')
        .select('*').eq('active', true).order('created_at', { ascending: false });
      if (error) throw error;
      res.json({ products: (data || []).map(p => serializeProduct(p)) });
    } catch (e) {
      console.error('shop products list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/shop/checkout — vytvorí Stripe checkout session (jednorazová
  // platba). Anonymný flow zámerne (konzistentné s ostatnými jednorazovými
  // nákupmi v appke, napr. kurzy/darčekové karty) -- email zadá kupujúci.
  app.post('/api/shop/checkout', async (req, res) => {
    const { productId, email, vopAccepted } = req.body || {};
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Zadaj platný e-mail.' });
    if (!vopAccepted) return res.status(400).json({ error: 'Musíš súhlasiť s obchodnými podmienkami.' });
    if (!productId) return res.status(400).json({ error: 'Chýba produkt.' });
    try {
      const { data: product } = await supabase.from('digital_products').select('*').eq('id', productId).eq('active', true).maybeSingle();
      if (!product) return res.status(404).json({ error: 'Produkt sa nenašiel.' });

      let customerId;
      const { data: user } = await supabase.from('users').select('stripe_customer_id').eq('email', email).maybeSingle();
      if (user?.stripe_customer_id) {
        customerId = user.stripe_customer_id;
      } else {
        const customer = await stripe.customers.create({ email });
        customerId = customer.id;
        await supabase.from('users').upsert({ email, stripe_customer_id: customerId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'eur',
            unit_amount: product.price_cents,
            product_data: {
              name: product.title,
              ...(product.description ? { description: firstParagraph(product.description).slice(0, 300) } : {}),
              ...(product.cover_image_url ? { images: [product.cover_image_url] } : {})
            }
          },
          quantity: 1
        }],
        success_url: BASE_URL + '/obchod/dakujeme?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: BASE_URL + '/obchod?cancelled=1',
        locale: 'sk',
        metadata: { type: 'digital_product_purchase', productId: String(product.id) }
      });
      res.json({ url: session.url });
    } catch (e) {
      console.error('shop checkout error:', e.message);
      res.status(500).json({ error: 'Chyba vytvorenia platby.' });
    }
  });

  // GET /api/shop/purchase/:sessionId/download — success stránka po
  // zaplatení si vyžiada čerstvý podpísaný link. Existencia riadku v
  // digital_product_purchases JE dôkaz zaplatenia (vkladá ho výhradne
  // webhook po checkout.session.completed, nie klient).
  app.get('/api/shop/purchase/:sessionId/download', async (req, res) => {
    try {
      const { data: purchase } = await supabase.from('digital_product_purchases')
        .select('product_id').eq('stripe_session_id', req.params.sessionId).maybeSingle();
      if (!purchase) return res.status(404).json({ error: 'Platba sa nenašla alebo ešte nebola spracovaná -- skús o chvíľu znova.' });
      const { data: product } = await supabase.from('digital_products').select('*').eq('id', purchase.product_id).maybeSingle();
      if (!product) return res.status(404).json({ error: 'Produkt sa nenašiel.' });
      const url = await signedDownloadUrl(product.storage_path);
      res.json({ url, title: product.title, fileType: product.file_type });
    } catch (e) {
      console.error('shop download error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /api/user/my-products — produkty prihláseného používateľa pre sekciu
  // "Produkty" na /app (vedľa "Moje kurzy"). Vracia stripe_session_id
  // namiesto priameho podpísaného linku -- appka si čerstvý link vyžiada
  // až pri kliknutí cez už existujúci /api/shop/purchase/:sessionId/download
  // (ten istý endpoint ako success stránka po zaplatení).
  app.get('/api/user/my-products', async (req, res) => {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Prihlás sa.' });
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData.user) return res.status(401).json({ error: 'Neplatná session.' });
      const email = userData.user.email;

      const { data: purchases } = await supabase.from('digital_product_purchases')
        .select('product_id, stripe_session_id, created_at')
        .eq('buyer_email', email).order('created_at', { ascending: false });
      if (!purchases || !purchases.length) return res.json({ products: [] });

      // viacnásobný nákup toho istého produktu (omylom/darček) -- zober
      // najnovšiu platbu, aby download link vždy fungoval
      const latestSessionByProduct = {};
      for (const p of purchases) {
        if (!(p.product_id in latestSessionByProduct)) latestSessionByProduct[p.product_id] = p.stripe_session_id;
      }

      // zámerne BEZ .eq('active', true) -- aj skrytý/stiahnutý produkt z
      // katalógu musí zostať stiahnuteľný pre toho, kto si ho už kúpil
      const { data: productsData } = await supabase.from('digital_products')
        .select('id, slug, title, file_type, cover_image_url')
        .in('id', Object.keys(latestSessionByProduct).map(Number));

      const products = (productsData || []).map(p => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        fileType: p.file_type,
        coverImageUrl: productCoverUrl(p),
        sessionId: latestSessionByProduct[p.id]
      }));
      res.json({ products });
    } catch (e) {
      console.error('my-products error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // GET /obchod/:slug — predajná stránka jedného produktu, rovnaký dizajn
  // ako /kurzy/:slug (blogLayout + KURZY_STYLE, sprístupnené cez
  // app.locals -- pozri main-app-patches/291-expose-helpers-for-shop-sales-page.js).
  // Katalóg (/obchod) teraz linkuje sem namiesto priameho "Kúpiť" na
  // karte, presne ako /kurzy linkuje na /kurzy/:slug.
  app.get('/obchod/:slug', async (req, res, next) => {
    // /obchod/dakujeme a /obchod/admin sú statické stránky registrované
    // neskôr v server.js (po /generalka) -- táto routa (mountnutá tu,
    // blízko začiatku server.js) by ich inak predbehla a vrátila
    // "produkt sa nenašiel" namiesto nich. Nechaj ich prejsť ďalej.
    if (req.params.slug === 'dakujeme' || req.params.slug === 'admin') return next();
    const blogLayout = app.locals.blogLayout;
    const KURZY_STYLE = app.locals.KURZY_STYLE;
    const escapeHtml = app.locals.escapeHtml;
    const blogLang = app.locals.blogLang;
    if (!blogLayout || !KURZY_STYLE || !escapeHtml || !blogLang) {
      console.error('obchod/:slug: app.locals helpers chýbajú -- je aplikovaný main-app-patches/291-expose-helpers-for-shop-sales-page.js?');
      return res.status(500).send('Chyba servera.');
    }
    try {
      const lang = blogLang(req);
      const T = lang === 'cs' ? { obchodLabel: 'Obchod', buy: 'Koupit', notFound: 'Produkt se nenašel.' }
        : { obchodLabel: 'Obchod', buy: 'Kúpiť', notFound: 'Produkt sa nenašiel.' };
      const { data: product } = await supabase.from('digital_products').select('*').eq('slug', req.params.slug).eq('active', true).maybeSingle();
      if (!product) return res.status(404).send(T.notFound);

      const priceNum = (product.price_cents / 100).toFixed(2);
      const priceStr = priceNum.replace('.', ',') + ' €';
      const coverHtml = `<img class="course-hero-cover" src="${escapeHtml(productCoverUrl(product))}" alt="${escapeHtml(product.title)}" loading="lazy">`;
      const buyBoxHtml = `<div class="course-buy-box">
        <span class="course-price-tag">${priceStr}</span>
        <button class="course-buy-btn" onclick="openObchodCheckout()">${escapeHtml(T.buy)} →</button>
      </div>`;

      const body = `${KURZY_STYLE}
      <style>
      .product-badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--volt);background:rgba(200,255,0,.08);border:1px solid rgba(200,255,0,.2);padding:3px 9px;border-radius:20px;margin-bottom:.75rem}
      .popup-overlay{display:none;position:fixed;inset:0;background:rgba(8,8,13,.75);backdrop-filter:blur(4px);z-index:200;align-items:center;justify-content:center;padding:1rem}
      .popup-overlay.show{display:flex}
      .popup{background:var(--black2);border:1px solid var(--border2);border-radius:20px;padding:2rem;max-width:400px;width:100%;position:relative}
      .popup-close{position:absolute;top:1rem;right:1rem;background:none;border:none;color:var(--text2);font-size:1.1rem;cursor:pointer}
      .popup h3{font-family:var(--serif);font-size:1.4rem;margin-bottom:1.25rem;padding-right:1.5rem}
      .popup input[type=email]{width:100%;padding:.75rem;background:var(--black);border:1px solid var(--border2);border-radius:8px;color:var(--text);font-family:var(--sans);font-size:.9rem;margin-bottom:1rem}
      .popup input[type=email]::placeholder{color:var(--text3)}
      .popup label.consent{display:flex;align-items:flex-start;gap:.5rem;font-size:.78rem;color:var(--text2);margin-bottom:1.5rem;line-height:1.5}
      .popup label.consent a{color:var(--purple2)}
      .popup .error{color:var(--red);font-size:.8rem;margin-top:-.5rem;margin-bottom:1rem}
      .popup .submit{width:100%;padding:.9rem;background:var(--volt);color:var(--black);border:none;border-radius:10px;font-weight:700;font-family:var(--mono);font-size:.85rem;letter-spacing:.04em;cursor:pointer}
      .popup .submit:disabled{opacity:.6;cursor:default}
      </style>
      <main class="page">
        <nav class="breadcrumb"><a href="/${lang === 'cs' ? '?lang=cs' : ''}">SP Tréner</a><span>/</span><a href="/obchod">${T.obchodLabel}</a><span>/</span><span>${escapeHtml(product.title)}</span></nav>
        <span class="product-badge">${escapeHtml(product.file_type.toUpperCase())}</span>
        <h1 class="hero-title">${escapeHtml(product.title)}</h1>
        ${coverHtml}
        ${buyBoxHtml}
        ${product.description ? `<article class="prose course-sales">${descriptionHtml(product.description, escapeHtml)}</article>` : ''}
        ${buyBoxHtml}
      </main>

      <div class="popup-overlay" id="checkoutOverlay" onclick="if(event.target===this) closeObchodCheckout()">
        <div class="popup">
          <button class="popup-close" onclick="closeObchodCheckout()">✕</button>
          <h3>${escapeHtml(product.title)}</h3>
          <form id="checkoutForm">
            <input type="email" id="checkoutEmail" placeholder="meno@gmail.com" required>
            <label class="consent">
              <input type="checkbox" id="checkoutVop" required>
              <span>Súhlasím s <a href="/legal.html#vop" target="_blank">obchodnými podmienkami</a>.</span>
            </label>
            <div class="error" id="checkoutError"></div>
            <button type="submit" class="submit" id="checkoutSubmit">Pokračovať na platbu →</button>
          </form>
        </div>
      </div>
      <script>
      const obchodOverlay = document.getElementById('checkoutOverlay');
      function openObchodCheckout() { document.getElementById('checkoutError').textContent = ''; obchodOverlay.classList.add('show'); }
      function closeObchodCheckout() { obchodOverlay.classList.remove('show'); }
      document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('checkoutSubmit');
        const errorEl = document.getElementById('checkoutError');
        errorEl.textContent = '';
        submitBtn.disabled = true;
        try {
          const res = await fetch('/api/shop/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: ${JSON.stringify(product.id)},
              email: document.getElementById('checkoutEmail').value,
              vopAccepted: document.getElementById('checkoutVop').checked
            })
          });
          const data = await res.json();
          if (!res.ok) { errorEl.textContent = data.error || 'Chyba.'; submitBtn.disabled = false; return; }
          window.location.href = data.url;
        } catch (e) {
          errorEl.textContent = 'Chyba pripojenia, skús znova.';
          submitBtn.disabled = false;
        }
      });
      </script>`;

      const metaDescription = product.description ? firstParagraph(product.description) : product.title;
      const jsonLd = {
        '@context': 'https://schema.org', '@type': 'Product', name: product.title, description: metaDescription,
        offers: { '@type': 'Offer', price: priceNum, priceCurrency: 'EUR', url: BASE_URL + '/obchod/' + product.slug, availability: 'https://schema.org/InStock' },
        image: productCoverUrl(product)
      };

      res.send(blogLayout({
        title: product.title + ' — SP Tréner',
        description: metaDescription.slice(0, 160),
        body, canonicalPath: '/obchod/' + product.slug, jsonLd: [jsonLd], lang
      }));
    } catch (e) {
      console.error('obchod sales page error:', e.message);
      res.status(500).send('Chyba servera.');
    }
  });

  // ── Admin ────────────────────────────────────────────────────────────

  app.get('/api/admin/shop/products', requireShopAdmin, async (req, res) => {
    try {
      const { data, error } = await supabase.from('digital_products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json({ products: (data || []).map(p => serializeProduct(p, { includeInternal: true })) });
    } catch (e) {
      console.error('shop admin list error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/admin/shop/products — nový produkt. multipart/form-data:
  // title, description, priceCents, fileType, file (povinné), cover (voliteľné).
  app.post('/api/admin/shop/products', requireShopAdmin, (req, res) => {
    productUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }])(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'Nahratie súboru zlyhalo (max ' + Math.round(PRODUCT_FILE_MAX_BYTES / 1024 / 1024) + ' MB).' });
      try {
        const { title, description, priceCents, fileType } = req.body || {};
        const priceNum = parseInt(priceCents, 10);
        if (!title || !priceNum || priceNum < 50) return res.status(400).json({ error: 'Vyplň názov a platnú cenu (min 0,50 €).' });
        if (!ALLOWED_FILE_TYPES.includes(fileType)) return res.status(400).json({ error: 'Neplatný typ súboru. Povolené: ' + ALLOWED_FILE_TYPES.join(', ') + '.' });
        const fileArr = (req.files && req.files.file) || [];
        if (!fileArr.length) return res.status(400).json({ error: 'Chýba súbor produktu.' });
        const productFile = fileArr[0];
        if (!productFile.size) return res.status(400).json({ error: 'Nahraný súbor je prázdny.' });

        let slug = slugify(title);
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: clash } = await supabase.from('digital_products').select('id').eq('slug', slug).maybeSingle();
          if (!clash) break;
          slug = slugify(title) + '-' + crypto.randomBytes(2).toString('hex');
        }

        const storagePath = slug + '/' + Date.now() + extensionFor(fileType);
        const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET)
          .upload(storagePath, productFile.buffer, { contentType: productFile.mimetype || 'application/octet-stream' });
        if (uploadErr) throw uploadErr;

        let coverImageUrl = null;
        const coverArr = (req.files && req.files.cover) || [];
        if (coverArr.length) {
          const coverFile = coverArr[0];
          if (!ALLOWED_COVER_MIME.includes(coverFile.mimetype)) return res.status(400).json({ error: 'Obal musí byť PNG, JPG alebo WEBP.' });
          if (coverFile.size > COVER_IMAGE_MAX_BYTES) return res.status(400).json({ error: 'Obal môže mať max ' + Math.round(COVER_IMAGE_MAX_BYTES / 1024 / 1024) + ' MB.' });
          const coverPath = 'covers/' + slug + '-' + Date.now();
          const { error: coverErr } = await supabase.storage.from(STORAGE_BUCKET).upload(coverPath, coverFile.buffer, { contentType: coverFile.mimetype });
          if (coverErr) throw coverErr;
          const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(coverPath);
          coverImageUrl = pub.publicUrl;
        }

        const { data: product, error: insertErr } = await supabase.from('digital_products').insert({
          slug, title, description: description || null, price_cents: priceNum,
          file_type: fileType, storage_path: storagePath, cover_image_url: coverImageUrl, active: true
        }).select().single();
        if (insertErr) throw insertErr;
        console.log('✅ Shop: nový produkt', slug, 'od', req.adminEmail);
        res.json({ product: serializeProduct(product, { includeInternal: true }) });
      } catch (e) {
        console.error('shop admin create error:', e.message);
        res.status(500).json({ error: 'Chyba pri ukladaní produktu.' });
      }
    });
  });

  // PUT /api/admin/shop/products/:id — úprava metadát (a voliteľne súboru).
  app.put('/api/admin/shop/products/:id', requireShopAdmin, (req, res) => {
    productUpload.fields([{ name: 'file', maxCount: 1 }, { name: 'cover', maxCount: 1 }])(req, res, async (err) => {
      if (err) return res.status(400).json({ error: 'Nahratie súboru zlyhalo.' });
      try {
        const { data: existing } = await supabase.from('digital_products').select('*').eq('id', req.params.id).maybeSingle();
        if (!existing) return res.status(404).json({ error: 'Produkt sa nenašiel.' });

        const patch = { updated_at: new Date().toISOString() };
        const { title, description, priceCents, active } = req.body || {};
        if (title != null && title !== '') patch.title = title;
        if (description != null) patch.description = description || null;
        if (priceCents != null && priceCents !== '') {
          const priceNum = parseInt(priceCents, 10);
          if (!priceNum || priceNum < 50) return res.status(400).json({ error: 'Neplatná cena.' });
          patch.price_cents = priceNum;
        }
        if (active != null) patch.active = active === 'true' || active === true;

        const fileArr = (req.files && req.files.file) || [];
        if (fileArr.length) {
          const productFile = fileArr[0];
          const fileType = existing.file_type;
          const storagePath = existing.slug + '/' + Date.now() + extensionFor(fileType);
          const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET)
            .upload(storagePath, productFile.buffer, { contentType: productFile.mimetype || 'application/octet-stream' });
          if (uploadErr) throw uploadErr;
          patch.storage_path = storagePath;
        }

        const coverArr = (req.files && req.files.cover) || [];
        if (coverArr.length) {
          const coverFile = coverArr[0];
          if (!ALLOWED_COVER_MIME.includes(coverFile.mimetype)) return res.status(400).json({ error: 'Obal musí byť PNG, JPG alebo WEBP.' });
          if (coverFile.size > COVER_IMAGE_MAX_BYTES) return res.status(400).json({ error: 'Obal môže mať max ' + Math.round(COVER_IMAGE_MAX_BYTES / 1024 / 1024) + ' MB.' });
          const coverPath = 'covers/' + existing.slug + '-' + Date.now();
          const { error: coverErr } = await supabase.storage.from(STORAGE_BUCKET).upload(coverPath, coverFile.buffer, { contentType: coverFile.mimetype });
          if (coverErr) throw coverErr;
          const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(coverPath);
          patch.cover_image_url = pub.publicUrl;
        }

        const { data: updated, error: updateErr } = await supabase.from('digital_products').update(patch).eq('id', req.params.id).select().single();
        if (updateErr) throw updateErr;
        res.json({ product: serializeProduct(updated, { includeInternal: true }) });
      } catch (e) {
        console.error('shop admin update error:', e.message);
        res.status(500).json({ error: 'Chyba pri úprave produktu.' });
      }
    });
  });

  // DELETE /api/admin/shop/products/:id — soft delete (active=false), aby
  // staré download linky pre už zaplatených kupujúcich neprestali
  // existovať v databáze (len sa prestane zobrazovať v obchode).
  app.delete('/api/admin/shop/products/:id', requireShopAdmin, async (req, res) => {
    try {
      const { error } = await supabase.from('digital_products').update({ active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id);
      if (error) throw error;
      res.json({ ok: true });
    } catch (e) {
      console.error('shop admin delete error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // Exportované pre webhook v server.js (digital_product_purchase vetva).
  app.locals.shopSignedDownloadUrl = signedDownloadUrl;
};
