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
//
// SR + ČR, spoločné žrebovanie (pozri eligibility.residencyCountries v
// configu). POZOR mimo tohto súboru: bežná cena SP Tréner (kurzy/
// predplatné) sa kvôli súťaži nesmie umelo navýšiť -- v ČR by rozdiel
// medzi účtovanou a obvyklou cenou mohol byť posúdený ako "stávka".
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

// Odstráni súvislé číselné úseky (4+ číslic, prípadne s / - alebo
// medzerou) z textu -- defenzívna poistka PROTI tomu, aby sa do DB
// (ai_reason) dostalo rodné číslo, dátum narodenia a pod., aj keby to
// model ignoroval systémový pokyn nižšie. "Prísne zakázané ukladať
// citlivé údaje" -- toto je kód, nie len prompt.
function stripDigitSequences(s) {
  return String(s == null ? '' : s).replace(/\d[\d/.\-\s]{3,}\d/g, '[odstránené]').slice(0, 300);
}

// Rovnaký vzor ako callAnthropicGrade v produkčnom server.js (hodnotenie
// nahratých materiálov pri kurzoch) -- base64 image/document blok +
// Claude vision, len iná otázka a iný (striktnejší) systémový prompt.
// routes/sutaz.js nemá prístup do scope server.js, takže ide o vlastnú
// malú kópiu, nie o zdieľanú funkciu.
const ADMISSION_AI_MODEL_CHAIN = ['claude-sonnet-5', 'claude-sonnet-4-6'];
async function checkAdmissionDocWithAI(fileBuffer, mimeType, modelIdx) {
  modelIdx = modelIdx || 0;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY nie je nastavený.');
  const base64 = fileBuffer.toString('base64');
  const fileBlock = mimeType === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ADMISSION_AI_MODEL_CHAIN[modelIdx],
      max_tokens: 500,
      system: 'Si asistent, ktorý len OVERUJE, či priložený dokument preukazuje PRIJATIE uchádzača na bakalárske alebo spojené vysokoškolské štúdium (nestačí samotná účasť na prijímačke, umiestnenie v poradovníku ani podanie prihlášky na školu). Odpovedaj VÝLUČNE JSON bez backticks a bez akéhokoľvek iného textu: {"verdict":"admitted" alebo "not_admitted" alebo "unclear","reasonShort":"jedna krátka veta po slovensky"}. Je PRÍSNE ZAKÁZANÉ do "reasonShort" uvádzať meno, rodné číslo, dátum narodenia, adresu, podpis, čiarové/QR kódy ani akékoľvek iné osobné alebo citlivé údaje z dokumentu -- napíš len všeobecné zhodnotenie typu dokumentu a záveru (napr. "dokument je rozhodnutie o prijatí na bakalárske štúdium").',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Over, či tento dokument preukazuje prijatie uchádzača na vysokoškolské štúdium.' },
          fileBlock
        ]
      }]
    })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const errMsg = (data.error && data.error.message) || ('HTTP ' + res.status);
    const looksLikeModelIssue = res.status === 404 || /model/i.test(errMsg);
    if (looksLikeModelIssue && modelIdx < ADMISSION_AI_MODEL_CHAIN.length - 1) {
      console.error(`⚠️ sutaz AI model '${ADMISSION_AI_MODEL_CHAIN[modelIdx]}' zlyhal, skúšam '${ADMISSION_AI_MODEL_CHAIN[modelIdx + 1]}'.`);
      return checkAdmissionDocWithAI(fileBuffer, mimeType, modelIdx + 1);
    }
    throw new Error(errMsg);
  }
  const text = (data.content || []).find(b => b.type === 'text')?.text || '';
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const parsed = JSON.parse(clean.replace(/,\s*([}\]])/g, '$1'));
  const verdict = ['admitted', 'not_admitted', 'unclear'].includes(parsed.verdict) ? parsed.verdict : 'unclear';
  return { verdict, reason: stripDigitSequences(parsed.reasonShort) };
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Súťažný kód (čl. VI ods. 1 štatútu) -- 6 znakov, bez zameniteľných
// znakov (0/O, 1/I/L), crypto.randomInt je kryptograficky bezpečný a
// bez modulo-skreslenia (na rozdiel od Math.random() alebo %-trikov na
// Buffer bajtoch). Kontroluje unikátnosť v DB, nielen spolieha na
// veľkosť priestoru kódov.
const PARTICIPANT_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const PARTICIPANT_CODE_LENGTH = 6;
async function generateUniqueParticipantCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < PARTICIPANT_CODE_LENGTH; i++) {
      code += PARTICIPANT_CODE_ALPHABET[crypto.randomInt(PARTICIPANT_CODE_ALPHABET.length)];
    }
    const { data } = await supabase.from('sutaz_applications').select('id').eq('participant_code', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Nepodarilo sa vygenerovať unikátny súťažný kód.');
}

