// Vynucuje na checkout endpointe novú "dostupnosť kurzu" (courses.access_mode):
// - 'paid' (default): bez zmeny, ide sa cez Stripe ako doteraz.
// - 'free': rovnaká vetva ako doteraz existujúci price_cents === 0 free-kurz,
//   len naviac spúšťaná aj cez access_mode.
// - 'subscription': kurz je zadarmo LEN pre používateľa, ktorý má PRÁVE TERAZ
//   aktívne predplatné (is_premium alebo premium_expires_at v budúcnosti) v
//   niektorom z tierov, ktoré admin/inštruktor pre tento kurz zaškrtol
//   (included_in_premium a/alebo included_in_elite). Používa presne ten istý
//   mechanizmus ako existujúci free-kurz — vloží course_purchases riadok s
//   amount_paid_cents: 0 (navyše označený via_subscription_tier: true) a
//   presmeruje rovno na /watch bez Stripe.
//
// DÔLEŽITÉ OBMEDZENIE: prístup udelený takto je (rovnako ako pri free
// kurze) TRVALÝ od momentu udelenia — ak používateľovi neskôr predplatné
// vyprší, tento kurz mu automaticky nezmizne, lebo všetky ostatné endpointy
// (submit úlohy, záverečný test, komentáre...) kontrolujú len "existuje
// course_purchases riadok", nie aktuálny stav predplatného. Skutočné
// okamžité odobratie prístupu pri vypršaní predplatného by vyžadovalo
// prerobiť všetky tieto miesta (viac ako 8 endpointov) na spoločnú kontrolu
// — to je zámerne mimo rozsahu tohto patchu, urob to ako samostatný krok,
// ak to naozaj potrebuješ prísne vynucovať.
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('freeAccessGranted')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const OLD = `    // Bezplatny kurz (price_cents = 0) — pristup sa udeli rovno po Google
    // prihlaseni, bez Stripe checkoutu.
    if (course.price_cents === 0) {
      const { error: freeError } = await supabase.from('course_purchases').insert({
        course_id: course.id, email, stripe_session_id: 'free_' + require('crypto').randomBytes(8).toString('hex'), amount_paid_cents: 0
      });
      if (freeError) throw freeError;
      return res.json({ url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?free=1' });
    }`;

const NEW = `    // Bezplatny kurz (price_cents = 0 alebo access_mode='free') — pristup sa
    // udeli rovno po Google prihlaseni, bez Stripe checkoutu. Kurz zahrnuty
    // v predplatnom (access_mode='subscription') sa odomkne zadarmo LEN ak
    // ma pouzivatel prave teraz aktivne predplatne v tieri, ktory
    // admin/instruktor pre tento kurz zaskrtol (Premium a/alebo Elite).
    let freeAccessGranted = course.price_cents === 0 || course.access_mode === 'free';
    if (!freeAccessGranted && course.access_mode === 'subscription') {
      const { data: subUser } = await supabase.from('users').select('is_premium, plan, premium_expires_at').eq('email', email).maybeSingle();
      const bonusActive = subUser?.premium_expires_at && new Date(subUser.premium_expires_at) > new Date();
      const isPremiumActive = !!(subUser?.is_premium || bonusActive);
      const userPlan = subUser?.plan === 'elite' ? 'elite' : 'premium';
      const tierMatches = userPlan === 'elite' ? course.included_in_elite : course.included_in_premium;
      if (isPremiumActive && tierMatches) freeAccessGranted = true;
    }
    if (freeAccessGranted) {
      const { error: freeError } = await supabase.from('course_purchases').insert({
        course_id: course.id, email, stripe_session_id: 'free_' + require('crypto').randomBytes(8).toString('hex'), amount_paid_cents: 0, via_subscription_tier: course.access_mode === 'subscription'
      });
      if (freeError) throw freeError;
      return res.json({ url: BASE_URL_BLOG + '/kurzy/' + course.slug + '/watch?free=1' });
    }`;

const count = src.split(OLD).length - 1;
if (count !== 1) { console.error('Kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-subscription-course-access-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
