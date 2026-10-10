// Súťaž "/sutaz" o darčekové poukážky Martinus -- prihláška pre
// zákazníkov SP Tréner, ktorí boli prijatí na vysokú školu. Rovnaký
// vzor ako routes/community.js a routes/generalka.js (vlastný Supabase
// klient, vlastný verifyToken, vlastný multer) -- module.exports je
// funkcia, voláš ju require('./routes/sutaz')(app), MUSÍ byť
// registrovaná AŽ ZA app.use(express.json(...)) v server.js.
//
// Status/ceny/termíny/odkazy žijú v config/sutazConfig.js -- JEDEN
// zdroj pravdy. effectiveStatus() núti appku do 'coming_soon' (žiadne
// prihlasovanie), kým chýba čokoľvek zásadné -- toto rozhodnutie platí
// zhodne na frontende aj tu na serveri, takže sa nedá obísť priamym
// volaním API.
'use strict';

const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SUTAZ_CONFIG, effectiveStatus } = require('../config/sutazConfig');

// Rovnaký [PLACEHOLDER] vzor ako loadWebinarEmailTemplate/fillWebinarTemplate
// v server.js -- tie funkcie žijú len v jeho lokálnom scope (nie sú
// require()-ovateľné odtiaľto), takže ide o malú samostatnú kópiu.
function loadEmailTemplate(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'emails', name), 'utf8');
}
function fillEmailTemplate(html, vars) {
  let out = html;
  for (const key of Object.keys(vars)) {
    out = out.split('[' + key + ']').join(vars[key] == null ? '' : String(vars[key]));
  }
  return out;
}
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ADMISSION_DOC_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const ADMISSION_DOC_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ADMISSION_DOC_BUCKET = 'sutaz-admission-docs';

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ADMISSION_DOC_MAX_SIZE } });

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

