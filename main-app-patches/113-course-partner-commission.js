// Partnerská provízia (15 % z ceny) aj za predaj KURZOV cez partnerský
// ?ref= odkaz (main-app-patches/111 zachytáva odkaz na strane kurzovej
// stránky a posiela partnerRefCode do checkoutu). Doteraz mal partner
// program províziu len za členstvo (flat 10€, membership_purchase vetva
// webhooku) — kurzy vôbec nehlásili nič partner appke.
//
// Provízia ide VÝHRADNE z podielu platformy: počíta sa z hrubej
// session.amount_total, nie z toho, čo po odpočítaní inštruktorovho
// cutPercent ostane — takže instructor_share_cents sa touto zmenou
// vôbec nemení (presne podľa rozhodnutia z konverzácie).
//
// POZOR: payload posielaný na partner.sptrener.online/api/partner/webhook/credit
// je odhad podľa existujúceho membership-credit kontraktu (rovnaký endpoint,
// rovnaké env premenné) — partnerská appka (mimo tohto repozitára) môže
// potrebovať vlastnú úpravu, aby vedela odlíšiť a spracovať kredit typu
// "course" od "membership" (iný spôsob výpočtu provízie).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('notifyPartnerCourseCredit')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Webhook: pridaj partnerskú províziu do course_purchase vetvy ──
const OLD_WEBHOOK = `        if (session.metadata?.type === 'course_purchase') {
          const courseCustomer = await stripe.customers.retrieve(session.customer);
          const { data: purchasedCourse } = await supabase.from('courses').select('instructor_id, platform_cut_percent, referral_cut_percent').eq('id', session.metadata.courseId).maybeSingle();
          const viaReferral = session.metadata.viaReferral === '1';
          let instructorShareCents = null;
          if (purchasedCourse?.instructor_id) {
            const cutPercent = viaReferral ? purchasedCourse.referral_cut_percent : purchasedCourse.platform_cut_percent;
            instructorShareCents = Math.round(session.amount_total * (100 - cutPercent) / 100);
          }
          await supabase.from('course_purchases').upsert({
            course_id: session.metadata.courseId,
            email: courseCustomer.email,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total,
            instructor_id: purchasedCourse?.instructor_id || null,
            instructor_share_cents: instructorShareCents,
            via_instructor_referral: viaReferral,
            discount_code: session.metadata.discountCode || null
          }, { onConflict: 'course_id,email' });
          if (session.metadata.discountCode) {
            (async () => {
              try {
                const { data: dcRow } = await supabase.from('course_discount_codes').select('id, used_count').ilike('code', session.metadata.discountCode).maybeSingle();
                if (dcRow) await supabase.from('course_discount_codes').update({ used_count: dcRow.used_count + 1 }).eq('id', dcRow.id);
              } catch (e) { console.error('discount code usage increment failed:', e.message); }
            })();
          }
          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);
          break;
        }`;

const NEW_WEBHOOK = `        if (session.metadata?.type === 'course_purchase') {
          const courseCustomer = await stripe.customers.retrieve(session.customer);
          const { data: purchasedCourse } = await supabase.from('courses').select('instructor_id, platform_cut_percent, referral_cut_percent').eq('id', session.metadata.courseId).maybeSingle();
          const viaReferral = session.metadata.viaReferral === '1';
          let instructorShareCents = null;
          if (purchasedCourse?.instructor_id) {
            const cutPercent = viaReferral ? purchasedCourse.referral_cut_percent : purchasedCourse.platform_cut_percent;
            instructorShareCents = Math.round(session.amount_total * (100 - cutPercent) / 100);
          }
          await supabase.from('course_purchases').upsert({
            course_id: session.metadata.courseId,
            email: courseCustomer.email,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total,
            instructor_id: purchasedCourse?.instructor_id || null,
            instructor_share_cents: instructorShareCents,
            via_instructor_referral: viaReferral,
            discount_code: session.metadata.discountCode || null
          }, { onConflict: 'course_id,email' });
          if (session.metadata.discountCode) {
            (async () => {
              try {
                const { data: dcRow } = await supabase.from('course_discount_codes').select('id, used_count').ilike('code', session.metadata.discountCode).maybeSingle();
                if (dcRow) await supabase.from('course_discount_codes').update({ used_count: dcRow.used_count + 1 }).eq('id', dcRow.id);
              } catch (e) { console.error('discount code usage increment failed:', e.message); }
            })();
          }
          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);
          // Partnerská provízia (15 % z hrubej ceny, výhradne z podielu
          // platformy — nemení instructor_share_cents vyššie).
          if (session.metadata.partnerRefCode) {
            const notifyPartnerCourseCredit = (payload) => {
              if (!process.env.PARTNER_SERVER_URL || !process.env.PARTNER_WEBHOOK_KEY) return;
              try {
                const https = require('https');
                const body = JSON.stringify(payload);
                const url = new URL(process.env.PARTNER_SERVER_URL + '/api/partner/webhook/credit');
                const httpReq = https.request(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-webhook-key': process.env.PARTNER_WEBHOOK_KEY }
                });
                httpReq.on('error', (e) => console.error('partner course credit webhook error:', e.message));
                httpReq.write(body);
                httpReq.end();
              } catch (e) {
                console.error('partner course credit webhook error:', e.message);
              }
            };
            const COURSE_PARTNER_COMMISSION_PERCENT = 15;
            const partnerCommissionCents = Math.round(session.amount_total * COURSE_PARTNER_COMMISSION_PERCENT / 100);
            notifyPartnerCourseCredit({
              refCode: session.metadata.partnerRefCode,
              customerEmail: courseCustomer.email,
              customerName: courseCustomer.name || null,
              itemType: 'course',
              courseSlug: session.metadata.courseSlug,
              amountPaid: (session.amount_total || 0) / 100,
              commissionAmount: partnerCommissionCents / 100,
              isOneTime: true
            });
            console.log('💸 Partnerská provízia za kurz:', session.metadata.partnerRefCode, (partnerCommissionCents / 100).toFixed(2) + '€');
          }
          break;
        }`;

patched = replaceOnce(patched, OLD_WEBHOOK, NEW_WEBHOOK, '1: webhook course_purchase vetva');

// ── 2) Checkout: prijmi partnerRefCode z requestu ──
patched = replaceOnce(patched,
  `app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email, discountCode, ref } = req.body || {};`,
  `app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {
  const { email, discountCode, ref, partnerRefCode } = req.body || {};`,
  '2: checkout body destructuring');

// ── 3) Checkout: partnerRefCode do Stripe metadata ──
patched = replaceOnce(patched,
  `      metadata: { type: 'course_purchase', courseId: course.id, courseSlug: course.slug, viaReferral: viaReferral ? '1' : '0', discountCode: appliedDiscountCode || '' }`,
  `      metadata: { type: 'course_purchase', courseId: course.id, courseSlug: course.slug, viaReferral: viaReferral ? '1' : '0', discountCode: appliedDiscountCode || '', partnerRefCode: (partnerRefCode || '').toString().toUpperCase() }`,
  '3: checkout session metadata');

const backup = FILE + '.pre-course-partner-commission-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze PARTNER_SERVER_URL a PARTNER_WEBHOOK_KEY su nastavene v .env (rovnake ako pre membership credit).');