const ADMISSION_DOC_MIME = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const ADMISSION_DOC_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ADMISSION_DOC_BUCKET = 'sutaz-admission-docs';

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf' };

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ADMISSION_DOC_MAX_SIZE } });

// Rovnaký vzor ako getOrCreateUnsubscribeToken v produkčnom server.js
// (main-app-patches/126) -- vlastná kópia, routes/sutaz.js nemá prístup
// do jeho scope. Odkazuje na existujúcu /api/account/unsubscribe route,
// ktorú NEVYTVÁRA znova, len na ňu linkuje.
async function getOrCreateUnsubscribeTokenLocal(email) {
  const { data: row } = await supabase.from('users').select('unsubscribe_token').eq('email', email).maybeSingle();
  if (row?.unsubscribe_token) return row.unsubscribe_token;
  const token = crypto.randomBytes(24).toString('hex');
  await supabase.from('users').update({ unsubscribe_token: token }).eq('email', email);
  return token;
}

// Pozvánka do súťaže pre nových registrovaných -- pár dní po registrácii,
// len počas otvoreného prihlasovania, len tým, ktorí ešte nepodali
// prihlášku. sutaz_promo_email_sent_at zabraňuje opakovanému behu (nová
// migrácia db/migrate_sutaz_promo_email.sql).
const SUTAZ_PROMO_EMAIL_DELAY_DAYS = 3; // "pár dní" -- uprav tu, ak treba iný odstup
async function sendSutazPromoEmails() {
  try {
    if (effectiveStatus(SUTAZ_CONFIG) !== 'open') return;
    const maxCreatedAt = new Date(Date.now() - SUTAZ_PROMO_EMAIL_DELAY_DAYS * 86400000).toISOString();
    const { data: candidates } = await supabase.from('users')
      .select('email, name')
      .is('sutaz_promo_email_sent_at', null)
      .eq('marketing_emails_opt_out', false)
      .lte('created_at', maxCreatedAt)
      .limit(200);
    if (!candidates || !candidates.length) return;

    const emails = candidates.map(c => c.email);
    const { data: applied } = await supabase.from('sutaz_applications').select('email').in('email', emails);
    const appliedSet = new Set((applied || []).map(a => a.email));

    for (const user of candidates) {
      if (!appliedSet.has(user.email)) {
        try {
          const token = await getOrCreateUnsubscribeTokenLocal(user.email);
          const html = fillEmailTemplate(loadEmailTemplate('sutaz-nova-registracia-pozvanka.html'), {
            NAME: escapeHtml((user.name || '').trim().split(' ')[0] || 'tam'),
            SUTAZ_URL: 'https://sptrener.online/sutaz',
            UNSUBSCRIBE: 'https://sptrener.online/api/account/unsubscribe?token=' + token
          });
          const { sendMail } = require('../mailer');
          await sendMail({ to: user.email, subject: 'Súťaž o darčekovú poukážku Martinus', html });
        } catch (e) {
          console.error('sutaz promo email send error:', user.email, e.message);
          continue; // skús znova nabudúce, nemarkuj ako odoslané
        }
      }
      await supabase.from('users').update({ sutaz_promo_email_sent_at: new Date().toISOString() }).eq('email', user.email);
    }
  } catch (e) {
    console.error('sendSutazPromoEmails error:', e.message);
  }
}

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
    .select('is_premium, plan, subscription_status, premium_expires_at, tests_count, created_at')
    .eq('email', email)
    .maybeSingle();

  const bonusActive = !!(user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
  const isPaidAccess = !!(user?.is_premium || bonusActive);
  const testsCount = Number(user?.tests_count || 0);
  const minTests = SUTAZ_CONFIG.eligibility.minCompletedTests || 1;

  // "Aspoň mesiac používania" -- appka nevie overiť aktívne používanie,
  // len vek účtu (users.created_at). Pozri komentár pri
  // eligibility.minAccountAgeDays v config/sutazConfig.js.
  const minAccountAgeDays = SUTAZ_CONFIG.eligibility.minAccountAgeDays || 0;
  const accountAgeDays = user?.created_at ? (Date.now() - new Date(user.created_at).getTime()) / 86400000 : 0;
  const meetsAccountAgeRequirement = accountAgeDays >= minAccountAgeDays;

  const meetsTestRequirement = testsCount >= minTests;
  const baseEligible = SUTAZ_CONFIG.eligibility.requiresPaidAccess ? (isPaidAccess && meetsTestRequirement) : meetsTestRequirement;

  return {
    isPaidAccess,
    plan: user?.plan || null,
    subscriptionStatus: user?.subscription_status || null,
    testsCount,
    meetsTestRequirement,
    meetsAccountAgeRequirement,
    eligible: baseEligible && meetsAccountAgeRequirement
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
  // Pozvánkové e-maily pre nových registrovaných -- podobný vzor ako
  // setInterval(sendAffiliateCampaignEmails, 5*60*1000) v produkčnom
  // server.js (main-app-patches/152), ale odstup (3 dni) je fixný, takže
  // presnosť na hodiny nič nepridáva -- stačí raz za deň. Bežia
  // samostatne, nezávisle od toho, že tento modul nemá prístup do scope
  // server.js.
  setInterval(sendSutazPromoEmails, 24 * 60 * 60 * 1000);
  sendSutazPromoEmails(); // aj hneď pri štarte appky, nielen po prvom intervale

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

      const { fullName, contactEmail, residenceMunicipality, residenceCountry, schoolName, studyProgram, admissionDecisionDate, ageConfirmed, statuteAck } = req.body || {};
      if (!fullName || !fullName.trim()) return res.status(400).json({ error: 'Chýba meno a priezvisko.' });
      if (!contactEmail || !/^\S+@\S+\.\S+$/.test(contactEmail.trim())) return res.status(400).json({ error: 'Chýba alebo je neplatný súťažný kontaktný e-mail.' });
      if (!residenceMunicipality || !residenceMunicipality.trim()) return res.status(400).json({ error: 'Chýba obec bydliska.' });
      if (!residenceCountry || !residenceCountry.trim()) return res.status(400).json({ error: 'Chýba štát bydliska.' });
      // Bydlisko v SR alebo ČR je podmienka účasti -- rozšírené z pôvodného
      // návrhu (len SR) na spoločné žrebovanie SR+ČR. Self-deklarované,
      // appka nežiada občiansky preukaz, len odfiltruje zjavne iné štáty.
      // Krajina z tohto poľa (nie občianstvo, nie krajina VŠ) určuje, do
      // ktorej "skupiny" účastník patrí -- tu sa len validuje, v DB sa
      // ukladá presne tak, ako ju účastník napísal (pozri residence_country).
      const ELIGIBLE_RESIDENCE_VALUES = [
        'slovensko', 'slovenská republika', 'slovenska republika', 'sr', 'sk', 'slovakia',
        'česko', 'česká republika', 'ceska republika', 'čr', 'cr', 'cz', 'czech republic', 'czechia'
      ];
      if (!ELIGIBLE_RESIDENCE_VALUES.includes(residenceCountry.trim().toLowerCase())) {
        return res.status(403).json({ error: 'Súťaž je určená pre osoby s bydliskom v Slovenskej republike alebo Českej republike.' });
      }
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
            : !eligibility.meetsAccountAgeRequirement
              ? 'Prihláška vyžaduje, aby tvoj účet existoval aspoň ' + (SUTAZ_CONFIG.eligibility.minAccountAgeDays || 0) + ' dní.'
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

        // AI automaticky rozhodne o statuse podľa dokladu -- "admitted" =>
        // rovno 'verified' (bez čakania na manuálnu kontrolu), "not_admitted"
        // alebo "unclear" => rovno 'rejected'. Ak AI zlyhá/je nedostupná
        // (chýba kľúč, výpadok, parse error), appka NEHÁDA -- spadne na
        // bezpečný 'pending' pre manuálnu kontrolu. Rozhodnuté explicitne s
        // Jurajom: plná automatizácia oboma smermi je prijateľné riziko.
        let finalStatus = 'pending';
        let aiVerdict = null;
        let aiReason = null;
        try {
          const aiResult = await checkAdmissionDocWithAI(req.file.buffer, req.file.mimetype);
          aiVerdict = aiResult.verdict;
          aiReason = aiResult.reason;
          finalStatus = aiVerdict === 'admitted' ? 'verified' : 'rejected';
        } catch (e) {
          console.error('sutaz AI admission check error (falling back to manual review):', e.message);
        }

        // Súťažný kód (čl. VI ods. 1) sa prideľuje len platným/overeným
        // účastníkom -- zamietnutému ani čakajúcemu sa nepridelí.
        const participantCode = finalStatus === 'verified' ? await generateUniqueParticipantCode() : null;

        const { error: insertError } = await supabase.from('sutaz_applications').insert({
          email,
          full_name: fullName.trim().slice(0, 200),
          contact_email: contactEmail.trim().toLowerCase().slice(0, 200),
          residence_municipality: residenceMunicipality.trim().slice(0, 200),
          residence_country: residenceCountry.trim().slice(0, 100),
          school_name: schoolName.trim().slice(0, 300),
          study_program: studyProgram.trim().slice(0, 300),
          admission_decision_date: admissionDecisionDate,
          admission_doc_path: filePath,
          admission_doc_mime: req.file.mimetype,
          participant_code: participantCode,
          age_confirmed: true,
          statute_ack: true,
          verified_tests_count: eligibility.testsCount,
          verified_is_premium: eligibility.isPaidAccess,
          verified_plan: eligibility.plan,
          verified_subscription_status: eligibility.subscriptionStatus,
          status: finalStatus,
          ai_verdict: aiVerdict,
          ai_reason: aiReason,
          reviewer_note: aiVerdict ? `Automaticky (AI): ${aiVerdict}${aiReason ? ' — ' + aiReason : ''}` : null,
          reviewed_at: finalStatus === 'pending' ? null : new Date().toISOString()
        });
        if (insertError) {
          // Unique constraint na email -- súbežný druhý request tej istej osoby.
          if (insertError.code === '23505') return res.status(409).json({ error: 'Z tohto účtu je už podaná prihláška.' });
          console.error('sutaz application insert error:', insertError.message);
          return res.status(500).json({ error: 'Chyba servera, skús to znova.' });
        }

        try {
          const { sendMail } = require('../mailer');
          const firstName = escapeHtml(fullName.trim().split(' ')[0] || 'tam');
          if (finalStatus === 'verified') {
            const html = fillEmailTemplate(loadEmailTemplate('sutaz-prihlaska-verified.html'), {
              NAME: firstName, SUTAZ_URL: 'https://sptrener.online/sutaz', CODE: escapeHtml(participantCode)
            });
            sendMail({ to: email, subject: 'Prihláška do súťaže SP Tréner — zaradená do žrebovania', html }).catch(() => {});
          } else if (finalStatus === 'rejected') {
            const html = fillEmailTemplate(loadEmailTemplate('sutaz-prihlaska-zamietnuta.html'), {
              NAME: firstName, REASON: escapeHtml(aiReason || 'doklad nepreukazuje prijatie na vysokoškolské štúdium'),
              CONTACT_EMAIL: SUTAZ_CONFIG.links.organizerContactEmail || 'sutaz@sptrener.online'
            });
            sendMail({ to: email, subject: 'Prihláška do súťaže SP Tréner — nespĺňa podmienky', html }).catch(() => {});
          } else {
            const html = fillEmailTemplate(loadEmailTemplate('sutaz-prihlaska-prijata.html'), {
              NAME: firstName, SUTAZ_URL: 'https://sptrener.online/sutaz'
            });
            sendMail({ to: email, subject: 'Prihláška do súťaže SP Tréner — prijatá na overenie', html }).catch(() => {});
          }
        } catch (e) {
          console.error('sutaz confirmation email error:', e.message);
        }

        res.status(201).json({ ok: true, status: finalStatus });
      } catch (e) {
        console.error('sutaz apply error:', e.message);
        res.status(500).json({ error: 'Chyba servera.' });
      }
    });
  });
};
