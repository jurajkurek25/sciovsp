// FINANČNÁ ZÁPLATA — TOCTOU diera v limite "3 testy zadarmo".
//
// /api/trial/check bol JEDINÉ miesto, ktoré kontrolovalo a zvyšovalo
// trial_count pre prihlásených userov. /api/generate-full-test (najdrahší
// endpoint — až 14 paralelných Claude API volaní na jeden test) pre
// prihlásených userov (keď je v tele `email`) nerobil ŽIADNU kontrolu
// trial_count/is_premium — spoliehal sa, že klient najprv zavolá
// /api/trial/check. Nič ale nebránilo priamemu opakovanému volaniu
// /api/generate-full-test BEZ toho, aby sa /api/trial/check vôbec
// zavolal — trial_count by tak nikdy nenarástol a limit by sa nikdy
// neuplatnil → neobmedzené bezplatné plné testy pre free-tier účet.
//
// Táto záplata:
//   1. Presúva AUTORITATÍVNU kontrolu + zvýšenie trial_count (rovnaké
//      pravidlá ako doteraz: telefón overený pred prvým testom, 3 testy
//      zadarmo, signál "exhausted_at" pri vyčerpaní) PRIAMO do
//      /api/generate-full-test, tesne pred reálnym vygenerovaním —
//      túto kontrolu teraz nemožno obísť, nech klient zavolá čokoľvek.
//   2. Mení /api/trial/check na read-only status check (NEzvyšuje už
//      trial_count) — inak by sa pri bežnom flowe (klient volá najprv
//      trial/check, potom generate-full-test) počítadlo zvyšovalo
//      DVAKRÁT na jeden test.
//
// Vedľajší, priaznivý efekt: trial sa teraz "spotrebuje" iba keď sa test
// skutočne aj vygeneruje — predtým sa trial minul aj pri zlyhanom
// generovaní (sieťová chyba, chyba AI), čo bolo voči userom nefér.
//
// POZOR: over po nasadení, že frontend správne zobrazuje počet
// zostávajúcich testov PO dokončení testu (predtým dostávalo UI nové
// číslo hneď z /api/trial/check odpovede PRED generovaním — teraz ho
// dostane až v odpovedi z /api/generate-full-test, ak frontend číta
// trialCount z nej; ak frontend číta trialCount LEN z /api/trial/check
// a nikdy ho needčítava po teste, treba to doplniť na frontende).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/281-close-trial-count-bypass.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.281-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('patch 281')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) /api/generate-full-test — doplniť autoritatívnu kontrolu pre
//    prihlásených userov (else-vetva k existujúcej anonymnej kontrole).
const GFT_OLD = `  const isCZ = lang === 'cz';

  // Anonymný používateľ (bez emailu v tele) -- "1 test zadarmo bez
  // registrácie" bol doteraz vynucovaný len cez localStorage na
  // klientovi. Serverová kontrola podľa IP, rovnaký vzor ako
  // main-app-patches/187 (trial_abuse_signals).
  if (!email) {
    const anonIp = getClientIp(req) || 'unknown';
    const { data: existingIp } = await supabase.from('trial_abuse_signals')
      .select('signal_value').eq('signal_type', 'ip_anon_fulltest').eq('signal_value', anonIp).maybeSingle();
    if (existingIp) {
      return res.status(403).json({ error: 'Bezplatný test bez registrácie si už vyčerpal. Zaregistruj sa a dostaneš ďalšie 3 testy zadarmo.' });
    }
    await supabase.from('trial_abuse_signals').upsert(
      { signal_type: 'ip_anon_fulltest', signal_value: anonIp, first_email: 'anonymous' },
      { onConflict: 'signal_type,signal_value', ignoreDuplicates: true }
    );
  }`;

