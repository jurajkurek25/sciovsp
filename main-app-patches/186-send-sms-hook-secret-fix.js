// OPRAVA main-app-patches/185: Supabase v skutočnosti generuje Send SMS
// Hook secret v tvare "v1,whsec_<base64>" (to "v1," je Supabase-in
// vlastný prefix na rotáciu kľúčov, NIE súčasť Standard Webhooks
// špecifikácie) — potvrdené priamo v oficiálnej Supabase dokumentácii
// aj v ich vlastnom referenčnom kóde:
//   Deno.env.get('SEND_SMS_HOOK_SECRETS').replace('v1,whsec_', '')
//
// Patch 185 odstraňoval len "whsec_" (bez "v1,"), takže by overenie
// podpisu s reálnym Supabase secretom VŽDY zlyhalo a žiadna SMS by sa
// nikdy neposlala. Táto oprava:
//  1) správne odstraňuje "v1,whsec_" prefix,
//  2) navyše podporuje viac secretov oddelených "|" (Supabase to takto
//     odporúča pre rotáciu kľúčov bez výpadku: "v1,whsec_novy|v1,whsec_stary").
//
// Predpoklad: main-app-patches/185-send-sms-hook-smsbrana.js uz je
// aplikovany.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/186-send-sms-hook-secret-fix.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.186-send-sms-hook-secret-fix-lock');
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

if (server.includes("replace(/^v1,whsec_/")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('/api/auth/send-sms-hook')) {
  console.error('❌ Nenašiel som /api/auth/send-sms-hook — over, či je main-app-patches/185 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

const OLD_SIG_CHECK = `    const secretEnv = process.env.SEND_SMS_HOOK_SECRET || '';
    const secretBytes = Buffer.from(secretEnv.replace(/^whsec_/, ''), 'base64');
    const signedContent = webhookId + '.' + webhookTimestamp + '.' + rawBody;
    const expectedSig = crypto.createHmac('sha256', secretBytes).update(signedContent, 'utf8').digest('base64');
    const expectedSigBuf = Buffer.from(expectedSig, 'base64');

    const providedSigs = webhookSignature.split(' ').map(function (s) { return s.split(',')[1]; }).filter(Boolean);
    const validSig = providedSigs.some(function (sig) {
      try {
        const sigBuf = Buffer.from(sig, 'base64');
        return sigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(sigBuf, expectedSigBuf);
      } catch (e) { return false; }
    });`;

const NEW_SIG_CHECK = `    const secretEnv = process.env.SEND_SMS_HOOK_SECRET || '';
    const signedContent = webhookId + '.' + webhookTimestamp + '.' + rawBody;
    const providedSigs = webhookSignature.split(' ').map(function (s) { return s.split(',')[1]; }).filter(Boolean);
    const secretCandidates = secretEnv.split('|').map(function (s) { return s.trim().replace(/^v1,whsec_/, ''); }).filter(Boolean);
    const validSig = secretCandidates.some(function (secretB64) {
      const secretBytes = Buffer.from(secretB64, 'base64');
      const expectedSig = crypto.createHmac('sha256', secretBytes).update(signedContent, 'utf8').digest('base64');
      const expectedSigBuf = Buffer.from(expectedSig, 'base64');
      return providedSigs.some(function (sig) {
        try {
          const sigBuf = Buffer.from(sig, 'base64');
          return sigBuf.length === expectedSigBuf.length && crypto.timingSafeEqual(sigBuf, expectedSigBuf);
        } catch (e) { return false; }
      });
    });`;

server = replaceOnce(server, OLD_SIG_CHECK, NEW_SIG_CHECK, 'oprava odstraňovania "v1,whsec_" prefixu + podpora rotácie cez "|"');

const backup = SERVER_PATH + '.pre-send-sms-hook-secret-fix-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Opravené odstraňovanie "v1," prefixu zo SEND_SMS_HOOK_SECRET — overenie podpisu bude teraz fungovať so skutočným Supabase secretom.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
