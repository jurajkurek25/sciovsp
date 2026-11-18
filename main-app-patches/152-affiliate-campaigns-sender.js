// Automaticke AI affiliate kampane — beh kazdych 5 min (rovnaky vzor ako
// sendGeneralkaOfferEmails a ostatne naplanovane emaily nizsie v subore).
// Pre kazdu aktivnu affiliate_campaigns: (1) ak este nema vygenerovany
// text, raz zavola Claude a vysledok ulozi (zdielany pre vsetkych
// prijemcov — negenerujeme zvlast pre kazdeho, kvoli nakladom aj rychlosti),
// (2) najde kandidatov podla target_signal (vzdy len
// marketing_emails_opt_out=false), (3) posle max 50 novych na jeden beh,
// (4) zapise do affiliate_campaign_sends aby sa nikdy neposlalo dvakrat.
// Vyzaduje uz spustenu db/migrate_affiliate_campaigns.sql a nahraty
// subor emails/affiliate-campaign.html.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.152-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('sendAffiliateCampaignEmails')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

if (!fs.existsSync('emails/affiliate-campaign.html')) {
  console.error('emails/affiliate-campaign.html chyba — najprv ho treba nahrat (spustaj z korena appky). Nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const OLD = `setInterval(sendGeneralkaOfferEmails, 5 * 60 * 1000);
sendGeneralkaOfferEmails();

app.post('/api/reviews/submit', rateLimit, async (req, res) => {`;

const NEW = `setInterval(sendGeneralkaOfferEmails, 5 * 60 * 1000);
sendGeneralkaOfferEmails();

// ─── Automatické AI affiliate kampane (partneri zapísaní v Dash) ───
const CAMPAIGN_COPY_MODEL = 'claude-sonnet-5';
function generateAffiliateCampaignCopy(campaign) {
  return new Promise((resolve, reject) => {
    const system = 'Si copywriter pre SP Tréner (online príprava na VŠP/SCIO prijímacie testy na vysoké školy). Píšeš krátky, hodnotný email pre našich používateľov — NIE tvrdú reklamu. Je to osobný, hodnotný odkaz s krátkymi odsekmi (1-3 vety), ktorý sa až na konci prirodzene naviaže na ponuku partnera.\\n\\n' +
      'Partner: ' + campaign.partner_name + '\\n' +
      'Čo predáva / kontext: ' + campaign.product_description +
      (campaign.subject_hint ? '\\nTéma/štýl na inšpiráciu: ' + campaign.subject_hint : '') +
      '\\n\\nOdpovedz IBA JSON v tomto presnom tvare, žiadny iný text, žiadne markdown fences:\\n' +
      '{"subject": "predmet emailu, max 60 znakov", "ctaText": "text CTA tlačidla (2-4 slová)", "paragraphs": ["odsek 1", "odsek 2", "..."]}\\n\\n' +
      'Odsekov má byť 3-6, posledný má prirodzene viesť k CTA tlačidlu. Píš po slovensky, neformálne, občas emoji.';
    const payload = JSON.stringify({
      model: CAMPAIGN_COPY_MODEL,
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: 'Priprav text kampane.' }]
    });
    const https = require('https');
    const apiReq = https.request({
      hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' }
    }, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = (parsed.content || []).filter(b => b.type === 'text').map(b => b.text).join('\\n').trim();
          const jsonText = text.replace(/^\`\`\`(?:json)?\\s*/i, '').replace(/\`\`\`\\s*$/i, '').trim();
          const result = JSON.parse(jsonText);
          if (!result.subject || !result.ctaText || !Array.isArray(result.paragraphs) || !result.paragraphs.length) {
            return reject(new Error('Neplatný tvar JSON odpovede.'));
          }
          resolve(result);
        } catch (e) { reject(e); }
      });
    });
    apiReq.on('error', reject);
    apiReq.write(payload); apiReq.end();
  });
}

async function getAffiliateCampaignCandidates(campaign) {
  const cutoff = new Date(Date.now() - (campaign.lookback_days || 30) * 86400000).toISOString();
  if (campaign.target_signal === 'all') {
    const { data } = await supabase.from('users').select('email').eq('marketing_emails_opt_out', false).limit(500);
    return (data || []).map(u => u.email);
  }
  if (campaign.target_signal === 'course' && campaign.target_course_id) {
    const { data } = await supabase.from('course_purchases').select('email').eq('course_id', campaign.target_course_id);
    const emails = [...new Set((data || []).map(p => p.email))];
    if (!emails.length) return [];
    const { data: optIn } = await supabase.from('users').select('email').in('email', emails).eq('marketing_emails_opt_out', false);
    return (optIn || []).map(u => u.email);
  }
  if (campaign.target_signal === 'generalka_buyer') {
    const { data } = await supabase.from('generalka_attempts').select('email').eq('status', 'paid').gte('created_at', cutoff);
    const emails = [...new Set((data || []).map(a => a.email))];
    if (!emails.length) return [];
    const { data: optIn } = await supabase.from('users').select('email').in('email', emails).eq('marketing_emails_opt_out', false);
    return (optIn || []).map(u => u.email);
  }
  if (campaign.target_signal === 'exam_soon' && campaign.exam_days_before != null) {
    const target = new Date(Date.now() + campaign.exam_days_before * 86400000).toISOString().split('T')[0];
    const { data } = await supabase.from('users').select('email').eq('exam_date', target).eq('marketing_emails_opt_out', false);
    return (data || []).map(u => u.email);
  }
  return [];
}

async function sendAffiliateCampaignEmails() {
  try {
    const { data: campaigns } = await supabase.from('affiliate_campaigns').select('*').eq('active', true);
    for (const campaign of campaigns || []) {
      let bodyHtml = campaign.generated_body_html;
      let subject = campaign.generated_subject;
      let ctaText = campaign.generated_cta_text;
      if (!bodyHtml) {
        let generated;
        try {
          generated = await generateAffiliateCampaignCopy(campaign);
        } catch (e) {
          console.error('affiliate campaign generate error:', campaign.id, e.message);
          continue;
        }
        bodyHtml = generated.paragraphs.map(p => '<p style="margin:0 0 16px;color:rgba(246,241,231,.75);font-size:15px;line-height:1.6;">' + escapeHtml(p) + '</p>').join('');
        subject = generated.subject;
        ctaText = generated.ctaText;
        await supabase.from('affiliate_campaigns').update({
          generated_subject: subject, generated_body_html: bodyHtml, generated_cta_text: ctaText, generated_at: new Date().toISOString()
        }).eq('id', campaign.id);
      }

      const candidates = await getAffiliateCampaignCandidates(campaign);
      if (!candidates.length) continue;
      const { data: already } = await supabase.from('affiliate_campaign_sends').select('email').eq('campaign_id', campaign.id).in('email', candidates);
      const alreadySet = new Set((already || []).map(a => a.email));
      const toSend = candidates.filter(e => !alreadySet.has(e)).slice(0, 50);

      for (const email of toSend) {
        try {
          const unsubToken = await getOrCreateUnsubscribeToken(email);
          const html = fillWebinarTemplate(loadWebinarEmailTemplate('affiliate-campaign.html'), {
            BODY_HTML: bodyHtml,
            CTA_URL: campaign.cta_url,
            CTA_TEXT: ctaText || 'Pozrieť ponuku',
            UNSUBSCRIBE: EXAM_APP_URL + '/api/account/unsubscribe?token=' + unsubToken
          });
          await sendExamMail({ to: email, subject: subject || (campaign.partner_name + ' — ponuka pre teba'), html });
          await supabase.from('affiliate_campaign_sends').insert({ campaign_id: campaign.id, email });
        } catch (e) {
          console.error('affiliate campaign send error:', campaign.id, email, e.message);
        }
      }
    }
  } catch (e) {
    console.error('sendAffiliateCampaignEmails error:', e.message);
  }
}
setInterval(sendAffiliateCampaignEmails, 5 * 60 * 1000);
sendAffiliateCampaignEmails();

app.post('/api/reviews/submit', rateLimit, async (req, res) => {`;

const patched = replaceOnce(src, OLD, NEW, '1: affiliate campaigns sender');

const backup = FILE + '.pre-affiliate-campaigns-sender-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