const GFT_NEW = `  const isCZ = lang === 'cz';

  // Anonymný používateľ (bez emailu v tele) -- "1 test zadarmo bez
  // registrácie" bol doteraz vynucovaný len cez localStorage na
  // klientovi. Serverová kontrola podľa IP, rovnaký vzor ako
  // main-app-patches/187 (trial_abuse_signals).
  if (!email) {
    const anonIp = getClientIp(req) || 'unknown';
    const { data: existingIp } = await supabase.from('trial_abuse_signals')
      .select('signal_value').eq('signal_type', 'ip_anon_fulltest').eq('signal_value', anonIp).maybeSingle();
    if (existingIp) {
      return res.status(403).json({ error: 'Bezplatný test bez registrácie si už vyčerpal. Zaregistruj sa a dostaneš ďalšie 3 testy zadarmo.' });
    }
    await supabase.from('trial_abuse_signals').upsert(
      { signal_type: 'ip_anon_fulltest', signal_value: anonIp, first_email: 'anonymous' },
      { onConflict: 'signal_type,signal_value', ignoreDuplicates: true }
    );
  } else {
    // Prihlásený používateľ -- autoritatívna kontrola a zvýšenie
    // trial_count PRIAMO tu (patch 281), nie len v /api/trial/check,
    // inak sa dal limit "3 testy zadarmo" obísť priamym volaním tohto
    // endpointu bez toho, aby sa /api/trial/check vôbec zavolal.
    // Rovnaké pravidlá ako doteraz v /api/trial/check.
    const { data: trialUser } = await supabase.from('users')
      .select('is_premium, trial_count, phone_verified').eq('email', email).maybeSingle();
    if (!trialUser) return res.status(404).json({ error: 'Používateľ nenájdený.' });
    if (!trialUser.is_premium) {
      const FREE_TESTS = 3;
      if (!trialUser.phone_verified && trialUser.trial_count === 0) {
        return res.status(403).json({ error: 'Over si telefónne číslo pred prvým testom.', needsPhoneVerification: true });
      }
      if (trialUser.trial_count >= FREE_TESTS) {
        return res.status(403).json({ error: 'Bezplatné testy si už vyčerpal/a. Pre ďalšie testy potrebuješ Premium alebo Elite.' });
      }
      const newTrialCount = trialUser.trial_count + 1;
      await supabase.from('users').update({ trial_count: newTrialCount }).eq('email', email);
      if (newTrialCount >= FREE_TESTS) {
        await supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() })
          .eq('signal_type', 'email_norm').eq('signal_value', normalizeEmailForAbuseCheck(email));
      }
    }
  }`;

src = replaceExactCount(src, GFT_OLD, GFT_NEW, 1, '/api/generate-full-test anonymous/login trial branch');

// 2) /api/trial/check — stáva sa read-only (bez zvyšovania trial_count),
//    aby sa pri bežnom flowe (trial/check → generate-full-test) počítadlo
//    nezvyšovalo dvakrát na jeden test.
const CHECK_OLD = `    const newCount = user.trial_count + 1;
    await supabase.from('users').update({ trial_count: newCount }).eq('email', email);

    if (newCount >= FREE_TESTS) {
      const marks = [supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() }).eq('signal_type', 'email_norm').eq('signal_value', normalizeEmailForAbuseCheck(email))];
      if (deviceFingerprint) marks.push(supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() }).eq('signal_type', 'device').eq('signal_value', String(deviceFingerprint).slice(0, 200)));
      await Promise.all(marks);
    }

    res.json({ allowed: true, isPremium: false, trialCount: newCount });`;

const CHECK_NEW = `    // (patch 281) trial_count sa už NEZVYŠUJE tu -- toto je teraz len
    // read-only status check. Autoritatívne zvýšenie (a exhausted_at
    // signál) robí priamo /api/generate-full-test, tesne pred reálnym
    // vygenerovaním testu -- inak sa dal limit obísť priamym volaním
    // generovacieho endpointu bez toho, aby sa tento endpoint zavolal.
    res.json({ allowed: true, isPremium: false, trialCount: user.trial_count });`;

src = replaceExactCount(src, CHECK_OLD, CHECK_NEW, 1, '/api/trial/check increment block');

const backup = FILE + '.pre-281-close-trial-count-bypass-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: /api/generate-full-test teraz samo kontroluje a zvyšuje trial_count pre prihlásených userov.');
console.log('✅ server.js: /api/trial/check je teraz read-only (nezvyšuje trial_count, aby sa nepočítalo dvakrát).');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ:');
console.log('   1. pm2 restart sptrener-main');
console.log('   2. Over, že free-tier účet po 3 testoch skutočne dostane "vyčerpané" a Premium/Elite účet generuje bez obmedzenia.');
console.log('   3. Over na stránke, že počet zostávajúcich testov sa v UI zobrazuje správne AJ po dokončení testu (predtým ho UI mohlo čítať len z /api/trial/check PRED generovaním -- ak tak, treba to na frontende doplniť, aby čítalo aktuálny počet aj po vygenerovaní).');
