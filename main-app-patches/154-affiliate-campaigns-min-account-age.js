// Novy pouzivatel nema hned po registracii dostavat affiliate kampane.
// Prida filter podla users.created_at (min_account_age_days z campaign
// riadku, admin ho nastavuje v Dash) do vsetkych 4 vetiev
// getAffiliateCampaignCandidates. Vyzaduje uz spustenu
// db/migrate_affiliate_campaigns_min_age.sql.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.154-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('maxCreatedAt')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const OLD = `async function getAffiliateCampaignCandidates(campaign) {
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
}`;

const NEW = `async function getAffiliateCampaignCandidates(campaign) {
  const cutoff = new Date(Date.now() - (campaign.lookback_days || 30) * 86400000).toISOString();
  const maxCreatedAt = new Date(Date.now() - (campaign.min_account_age_days || 0) * 86400000).toISOString();
  if (campaign.target_signal === 'all') {
    const { data } = await supabase.from('users').select('email').eq('marketing_emails_opt_out', false).lte('created_at', maxCreatedAt).limit(500);
    return (data || []).map(u => u.email);
  }
  if (campaign.target_signal === 'course' && campaign.target_course_id) {
    const { data } = await supabase.from('course_purchases').select('email').eq('course_id', campaign.target_course_id);
    const emails = [...new Set((data || []).map(p => p.email))];
    if (!emails.length) return [];
    const { data: optIn } = await supabase.from('users').select('email').in('email', emails).eq('marketing_emails_opt_out', false).lte('created_at', maxCreatedAt);
    return (optIn || []).map(u => u.email);
  }
  if (campaign.target_signal === 'generalka_buyer') {
    const { data } = await supabase.from('generalka_attempts').select('email').eq('status', 'paid').gte('created_at', cutoff);
    const emails = [...new Set((data || []).map(a => a.email))];
    if (!emails.length) return [];
    const { data: optIn } = await supabase.from('users').select('email').in('email', emails).eq('marketing_emails_opt_out', false).lte('created_at', maxCreatedAt);
    return (optIn || []).map(u => u.email);
  }
  if (campaign.target_signal === 'exam_soon' && campaign.exam_days_before != null) {
    const target = new Date(Date.now() + campaign.exam_days_before * 86400000).toISOString().split('T')[0];
    const { data } = await supabase.from('users').select('email').eq('exam_date', target).eq('marketing_emails_opt_out', false).lte('created_at', maxCreatedAt);
    return (data || []).map(u => u.email);
  }
  return [];
}`;

const patched = replaceOnce(src, OLD, NEW, '1: getAffiliateCampaignCandidates min-account-age filter');

const backup = FILE + '.pre-affiliate-campaigns-min-account-age-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
