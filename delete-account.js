// Kompletné GDPR vymazanie používateľského účtu — zdieľané medzi server.js
// (okamžité "nesúhlasím, vymaž môj účet" kliknutie, main-app-patches/262)
// a main-app-patches/264 (automatické zmazanie po termíne, spúšťané cez cron).
//
// Best-effort: každý krok je samostatne try/catch-nutý — chyba v jednom
// kroku nezastaví zvyšok, cieľom je zmazať čo najviac, nie zlyhať na
// polceste a nechať účet v nekonzistentnom stave.
//
// Zrušenie Stripe predplatného sa robí cez stripe.subscriptions.list() na
// stripe_customer_id, NIE cez uložené stripe_subscription_id — users
// tabuľka v tejto appke (na rozdiel od ad_banners/video_ads) žiadne
// subscription_id neuchováva.
//
// Tabuľky, kde by zmazanie celého riadku poškodilo DRUHÚ STRANU (darčekový
// poukaz kúpený/uplatnený niekým iným, odporúčanie, partnerská provízia —
// účtovný záznam pre partnera) sa iba anonymizujú (email tohto účtu sa
// nastaví na null), riadok ostáva.

async function findAuthUserIdByEmail(supabase, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    const hit = data.users.find(u => (u.email || '').toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function deleteUserAccountCompletely(supabase, stripe, email) {
  const log = (step, err) => console.error('delete-account [' + step + '] zlyhalo pre ' + email + ':', err.message);

  // 1) Stripe — zruš všetky predplatné naviazané na stripe_customer_id
  try {
    const { data: userRow } = await supabase.from('users').select('stripe_customer_id').eq('email', email).maybeSingle();
    if (userRow?.stripe_customer_id && stripe) {
      const subs = await stripe.subscriptions.list({ customer: userRow.stripe_customer_id, status: 'all', limit: 100 });
      for (const sub of subs.data) {
        if (['active', 'trialing', 'past_due', 'unpaid'].includes(sub.status)) {
          try { await stripe.subscriptions.cancel(sub.id); } catch (e) { log('stripe cancel ' + sub.id, e); }
        }
      }
    }
  } catch (e) { log('stripe lookup', e); }

  // 2) Vlastný obsah a aktivita — patrí výlučne tomuto účtu, natvrdo zmazať
  const hardDeleteByEmail = [
    ['career_quiz_results', 'email'],
    ['clan_members', 'email'],
    ['clan_stats', 'email'],
    ['community_comments', 'author_email'],
    ['community_likes', 'author_email'],
    ['community_photos', 'author_email'],
    ['community_posts', 'author_email'],
    ['community_messages', 'sender_email'],
    ['community_profiles', 'email'],
    ['course_lesson_comments', 'email'],
    ['course_lesson_progress', 'email'],
    ['course_lesson_quiz_progress', 'email'],
    ['course_lesson_submissions', 'email'],
    ['course_purchases', 'email'],
    ['generalka_attempts', 'email'],
    ['training_streaks', 'email'],
    ['trial_abuse_signals', 'first_email'],
    ['video_ad_views', 'user_email']
  ];
  for (const [table, col] of hardDeleteByEmail) {
    try { await supabase.from(table).delete().eq(col, email); } catch (e) { log(table, e); }
  }

  // Tabuľky s 2 emailovými stĺpcami — samostatný delete na každý (bez .or(),
  // aby sa email nikdy neinterpoloval do PostgREST filter-stringu)
  try { await supabase.from('sutaz_applications').delete().eq('email', email); } catch (e) { log('sutaz_applications email', e); }
  try { await supabase.from('sutaz_applications').delete().eq('contact_email', email); } catch (e) { log('sutaz_applications contact_email', e); }
  try { await supabase.from('community_message_reports').delete().eq('reporter_email', email); } catch (e) { log('community_message_reports reporter', e); }
  try { await supabase.from('community_message_reports').delete().eq('reported_email', email); } catch (e) { log('community_message_reports reported', e); }
  try { await supabase.from('community_conversations').delete().eq('user_a', email); } catch (e) { log('community_conversations user_a', e); }
  try { await supabase.from('community_conversations').delete().eq('user_b', email); } catch (e) { log('community_conversations user_b', e); }

  // 3) Dáta tretích strán — iba anonymizovať email tohto účtu, riadok ostáva
  try { await supabase.from('gift_cards').update({ buyer_email: null }).eq('buyer_email', email); } catch (e) { log('gift_cards buyer', e); }
  try { await supabase.from('gift_cards').update({ redeemed_by_email: null }).eq('redeemed_by_email', email); } catch (e) { log('gift_cards redeemed', e); }
  try { await supabase.from('referrals').update({ referrer_email: null }).eq('referrer_email', email); } catch (e) { log('referrals referrer', e); }
  try { await supabase.from('referrals').update({ referred_email: null }).eq('referred_email', email); } catch (e) { log('referrals referred', e); }
  try { await supabase.from('partner_credits').update({ customer_email: null }).eq('customer_email', email); } catch (e) { log('partner_credits', e); }

  // 4) Supabase Auth účet (prihlasovanie) + naviazaný profil
  try {
    const authId = await findAuthUserIdByEmail(supabase, email);
    if (authId) {
      try { await supabase.from('user_profiles').delete().eq('user_id', authId); } catch (e) { log('user_profiles', e); }
      try { await supabase.auth.admin.deleteUser(authId); } catch (e) { log('auth.admin.deleteUser', e); }
    }
  } catch (e) { log('auth lookup', e); }

  // 5) Samotný riadok v users — posledný krok
  try { await supabase.from('users').delete().eq('email', email); } catch (e) { log('users', e); }
}

module.exports = { deleteUserAccountCompletely, findAuthUserIdByEmail };
