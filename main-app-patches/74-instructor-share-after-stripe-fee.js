// Podiel inštruktora sa doteraz počítal z hrubej ceny (session.amount_total).
// Ngroup, s. r. o. nie je platiteľom DPH (DPH sa nerieši per-transakciu, ale
// raz ročne podľa zákona), takže z hrubej sumy netreba odpočítavať DPH — ale
// treba odpočítať skutočný poplatok Stripe, ktorý si stiahne pred pripísaním
// peňazí. Tento patch dopĺňa načítanie reálneho Stripe poplatku (cez
// balance_transaction na payment_intent) a počíta podiel inštruktora až z
// čistej sumy po odpočítaní tohto poplatku. Poplatok sa navyše ukladá do
// course_purchases.stripe_fee_cents pre transparentnosť (vyžaduje migráciu
// db/add_course_purchases_stripe_fee.sql).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('stripeFeeCents')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

patched = replaceOnce(patched,
  L(
    "          const viaReferral = session.metadata.viaReferral === '1';",
    '          let instructorShareCents = null;',
    '          if (purchasedCourse?.instructor_id) {',
    '            const cutPercent = viaReferral ? purchasedCourse.referral_cut_percent : purchasedCourse.platform_cut_percent;',
    '            instructorShareCents = Math.round(session.amount_total * (100 - cutPercent) / 100);',
    '          }',
    "          await supabase.from('course_purchases').upsert({",
    '            course_id: session.metadata.courseId,',
    '            email: courseCustomer.email,',
    '            stripe_session_id: session.id,',
    '            amount_paid_cents: session.amount_total,',
    '            instructor_id: purchasedCourse?.instructor_id || null,',
    '            instructor_share_cents: instructorShareCents,',
    '            via_instructor_referral: viaReferral,',
    '            discount_code: session.metadata.discountCode || null',
    "          }, { onConflict: 'course_id,email' });"
  ),
  L(
    "          const viaReferral = session.metadata.viaReferral === '1';",
    '          let instructorShareCents = null;',
    '          let stripeFeeCents = null;',
    '          if (purchasedCourse?.instructor_id) {',
    '            if (session.payment_intent) {',
    '              try {',
    "                const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ['latest_charge.balance_transaction'] });",
    '                stripeFeeCents = pi.latest_charge?.balance_transaction?.fee ?? null;',
    "              } catch (e) { console.error('nepodarilo sa zistit stripe poplatok:', e.message); }",
    '            }',
    '            const cutPercent = viaReferral ? purchasedCourse.referral_cut_percent : purchasedCourse.platform_cut_percent;',
    '            const netCents = session.amount_total - (stripeFeeCents || 0);',
    '            instructorShareCents = Math.round(netCents * (100 - cutPercent) / 100);',
    '          }',
    "          await supabase.from('course_purchases').upsert({",
    '            course_id: session.metadata.courseId,',
    '            email: courseCustomer.email,',
    '            stripe_session_id: session.id,',
    '            amount_paid_cents: session.amount_total,',
    '            stripe_fee_cents: stripeFeeCents,',
    '            instructor_id: purchasedCourse?.instructor_id || null,',
    '            instructor_share_cents: instructorShareCents,',
    '            via_instructor_referral: viaReferral,',
    '            discount_code: session.metadata.discountCode || null',
    "          }, { onConflict: 'course_id,email' });"
  ),
  '1: instructor share computed after Stripe fee deduction');

const backup = FILE + '.pre-instructor-share-after-stripe-fee-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