// Jediné miesto, ktoré rozhoduje o oprávnenosti -- rovnaký princíp ako
// getCommunityAccess v routes/community.js. Číta PRIAMO z users (žiadna
// samostatná subscriptions tabuľka v produkcii -- pozri is_premium/plan/
// subscription_status/premium_expires_at vzor z main-app-patches/105).
async function getEligibility(email) {
  const { data: user } = await supabase
    .from('users')
    .select('is_premium, plan, subscription_status, premium_expires_at, tests_count')
    .eq('email', email)
    .maybeSingle();

  const bonusActive = !!(user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
  const isPaidAccess = !!(user?.is_premium || bonusActive);
  const testsCount = Number(user?.tests_count || 0);
  const minTests = SUTAZ_CONFIG.eligibility.minCompletedTests || 1;

  return {
    isPaidAccess,
    plan: user?.plan || null,
    subscriptionStatus: user?.subscription_status || null,
    testsCount,
    meetsTestRequirement: testsCount >= minTests,
    eligible: SUTAZ_CONFIG.eligibility.requiresPaidAccess ? (isPaidAccess && testsCount >= minTests) : testsCount >= minTests
  };
}

function publicConfig() {
  const cfg = SUTAZ_CONFIG;
  const status = effectiveStatus(cfg);
  // Ceny/termíny sa zobrazujú IBA keď je konfigurácia reálne kompletná
  // (effectiveStatus() už toto zohľadnila -- 'coming_soon' znamená buď
  // zámerne pripravujeme, alebo chýbajú zásadné údaje; v oboch prípadoch
  // frontend nemá dôvod vidieť čiastočne vyplnené ceny/termíny).
  const showDetails = status !== 'coming_soon';
  return {
    status,
    martinusPartnershipConfirmed: !!cfg.martinusPartnershipConfirmed,
    prizes: showDetails ? cfg.prizes : null,
    dates: showDetails ? cfg.dates : null,
    eligibility: cfg.eligibility,
    links: {
      privacyPolicyUrl: cfg.links.privacyPolicyUrl,
      fullStatuteUrl: showDetails ? cfg.links.fullStatuteUrl : null,
      organizerContactEmail: showDetails ? cfg.links.organizerContactEmail : null,
      organizerName: showDetails ? cfg.links.organizerName : null
    },
    results: status === 'results' ? cfg.results : null
  };
}

module.exports = function registerSutaz(app) {
  // GET /api/sutaz/status -- verejné, bez prihlásenia. Jediný zdroj
  // pravdy pre frontend o tom, čo má zobraziť.
  app.get('/api/sutaz/status', (req, res) => {
    res.json(publicConfig());
  });

  // GET /api/sutaz/me -- vyžaduje prihlásenie. Vráti údaje na predvyplnenie
  // formulára a signály oprávnenosti (nikdy sa nepoužíva na konečné
  // rozhodnutie -- to sa vždy prepočíta nanovo v POST /apply).
  app.get('/api/sutaz/me', async (req, res) => {
    const authUser = await verifyToken(req);
    if (!authUser) return res.status(401).json({ error: 'Prihlás sa.' });
    const email = (authUser.email || '').toLowerCase();

    try {
      const [{ data: userRow }, { data: existing }] = await Promise.all([
        supabase.from('users').select('name').eq('email', email).maybeSingle(),
        supabase.from('sutaz_applications').select('id, status, created_at').eq('email', email).maybeSingle()
      ]);
      const eligibility = await getEligibility(email);
      res.json({
        email,
        name: userRow?.name || null,
        eligibility,
        alreadyApplied: !!existing,
        application: existing ? { status: existing.status, createdAt: existing.created_at } : null
      });
    } catch (e) {
      console.error('sutaz /me error:', e.message);
      res.status(500).json({ error: 'Chyba servera.' });
    }
  });

  // POST /api/sutaz/apply -- vyžaduje prihlásenie. Server si VŽDY znova
  // overí oprávnenosť (platený prístup + dokončené testy) priamo z users
  // -- klient nemôže poslať "som oprávnený" a appka mu to uverí.
  app.post('/api/sutaz/apply', (req, res) => {
    upload.single('admissionDoc')(req, res, async (uploadErr) => {
      if (uploadErr) {
        const msg = uploadErr.code === 'LIMIT_FILE_SIZE' ? 'Súbor je príliš veľký (max 10 MB).' : (uploadErr.message || 'Nahrávanie zlyhalo.');
        return res.status(400).json({ error: msg });
      }

      const status = effectiveStatus(SUTAZ_CONFIG);
      if (status !== 'open') {
        return res.status(403).json({ error: 'Prihlasovanie do súťaže momentálne nie je otvorené.' });
      }

      const authUser = await verifyToken(req);
      if (!authUser) return res.status(401).json({ error: 'Prihlás sa.' });
      const email = (authUser.email || '').toLowerCase();

      const { fullName, schoolName, studyProgram, admissionDecisionDate, ageConfirmed, statuteAck } = req.body || {};
      if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Chýba meno a priezvisko.' });
      if (!schoolName || !schoolName.trim()) return res.status(400).json({ error: 'Chýba názov vysokej školy.' });
      if (!studyProgram || !studyProgram.trim()) return res.status(400).json({ error: 'Chýba názov študijného programu.' });
      if (!admissionDecisionDate || !/^\d{4}-\d{2}-\d{2}$/.test(admissionDecisionDate)) {
        return res.status(400).json({ error: 'Chýba alebo je neplatný dátum rozhodnutia o prijatí.' });
      }
      if (ageConfirmed !== 'true' && ageConfirmed !== true) {
        return res.status(400).json({ error: 'Musíš potvrdiť, že máš aspoň 18 rokov.' });
      }
      if (statuteAck !== 'true' && statuteAck !== true) {
        return res.status(400).json({ error: 'Musíš potvrdiť, že si sa oboznámil/a so štatútom súťaže.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Chýba doklad o prijatí na vysokú školu.' });
      if (!ADMISSION_DOC_MIME.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Povolené formáty dokladu: PDF, PNG, JPG alebo WEBP.' });
      }
      if (req.file.size > ADMISSION_DOC_MAX_SIZE) {
        return res.status(400).json({ error: 'Súbor je príliš veľký (max 10 MB).' });
      }

      try {
        const { data: existing } = await supabase.from('sutaz_applications').select('id').eq('email', email).maybeSingle();
        if (existing) return res.status(409).json({ error: 'Z tohto účtu je už podaná prihláška. Jedna osoba sa môže zapojiť len raz.' });

        const eligibility = await getEligibility(email);
        if (!eligibility.eligible) {
          const reason = !eligibility.isPaidAccess
            ? 'Prihláška vyžaduje riadne zaplatený prístup k SP Tréner.'
            : 'Prihláška vyžaduje aspoň ' + (SUTAZ_CONFIG.eligibility.minCompletedTests || 1) + ' dokončený tréningový test.';
          return res.status(403).json({ error: reason });
        }

        const ext = MIME_EXT[req.file.mimetype] || 'bin';
        const filePath = `${crypto.randomBytes(16).toString('hex')}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(ADMISSION_DOC_BUCKET).upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype
        });
        if (uploadError) {
          console.error('sutaz admission doc upload error:', uploadError.message);
          return res.status(500).json({ error: 'Nahrávanie dokladu zlyhalo, skús to znova.' });
        }

        const { error: insertError } = await supabase.from('sutaz_applications').insert({
          email,
          full_name: fullName.trim().slice(0, 200),
          phone: (req.body.phone || '').trim().slice(0, 40) || null,
          school_name: schoolName.trim().slice(0, 300),
          study_program: studyProgram.trim().slice(0, 300),
          admission_decision_date: admissionDecisionDate,
          admission_doc_path: filePath,
          admission_doc_mime: req.file.mimetype,
          age_confirmed: true,
          statute_ack: true,
          verified_tests_count: eligibility.testsCount,
          verified_is_premium: eligibility.isPaidAccess,
          verified_plan: eligibility.plan,
          verified_subscription_status: eligibility.subscriptionStatus,
          status: 'pending'
        });
        if (insertError) {
          // Unique constraint na email -- súbežný druhý request tej istej osoby.
          if (insertError.code === '23505') return res.status(409).json({ error: 'Z tohto účtu je už podaná prihláška.' });
          console.error('sutaz application insert error:', insertError.message);
          return res.status(500).json({ error: 'Chyba servera, skús to znova.' });
        }

        try {
          const { sendMail } = require('../mailer');
          const html = fillEmailTemplate(loadEmailTemplate('sutaz-prihlaska-prijata.html'), {
            NAME: escapeHtml(fullName.trim().split(' ')[0] || 'tam'),
            SUTAZ_URL: 'https://sptrener.online/sutaz'
          });
          sendMail({ to: email, subject: 'Prihláška do súťaže SP Tréner — prijatá na overenie', html }).catch(() => {});
        } catch (e) {
          console.error('sutaz confirmation email error:', e.message);
        }

        res.status(201).json({ ok: true, status: 'pending' });
      } catch (e) {
        console.error('sutaz apply error:', e.message);
        res.status(500).json({ error: 'Chyba servera.' });
      }
    });
  });
};
