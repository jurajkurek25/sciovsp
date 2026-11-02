// main-app-patches/187 spustilo telefónne overenie len "risk-based" --
// až keď email-vzor alebo device fingerprint ukázal zhodu s UŽ
// VYČERPANÝM predošlým účtom (čiže len od 2. účtu na tom istom
// zariadení/emaile). Podľa rozhodnutia používateľa sa to teraz sprísňuje:
// telefón sa overuje VŽDY pri prvom teste nového účtu (trial_count===0,
// ešte neoverený), nie až keď systém deteguje podozrenie.
//
// /api/trial/verify-phone sa NEMENÍ -- už aj tak odmieta rovnaké
// telefónne číslo, ak bolo prvýkrát použité na INÝ email
// (sig.first_email !== email), čím zostáva v platnosti ochrana proti
// zdieľaniu jedného telefónu medzi viacerými účtami.
//
// Predpoklad: main-app-patches/187 (a 188) už sú aplikované a funkčné.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/253-phone-verify-from-first-account.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.253-phone-verify-from-first-account-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let server = fs.readFileSync(SERVER_PATH, 'utf8');

const OLD = `    if (!user.phone_verified && user.trial_count === 0) {
      const signals = [['email_norm', normalizeEmailForAbuseCheck(email)]];
      if (deviceFingerprint) signals.push(['device', String(deviceFingerprint).slice(0, 200)]);

      for (const [type, value] of signals) {
        const { data: sig } = await supabase.from('trial_abuse_signals')
          .select('first_email, exhausted_at').eq('signal_type', type).eq('signal_value', value).maybeSingle();
        if (sig && sig.exhausted_at && sig.first_email !== email) {
          return res.json({ allowed: false, isPremium: false, trialCount: user.trial_count, needsPhoneVerification: true });
        }
      }
      for (const [type, value] of signals) {
        await supabase.from('trial_abuse_signals').upsert(
          { signal_type: type, signal_value: value, first_email: email },
          { onConflict: 'signal_type,signal_value', ignoreDuplicates: true }
        );
      }
    }`;

const NEW = `    if (!user.phone_verified && user.trial_count === 0) {
      // Sprísnené: telefón sa overuje VŽDY pri prvom teste nového účtu,
      // nie až keď systém deteguje podozrivú zhodu s iným účtom (pôvodné
      // risk-based správanie). Signály sa naďalej zaznamenávajú -- /api/trial/verify-phone
      // nižšie ešte stále kontroluje, či rovnaké telefónne číslo nebolo
      // prvýkrát použité na INÝ email, a reuse odmietne.
      const signals = [['email_norm', normalizeEmailForAbuseCheck(email)]];
      if (deviceFingerprint) signals.push(['device', String(deviceFingerprint).slice(0, 200)]);
      for (const [type, value] of signals) {
        await supabase.from('trial_abuse_signals').upsert(
          { signal_type: type, signal_value: value, first_email: email },
          { onConflict: 'signal_type,signal_value', ignoreDuplicates: true }
        );
      }
      return res.json({ allowed: false, isPremium: false, trialCount: user.trial_count, needsPhoneVerification: true });
    }`;

if (!server.includes(OLD)) {
  if (server.includes('Sprísnené: telefón sa overuje VŽDY')) {
    console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  } else {
    console.error('❌ Nenašiel som presnú kotvu v /api/trial/check. Nič som nezmenil.');
  }
  process.exit(1);
}

server = replaceOnce(server, OLD, NEW, '/api/trial/check -> telefón vyžadovaný od prvého účtu, nie až risk-based');

const backup = SERVER_PATH + '.pre-253-phone-verify-from-first-account-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Telefónne overenie sa teraz vyžaduje pri úplne PRVOM teste každého nového účtu.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
