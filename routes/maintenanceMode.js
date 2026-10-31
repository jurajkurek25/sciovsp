// App-wide maintenance mode, toggled from dash-service's admin panel.
// Zero new dependencies — same pattern as routes/autoseoWebhook.js (native
// fetch() against Supabase's REST API, no @supabase/supabase-js needed).
//
// module.exports is a function you call as require('./routes/maintenanceMode')(app)
// as EARLY as possible (right after `const app = express()`, and before
// require('./routes/autoseoWebhook')(app)) so it can intercept every single
// request — "bez ohľadu na to či stránka existuje alebo nie" — before any
// other route gets a chance to run.
'use strict';

const BASE_URL = (process.env.BASE_URL || 'https://sptrener.online').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CONTACT_EMAIL = 'juraj@jurajkurek.com';
const UNAVAILABLE_PATH = '/unavalible';
const CACHE_TTL_MS = 5000; // admin toggle takes effect within ~5s across all in-flight requests

let cache = { value: false, expiresAt: 0 };

async function isMaintenanceEnabled() {
  const now = Date.now();
  if (now < cache.expiresAt) return cache.value;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return cache.value; // fail open on missing config
  try {
    const url = `${SUPABASE_URL}/rest/v1/app_settings?key=eq.maintenance_mode&select=value&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + SUPABASE_SERVICE_KEY },
    });
    if (!res.ok) { cache.expiresAt = now + CACHE_TTL_MS; return cache.value; } // fail open, keep last known value
    const rows = await res.json();
    const enabled = Array.isArray(rows) && rows.length ? rows[0].value === true : false;
    cache = { value: enabled, expiresAt: now + CACHE_TTL_MS };
    return enabled;
  } catch {
    cache.expiresAt = now + CACHE_TTL_MS;
    return cache.value; // fail open on network error, keep last known value
  }
}

function pageHtml() {
  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title id="pageTitle">Služba dočasne nedostupná</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: #08080d; color: #eeeef5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { display: flex; align-items: center; justify-content: center; padding: 2rem; text-align: center; }
  .box { max-width: 480px; }
  .icon { font-size: 2.5rem; margin-bottom: 1.25rem; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; line-height: 1.3; }
  p { color: #a1a1bc; font-size: 0.95rem; line-height: 1.6; margin-bottom: 0.5rem; }
  a { color: #b09bff; }
  .langs { display: flex; gap: 0.5rem; justify-content: center; margin-top: 1.75rem; }
  .langs button { padding: 0.45rem 0.8rem; border: 1px solid rgba(255,255,255,.13); background: transparent; color: #a1a1bc; border-radius: 6px; font-size: 0.72rem; letter-spacing: 0.06em; cursor: pointer; font-family: inherit; }
  .langs button:hover { color: #eeeef5; border-color: #7c5cff; }
  .langs button.active { color: #c8ff00; border-color: #c8ff00; }
</style>
</head>
<body>
  <div class="box">
    <div class="icon">🛠️</div>
    <h1 id="title">Služba je dočasne nedostupná</h1>
    <p id="line1">Pracujeme na tom, aby sme ju čo najskôr spustili späť.</p>
    <p id="line2">Ďakujeme za trpezlivosť.</p>
    <p id="line3">Aj tak nás môžete kontaktovať na <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
    <div class="langs">
      <button id="btnSk" onclick="setLang('sk')">SK</button>
      <button id="btnCs" onclick="setLang('cs')">CZ</button>
      <button id="btnEn" onclick="setLang('en')">EN</button>
    </div>
  </div>
  <script>
    var T = {
      sk: { pageTitle: 'Služba dočasne nedostupná', title: 'Služba je dočasne nedostupná', line1: 'Pracujeme na tom, aby sme ju čo najskôr spustili späť.', line2: 'Ďakujeme za trpezlivosť.', line3: 'Aj tak nás môžete kontaktovať na ' },
      cs: { pageTitle: 'Služba dočasně nedostupná', title: 'Služba je dočasně nedostupná', line1: 'Pracujeme na tom, abychom ji co nejdříve spustili zpět.', line2: 'Děkujeme za trpělivost.', line3: 'I tak nás můžete kontaktovat na ' },
      en: { pageTitle: 'Service temporarily unavailable', title: 'Service is temporarily unavailable', line1: "We're working on getting it back up as soon as possible.", line2: 'Thank you for your patience.', line3: 'You can still reach us at ' }
    };
    function setLang(lang) {
      var t = T[lang] || T.sk;
      document.documentElement.lang = lang;
      document.getElementById('pageTitle').textContent = t.pageTitle;
      document.getElementById('title').textContent = t.title;
      document.getElementById('line1').textContent = t.line1;
      document.getElementById('line2').textContent = t.line2;
      document.getElementById('line3').firstChild.textContent = t.line3;
      document.getElementById('btnSk').classList.toggle('active', lang === 'sk');
      document.getElementById('btnCs').classList.toggle('active', lang === 'cs');
      document.getElementById('btnEn').classList.toggle('active', lang === 'en');
      try { localStorage.setItem('maintenance-lang', lang); } catch (e) {}
    }
    (function () {
      var saved = null;
      try { saved = localStorage.getItem('maintenance-lang'); } catch (e) {}
      var initial = saved;
      if (!initial) {
        var nav = (navigator.language || 'sk').toLowerCase();
        initial = nav.indexOf('cs') === 0 ? 'cs' : (nav.indexOf('en') === 0 ? 'en' : 'sk');
      }
      setLang(initial);
    })();
  </script>
</body>
</html>`;
}

module.exports = function registerMaintenanceMode(app) {
  // The page itself: if maintenance is actually OFF, visiting /unavalible
  // directly just sends you home instead of showing a stale "we're down"
  // message.
  app.get(UNAVAILABLE_PATH, async (req, res) => {
    const enabled = await isMaintenanceEnabled();
    if (!enabled) return res.redirect(302, '/');
    res.set('Cache-Control', 'no-store');
    res.status(503).type('html').send(pageHtml());
  });

  // Catch-all: when maintenance is ON, every request — any method, any
  // path, whether or not a real route exists for it — gets redirected
  // here instead. Registered this early means it runs before every other
  // route in the app, including ones defined much further down in
  // server.js.
  app.use(async (req, res, next) => {
    if (req.path === UNAVAILABLE_PATH) return next();
    const enabled = await isMaintenanceEnabled();
    if (!enabled) return next();
    return res.redirect(302, UNAVAILABLE_PATH);
  });
};
