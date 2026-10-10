const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

const L = (...lines) => lines.join('\n');

if (src.includes('viaReferral: viaReferral')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) Webhook: compute instructor share + record discount code, increment usage ──
patched = replaceOnce(patched,
  L(
    "        if (session.metadata?.type === 'course_purchase') {",
    '          const courseCustomer = await stripe.customers.retrieve(session.customer);',
    "          await supabase.from('course_purchases').upsert({",
    '            course_id: session.metadata.courseId,',
    '            email: courseCustomer.email,',
    '            stripe_session_id: session.id,',
    '            amount_paid_cents: session.amount_total',
    "          }, { onConflict: 'course_id,email' });",
    "          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);",
    '          break;',
    '        }'
  ),
  L(
    "        if (session.metadata?.type === 'course_purchase') {",
    '          const courseCustomer = await stripe.customers.retrieve(session.customer);',
    "          const { data: purchasedCourse } = await supabase.from('courses').select('instructor_id, platform_cut_percent, referral_cut_percent').eq('id', session.metadata.courseId).maybeSingle();",
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
    "          }, { onConflict: 'course_id,email' });",
    '          if (session.metadata.discountCode) {',
    '            (async () => {',
    '              try {',
    "                const { data: dcRow } = await supabase.from('course_discount_codes').select('id, used_count').ilike('code', session.metadata.discountCode).maybeSingle();",
    "                if (dcRow) await supabase.from('course_discount_codes').update({ used_count: dcRow.used_count + 1 }).eq('id', dcRow.id);",
    '              } catch (e) { console.error(\'discount code usage increment failed:\', e.message); }',
    '            })();',
    '          }',
    "          console.log('✅ Kurz zakúpený:', courseCustomer.email, session.metadata.courseSlug);",
    '          break;',
    '        }'
  ),
  '1: webhook revenue split + discount usage');

// ── 2) Checkout: accept discountCode + ref in body ──
patched = replaceOnce(patched,
  L(
    "app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {",
    '  const { email } = req.body || {};'
  ),
  L(
    "app.post('/api/courses/:slug/checkout', rateLimit, async (req, res) => {",
    '  const { email, discountCode, ref } = req.body || {};'
  ),
  '2: destructure discountCode/ref');

// ── 3) Checkout: referral + discount validation, inserted after the free-course branch ──
patched = replaceOnce(patched,
  L(
    "      return res.json({ url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?free=1' });",
    '    }',
    '',
    '    let customerId;'
  ),
  L(
    "      return res.json({ url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?free=1' });",
    '    }',
    '',
    '    let viaReferral = false;',
    '    if (ref && course.instructor_id) {',
    "      const { data: refInstructor } = await supabase.from('instructors').select('id').eq('referral_code', ref).maybeSingle();",
    '      if (refInstructor && refInstructor.id === course.instructor_id) viaReferral = true;',
    '    }',
    '',
    '    let appliedDiscountCode = null;',
    '    let finalPriceCents = course.price_cents;',
    '    if (discountCode) {',
    "      const { data: dc } = await supabase.from('course_discount_codes').select('*').ilike('code', discountCode).maybeSingle();",
    '      const now = new Date();',
    '      const valid = dc && dc.active && (!dc.course_id || dc.course_id === course.id) && (!dc.expires_at || new Date(dc.expires_at) > now) && (dc.max_uses == null || dc.used_count < dc.max_uses);',
    "      if (!valid) return res.status(400).json({ error: 'Neplatný alebo expirovaný zľavový kód.' });",
    '      appliedDiscountCode = dc.code;',
    '      finalPriceCents = Math.max(50, Math.round(course.price_cents * (100 - dc.percent_off) / 100));',
    '    }',
    '',
    '    let customerId;'
  ),
  '3: referral + discount validation');

// ── 4) Checkout: use finalPriceCents instead of course.price_cents ──
patched = replaceOnce(patched,
  L(
    '        price_data: {',
    "          currency: 'eur',",
    '          unit_amount: course.price_cents,',
    '          product_data: { name: course.title, ...(course.description ? { description: course.description.slice(0, 300) } : {}), ...(course.cover_image_url ? { images: [course.cover_image_url] } : {}) }',
    '        },'
  ),
  L(
    '        price_data: {',
    "          currency: 'eur',",
    '          unit_amount: finalPriceCents,',
    '          product_data: { name: course.title, ...(course.description ? { description: course.description.slice(0, 300) } : {}), ...(course.cover_image_url ? { images: [course.cover_image_url] } : {}) }',
    '        },'
  ),
  '4: unit_amount -> finalPriceCents');

// ── 5) Checkout: extend metadata with viaReferral + discountCode ──
patched = replaceOnce(patched,
  "      metadata: { type: 'course_purchase', courseId: course.id, courseSlug: course.slug }",
  "      metadata: { type: 'course_purchase', courseId: course.id, courseSlug: course.slug, viaReferral: viaReferral ? '1' : '0', discountCode: appliedDiscountCode || '' }",
  '5: extend metadata');

const backup = FILE + '.pre-course-discount-and-revenue-split-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
