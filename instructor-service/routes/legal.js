// Zmluvné podmienky pre inštruktorov — štandardné (verzované, platia pre
// všetkých) + voliteľná individuálna dohoda na mieru (nastaví admin cez
// dash, inštruktor ju musí samostatne potvrdiť). Potvrdenie na klientovi
// je 10-sekundové podržanie tlačidla (má simulovať vedomé, nie náhodné
// odsúhlasenie) — server tu len eviduje výsledok (kedy, akú verziu,
// z akej IP/user-agentu), samotné vynútenie 10 sekúnd je na frontende.
const express = require('express');
const router = express.Router();
const { requireInstructorAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || null;
}

async function getLatestTermsVersion() {
  const { data } = await mainDb.from('instructor_standard_terms').select('*').order('version', { ascending: false }).limit(1).maybeSingle();
  return data;
}

// Vynucuje, že inštruktor má potvrdené AKTUÁLNE štandardné podmienky aj
// prípadnú vlastnú dohodu — pre mutujúce endpointy (vytvorenie kurzu,
// zľavového kódu, žiadosť o výplatu...). Čítanie (GET) ostáva vždy
// dostupné, inak by sa inštruktor ani nedozvedel, že má niečo potvrdiť.
async function requireTermsAccepted(req, res, next) {
  const latest = await getLatestTermsVersion();
  if (latest && req.instructor.terms_accepted_version !== latest.version) {
    return res.status(403).json({ error: 'Najprv musíš potvrdiť aktuálne zmluvné podmienky.', code: 'TERMS_REQUIRED' });
  }
  const { data: pendingAgreement } = await mainDb.from('instructor_custom_agreements')
    .select('id').eq('instructor_id', req.instructor.id).is('superseded_at', null).is('accepted_at', null).maybeSingle();
  if (pendingAgreement) {
    return res.status(403).json({ error: 'Najprv musíš potvrdiť individuálnu dohodu.', code: 'AGREEMENT_REQUIRED' });
  }
  next();
}

router.get('/api/instructor/terms', requireInstructorAuth, async (req, res) => {
  const latest = await getLatestTermsVersion();
  if (!latest) return res.json({ version: null, content: '', accepted: true });
  res.json({
    version: latest.version,
    content: latest.content,
    accepted: req.instructor.terms_accepted_version === latest.version
  });
});

router.post('/api/instructor/accept-terms', requireInstructorAuth, async (req, res) => {
  const latest = await getLatestTermsVersion();
  if (!latest) return res.status(400).json({ error: 'Žiadne podmienky na potvrdenie.' });
  const { data, error } = await mainDb.from('instructors').update({
    terms_accepted_at: new Date().toISOString(),
    terms_accepted_version: latest.version,
    terms_accept_ip: clientIp(req),
    terms_accept_user_agent: req.headers['user-agent'] || null
  }).eq('id', req.instructor.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true, termsAcceptedVersion: data.terms_accepted_version, termsAcceptedAt: data.terms_accepted_at });
});

router.get('/api/instructor/custom-agreement', requireInstructorAuth, async (req, res) => {
  const { data, error } = await mainDb.from('instructor_custom_agreements')
    .select('*').eq('instructor_id', req.instructor.id).is('superseded_at', null)
    .order('created_by_admin_at', { ascending: false }).limit(1).maybeSingle();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ agreement: data || null });
});

router.post('/api/instructor/custom-agreement/:id/accept', requireInstructorAuth, async (req, res) => {
  const { data: agreement } = await mainDb.from('instructor_custom_agreements').select('*').eq('id', req.params.id).maybeSingle();
  if (!agreement || agreement.instructor_id !== req.instructor.id) return res.status(404).json({ error: 'Dohoda sa nenašla.' });
  if (agreement.superseded_at) return res.status(400).json({ error: 'Táto dohoda už nie je aktuálna.' });
  const { data, error } = await mainDb.from('instructor_custom_agreements').update({
    accepted_at: new Date().toISOString(),
    accept_ip: clientIp(req),
    accept_user_agent: req.headers['user-agent'] || null
  }).eq('id', agreement.id).select().single();
  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }
  res.json({ ok: true, agreement: data });
});

module.exports = { router, requireTermsAccepted };
