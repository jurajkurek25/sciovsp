const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');
if (src.includes('createOneGiftCard')) { console.error('Uz je aplikovane, nic som nezmenil.'); process.exit(1); }
const OLD = `        if (session.metadata?.type === 'gift_card_purchase') {
          const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', session.metadata.optionId).single();
          let gcCode;
          for (let attempt = 0; attempt < 5; attempt++) {
            gcCode = generateGiftCardCode();
            const { data: clash } = await supabase.from('gift_cards').select('id').eq('code', gcCode).maybeSingle();
            if (!clash) break;
          }
          await supabase.from('gift_cards').insert({
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
        }`;
const NEW = `        if (session.metadata?.type === 'gift_card_purchase') {
          const buyerEmailForCard = session.customer_details?.email || session.customer_email || 'unknown';

          const notifyPartnerGiftCredit = (plan, priceCents) => {
            if (!session.metadata?.refCode || !process.env.PARTNER_SERVER_URL || !process.env.PARTNER_WEBHOOK_KEY) return;
            try {
              const https = require('https');
              const creditPayload = JSON.stringify({
                refCode: session.metadata.refCode, customerEmail: buyerEmailForCard, customerName: null,
                plan, amountPaid: (priceCents || 0) / 100
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
          };

          const createOneGiftCard = async (gcOption, includesCourse) => {
            let gcCode;
            for (let attempt = 0; attempt < 5; attempt++) {
              gcCode = generateGiftCardCode();
              const { data: clash } = await supabase.from('gift_cards').select('id').eq('code', gcCode).maybeSingle();
              if (!clash) break;
            }
            await supabase.from('gift_cards').insert({
              code: gcCode, option_id: gcOption.id, kind: gcOption.kind || 'premium', duration_days: gcOption.duration_days || null,
              amount_cents: gcOption.price_cents, buyer_email: buyerEmailForCard,
              recipient_name: session.metadata.recipientName || null, message: session.metadata.message || null,
              stripe_session_id: session.id, includes_course: !!includesCourse
            });
            console.log('✅ Darčeková karta vytvorená:', gcCode);
            if (gcOption.kind === 'premium' || gcOption.kind === 'elite') notifyPartnerGiftCredit(gcOption.kind, gcOption.price_cents);
          };

          let cartItems = null;
          try { cartItems = JSON.parse(session.metadata.cartItems || 'null'); } catch (e) { cartItems = null; }

          if (Array.isArray(cartItems) && cartItems.length) {
            for (const item of cartItems) {
              const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', item.o).single();
              if (!gcOption) continue;
              const qty = Math.min(20, Math.max(1, parseInt(item.q, 10) || 1));
              for (let unit = 0; unit < qty; unit++) {
                await createOneGiftCard(gcOption, !!item.c);
              }
            }
          } else if (session.metadata.optionId) {
            const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', session.metadata.optionId).single();
            if (gcOption) await createOneGiftCard(gcOption, session.metadata.includesCourse === 'true');
          }
          break;
        }`;
const count = src.split(OLD).length - 1;
if (count !== 1) { console.error(`ABORT: anchor occurs ${count} times. No changes.`); process.exit(1); }
const backup = FILE + '.pre-gift-card-cart-webhook-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src.split(OLD).join(NEW));
console.log('OK - zaloha:', backup);
