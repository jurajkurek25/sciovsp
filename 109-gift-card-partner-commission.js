const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes('partner gift card credit webhook error')) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
function applyOne(s, old, neu, label) {
  const count = s.split(old).length - 1;
  if (count !== 1) { console.error(`ABORT (${label}): anchor occurs ${count} times. No changes.`); process.exit(1); }
  return s.split(old).join(neu);
}
let out = src;
out = applyOne(out,
  `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { optionId, buyerEmail, recipientName, message, includeCourse } = req.body || {};`,
  `app.post('/api/gift-cards/checkout', rateLimit, async (req, res) => {
  const { optionId, buyerEmail, recipientName, message, includeCourse, refCode } = req.body || {};`,
  'checkout body');
out = applyOne(out,
  `      metadata: {
        type: 'gift_card_purchase', optionId: option.id,
        recipientName: (recipientName || '').slice(0, 100),
        message: (message || '').slice(0, 300),
        includesCourse: courseAddon ? 'true' : 'false'
      }`,
  `      metadata: {
        type: 'gift_card_purchase', optionId: option.id,
        recipientName: (recipientName || '').slice(0, 100),
        message: (message || '').slice(0, 300),
        includesCourse: courseAddon ? 'true' : 'false',
        refCode: (refCode || '').toString().toUpperCase().slice(0, 20)
      }`,
  'checkout metadata');
out = applyOne(out,
  `          await supabase.from('gift_cards').insert({
            code: gcCode, option_id: gcOption?.id || null, kind: gcOption?.kind || 'premium', duration_days: gcOption?.duration_days || null,
            amount_cents: session.amount_total, buyer_email: session.customer_details?.email || session.customer_email || 'unknown',
            recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
            stripe_session_id: session.id, includes_course: session.metadata.includesCourse === 'true'
          });
          console.log('✅ Darčeková karta vytvorená:', gcCode);
          break;
        }`,
  `          await supabase.from('gift_cards').insert({
            code: gcCode, option_id: gcOption?.id || null, kind: gcOption?.kind || 'premium', duration_days: gcOption?.duration_days || null,
            amount_cents: session.amount_total, buyer_email: session.customer_details?.email || session.customer_email || 'unknown',
            recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
            stripe_session_id: session.id, includes_course: session.metadata.includesCourse === 'true'
          });
          console.log('✅ Darčeková karta vytvorená:', gcCode);
          if (session.metadata?.refCode && (gcOption?.kind === 'premium' || gcOption?.kind === 'elite') && process.env.PARTNER_SERVER_URL && process.env.PARTNER_WEBHOOK_KEY) {
            try {
              const https = require('https');
              const creditPayload = JSON.stringify({
                refCode: session.metadata.refCode,
                customerEmail: session.customer_details?.email || session.customer_email || 'unknown',
                customerName: null,
                plan: gcOption.kind,
                amountPaid: (session.amount_total || 0) / 100
              });
              const creditUrl = new URL(process.env.PARTNER_SERVER_URL + '/api/partner/webhook/credit');
              const creditReq = https.request(creditUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(creditPayload), 'x-webhook-key': process.env.PARTNER_WEBHOOK_KEY }
              });
              creditReq.on('error', (e) => console.error('partner gift card credit webhook error:', e.message));
              creditReq.write(creditPayload);
              creditReq.end();
            } catch (e) {
              console.error('partner gift card credit webhook error:', e.message);
            }
          }
          break;
        }`,
  'webhook credit');
const backup = FILE + '.pre-gift-card-partner-commission-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, out);
console.log('OK - zaloha:', backup);
