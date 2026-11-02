// FINANČNÁ ZÁPLATA — POST /api/community/conversations/:id/report volá AI
// (callClaudeJudge, moderátor nahlásených súkromných správ) úplne bez
// stropu. requireCommunityAccess vyžaduje platiaceho Premium/Elite člena,
// takže nejde o anonymné zneužitie zadarmo, ale aj platiaci člen mohol
// doteraz zavolať tento endpoint ľubovoľne veľakrát za sebou (aj opakovane
// na tú istú konverzáciu) a zakaždým sa zaplatilo Claude API volanie.
//
// Táto záplata pridáva dve nezávislé poistky priamo do routes/community.js:
//   1. Opakované nahlásenie TEJ ISTEJ konverzácie tým istým človekom
//      nevolá AI znova -- vráti sa už uložený verdikt z prvého nahlásenia.
//   2. Denný strop 10 NOVÝCH (rôznych) nahlásení na používateľa, počítaný
//      priamo z existujúcej tabuľky community_message_reports -- žiadna
//      nová DB migrácia netreba, tabuľka už má created_at stĺpec.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/297-community-report-daily-cap.js
const fs = require('fs');
const FILE = 'routes/community.js';

const LOCK = FILE.replace(/[\\/]/g, '-') + '.297-lock';
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

if (src.includes('REPORT_DAILY_LIMIT')) {
  console.error('❌ routes/community.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD_1 = `  app.post('/api/community/conversations/:id/report', requireCommunityAccess, async (req, res) => {
    try {
      const convoId = parseInt(req.params.id, 10);
      const { data: convo } = await supabase.from('community_conversations').select('*').eq('id', convoId).maybeSingle();
      if (!convo) return res.status(404).json({ error: 'Konverzácia sa nenašla.' });
      if (convo.user_a !== req.communityEmail && convo.user_b !== req.communityEmail) return res.status(403).json({ error: 'Nemáš prístup k tejto konverzácii.' });
      const reportedEmail = convo.user_a === req.communityEmail ? convo.user_b : convo.user_a;
      const { data: messages, error } = await supabase.from('community_messages').select('sender_email, body, created_at').eq('conversation_id', convoId).order('created_at', { ascending: false }).limit(DM_REPORT_MAX_MESSAGES);`;

const NEW_1 = `  const REPORT_DAILY_LIMIT = 10;
  app.post('/api/community/conversations/:id/report', requireCommunityAccess, async (req, res) => {
    try {
      const convoId = parseInt(req.params.id, 10);
      const { data: convo } = await supabase.from('community_conversations').select('*').eq('id', convoId).maybeSingle();
      if (!convo) return res.status(404).json({ error: 'Konverzácia sa nenašla.' });
      if (convo.user_a !== req.communityEmail && convo.user_b !== req.communityEmail) return res.status(403).json({ error: 'Nemáš prístup k tejto konverzácii.' });
      const reportedEmail = convo.user_a === req.communityEmail ? convo.user_b : convo.user_a;

      const { data: existingReport } = await supabase.from('community_message_reports')
        .select('ai_verdict, ai_reasoning').eq('conversation_id', convoId).eq('reporter_email', req.communityEmail)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (existingReport) {
        return res.json({ verdict: existingReport.ai_verdict, reasoning: existingReport.ai_reasoning, alreadyReported: true });
      }

      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const { count: todaysReportCount } = await supabase.from('community_message_reports')
        .select('id', { count: 'exact', head: true }).eq('reporter_email', req.communityEmail).gte('created_at', todayStart.toISOString());
      if ((todaysReportCount || 0) >= REPORT_DAILY_LIMIT) {
        return res.status(429).json({ error: 'Dosiahol/a si denný limit nahlásení (' + REPORT_DAILY_LIMIT + '/deň). Skús to znova zajtra.' });
      }

      const { data: messages, error } = await supabase.from('community_messages').select('sender_email, body, created_at').eq('conversation_id', convoId).order('created_at', { ascending: false }).limit(DM_REPORT_MAX_MESSAGES);`;

src = replaceExactCount(src, OLD_1, NEW_1, 1, 'POST /api/community/conversations/:id/report -- denný strop + dedup');

const backup = FILE.replace(/[\\/]/g, '-') + '.pre-297-community-report-daily-cap-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ routes/community.js: nahlásenie konverzácie teraz má denný strop (10/deň) a nevolá AI znova pri opakovanom nahlásení tej istej konverzácie.');
console.log('   Záloha:', backup);
console.log('   pm2 restart sptrener-main');
