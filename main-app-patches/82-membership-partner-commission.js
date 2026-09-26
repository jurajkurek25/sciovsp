// Partnerská provízia za jednorazové členstvo kúpené cez /ponuka — flat
// 10€ (na rozdiel od bežného predplatného, kde provízia škáluje podľa
// Premium/Elite + výkonnostného tieru). Mechanizmus je rovnaký ako pri
// existujúcom /api/rewards/video/complete partner-bonus hooku (pozri
// ad-service/48-partner-free-video-bonus.js): priamy HTTPS POST na
// partner.sptrener.online s x-webhook-key hlavičkou, fire-and-forget.
//
// Predpoklad: 78-membership-checkout.js (endpoint + webhook branch) je už
// nasadený. Tento patch skúša DVA varianty anchoru pre checkout endpoint,
// pretože 81-membership-classic-pricing.js mohol (ale nemusel) medzitým
// zmeniť jeho telo — použije ten, ktorý sa v súbore skutočne nájde.
//
// Vyžaduje env premenné PARTNER_SERVER_URL a PARTNER_WEBHOOK_KEY (rovnaké
// ako pri video-watch-bonus hooku) — ak chýbajú, notifikácia sa len ticho
// vynechá (partner appka ju vtedy nedostane, ale samotný nákup nie je
// ničím blokovaný).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('notifyPartnerMembershipCredit')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOneOfVariants(s, variants, label) {
  for (const [oldStr, newStr] of variants) {
    const count = s.split(oldStr).length - 1;
    if (count === 1) return s.replace(oldStr, newStr);
    if (count > 1) { console.error(label + ': anchor nájdený viackrát (' + count + 'x), nejednoznačné. Nic som nezmenil.'); process.exit(1); }
  }
  console.error(label + ': ziadny zo znamych anchorov nenajdeny. Nic som nezmenil.');
  process.exit(1);
}

let patched = src;

// ── 1) Checkout endpoint: prijmi refCode z requestu, pridaj do Stripe metadata ──
patched = replaceOneOfVariants(patched, [
  // Variant A: po 81-membership-classic-pricing.js
  [
    `  const { email, tier, months, pricingMode } = req.body || {};`,
    `  const { email, tier, months, pricingMode, refCode } = req.body || {};`
  ],
  // Variant B: len 78-membership-checkout.js, bez 81
  [
    `  const { email, tier, months } = req.body || {};`,
    `  const { email, tier, months, refCode } = req.body || {};`
  ]
], '1a: checkout body destructuring');

patched = replaceOneOfVariants(patched, [
  [
    `      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths) }`,
    `      metadata: { type: 'membership_purchase', tier: cleanTier, months: String(cleanMonths), refCode: (refCode || '').toString().toUpperCase() }`
  ]
], '1b: checkout session metadata');

// ── 2) Webhook branch: po aktivácii členstva notifikuj partner appku ──
patched = replaceOneOfVariants(patched, [
  [
    `          await supabase.from('users').upsert({
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString()
          });
          console.log('✅ Členstvo aktivované:', membershipEmail, membershipTier, membershipMonths + 'm');
          break;`,
    `          await supabase.from('users').upsert({
            email: membershipEmail,
            is_premium: true,
            plan: membershipTier,
            stripe_customer_id: session.customer,
            membership_expires_at: membershipExpiresAt.toISOString()
          });
          console.log('✅ Členstvo aktivované:', membershipEmail, membershipTier, membershipMonths + 'm');
          if (session.metadata?.refCode) {
            notifyPartnerMembershipCredit({
              refCode: session.metadata.refCode,
              customerEmail: membershipEmail,
              customerName: membershipCustomer.name || null,
              plan: membershipTier,
              amountPaid: (session.amount_total || 0) / 100,
              isOneTime: true
            });
          }
          break;`
  ]
], '2: webhook membership_purchase branch');

// ── 3) Helper funkcia — vlastný require('https') vnútri, aby patch nezávisel
// od toho, či top-level `const https = require('https');` už niekde existuje.
// Deklarovaná tesne pred použitím (nie na top-level súboru), takže nepotrebuje
// žiadny krehký anchor na inom mieste súboru — každé volanie webhook handleru
// ju jednoducho znova nadefinuje vo svojom vlastnom scope, čo je neškodné. ──
patched = replaceOneOfVariants(patched, [
  [
    `if (session.metadata?.type === 'membership_purchase') {`,
    `const notifyPartnerMembershipCredit = (payload) => {
          if (!process.env.PARTNER_SERVER_URL || !process.env.PARTNER_WEBHOOK_KEY) return;
          try {
            const https = require('https');
            const body = JSON.stringify(payload);
            const url = new URL(process.env.PARTNER_SERVER_URL + '/api/partner/webhook/credit');
            const httpReq = https.request(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-webhook-key': process.env.PARTNER_WEBHOOK_KEY }
            });
            httpReq.on('error', (e) => console.error('partner membership credit webhook error:', e.message));
            httpReq.write(body);
            httpReq.end();
          } catch (e) {
            console.error('partner membership credit webhook error:', e.message);
          }
        };
        if (session.metadata?.type === 'membership_purchase') {`
  ]
], '3: notifyPartnerMembershipCredit helper');

const backup = FILE + '.pre-membership-partner-commission-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze PARTNER_SERVER_URL a PARTNER_WEBHOOK_KEY su nastavene v .env (rovnake ako pre video-watch-bonus).');
