// Adds Elite support to the gift-card system (checkout addon eligibility,
// PDF label, redeem entitlement). Idempotent — safe to re-run.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("card.kind === 'elite'")) {
  console.error('Uz je aplikovane (najdene card.kind === elite), nic som nezmenil.');
  process.exit(1);
}

function applyOne(src, old, neu, label) {
  const count = src.split(old).length - 1;
  if (count !== 1) {
    console.error(`ABORT (${label}): anchor occurs ${count} times (expected 1). No changes made.`);
    process.exit(1);
  }
  return src.split(old).join(neu);
}

let out = src;

// 1) Checkout: allow the course add-on for elite cards too
out = applyOne(out,
  `    let courseAddon = null;
    if (option.kind === 'premium' && includeCourse) {`,
  `    let courseAddon = null;
    if ((option.kind === 'premium' || option.kind === 'elite') && includeCourse) {`,
  'checkout addon'
);

// 2) PDF: three-way label + elite included in the combo line
out = applyOne(out,
  `    const label = card.kind === 'premium'
      ? \`Premium prístup na \${card.duration_days} dní\`
      : '1 online kurz podľa vlastného výberu';
    doc.fillColor('#a1a1bc').fontSize(12).font('Helvetica').text(label, 30, 95);
    let cardY = 115;
    if (card.kind === 'premium' && card.includes_course) {`,
  `    const label = card.kind === 'premium'
      ? \`Premium prístup na \${card.duration_days} dní\`
      : card.kind === 'elite'
      ? \`Elite prístup na \${card.duration_days} dní\`
      : '1 online kurz podľa vlastného výberu';
    doc.fillColor('#a1a1bc').fontSize(12).font('Helvetica').text(label, 30, 95);
    let cardY = 115;
    if ((card.kind === 'premium' || card.kind === 'elite') && card.includes_course) {`,
  'PDF label'
);

// 3) Redeem: grant elite plan (never downgrades an already-active elite user
// who happens to redeem a premium card — extends their days, keeps their tier)
out = applyOne(out,
  `    if (card.kind === 'premium') {
      let bundledCourse = null;
      if (card.includes_course) {
        if (!courseId) return res.status(400).json({ error: 'Táto karta obsahuje aj kurz — vyber si ho.' });
        const { data: courseRow } = await supabase.from('courses').select('id,slug').eq('id', courseId).eq('published', true).single();
        if (!courseRow) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
        const { data: already } = await supabase.from('course_purchases').select('id').eq('course_id', courseRow.id).eq('email', email).maybeSingle();
        if (already) return res.status(400).json({ error: 'Tento kurz už máš zakúpený.' });
        bundledCourse = courseRow;
      }

      const { data: user } = await supabase.from('users').select('id,premium_expires_at').eq('email', email).maybeSingle();
      const now = new Date();
      const base = (user?.premium_expires_at && new Date(user.premium_expires_at) > now) ? new Date(user.premium_expires_at) : now;
      const newExpiry = new Date(base.getTime() + card.duration_days * 24 * 60 * 60 * 1000);
      if (user) {
        await supabase.from('users').update({ premium_expires_at: newExpiry.toISOString() }).eq('email', email);
      } else {
        await supabase.from('users').insert({ email, is_premium: false, premium_expires_at: newExpiry.toISOString() });
      }
      if (bundledCourse) {
        await supabase.from('course_purchases').insert({
          course_id: bundledCourse.id, email, stripe_session_id: 'giftcard_' + card.code, amount_paid_cents: 0
        });
      }
      await supabase.from('gift_cards').update({
        status: 'redeemed', redeemed_by_email: email, redeemed_course_id: bundledCourse ? bundledCourse.id : null, redeemed_at: new Date().toISOString()
      }).eq('id', card.id);
      return res.json({ ok: true, kind: 'premium', premiumExpiresAt: newExpiry.toISOString(), courseSlug: bundledCourse ? bundledCourse.slug : null });
    }`,
  `    if (card.kind === 'premium' || card.kind === 'elite') {
      let bundledCourse = null;
      if (card.includes_course) {
        if (!courseId) return res.status(400).json({ error: 'Táto karta obsahuje aj kurz — vyber si ho.' });
        const { data: courseRow } = await supabase.from('courses').select('id,slug').eq('id', courseId).eq('published', true).single();
        if (!courseRow) return res.status(404).json({ error: 'Kurz sa nenašiel.' });
        const { data: already } = await supabase.from('course_purchases').select('id').eq('course_id', courseRow.id).eq('email', email).maybeSingle();
        if (already) return res.status(400).json({ error: 'Tento kurz už máš zakúpený.' });
        bundledCourse = courseRow;
      }

      const { data: user } = await supabase.from('users').select('id,premium_expires_at,plan').eq('email', email).maybeSingle();
      const now = new Date();
      const base = (user?.premium_expires_at && new Date(user.premium_expires_at) > now) ? new Date(user.premium_expires_at) : now;
      const newExpiry = new Date(base.getTime() + card.duration_days * 24 * 60 * 60 * 1000);
      const currentlyActiveElite = user?.plan === 'elite' && user?.premium_expires_at && new Date(user.premium_expires_at) > now;
      const newPlan = (card.kind === 'elite' || currentlyActiveElite) ? 'elite' : 'premium';
      if (user) {
        await supabase.from('users').update({ premium_expires_at: newExpiry.toISOString(), plan: newPlan }).eq('email', email);
      } else {
        await supabase.from('users').insert({ email, is_premium: false, premium_expires_at: newExpiry.toISOString(), plan: newPlan });
      }
      if (bundledCourse) {
        await supabase.from('course_purchases').insert({
          course_id: bundledCourse.id, email, stripe_session_id: 'giftcard_' + card.code, amount_paid_cents: 0
        });
      }
      await supabase.from('gift_cards').update({
        status: 'redeemed', redeemed_by_email: email, redeemed_course_id: bundledCourse ? bundledCourse.id : null, redeemed_at: new Date().toISOString()
      }).eq('id', card.id);
      return res.json({ ok: true, kind: card.kind, premiumExpiresAt: newExpiry.toISOString(), courseSlug: bundledCourse ? bundledCourse.slug : null });
    }`,
  'redeem'
);

const backup = FILE + '.pre-elite-gift-cards-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, out);
console.log('OK - zaloha:', backup);
