// Nova prax: ked uz registrovany pouzivatel minul svoje 3 testy zadarmo
// (a nevyuzil/odmietol video-ad bonus), moze namiesto toho jednym
// kliknutim suhlasit s odberom "odporucania a ponuky partnerov" na email
// (ak este nesuhlasil) a dostane +1 test zadarmo. VYNUTENE LEN RAZ ZA
// UCET NAVZDY cez samostatny flag marketing_bonus_test_claimed -- NIE
// cez aktualnu hodnotu marketing_emails_opt_out, takze opakovane
// prihlasovanie/odhlasovanie sa z odberu nemoze bonus znova spustit.
//
// SQL MIGRACIU (uz pripravena v db/migrate_marketing_bonus_test.sql,
// JA ju spustit neviem):
//   alter table users add column if not exists marketing_bonus_test_claimed boolean not null default false;
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/259-marketing-bonus-test.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const APP_HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

for (const p of [SERVER_PATH, APP_HTML_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.259-marketing-bonus-test-lock');
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

// ═══════════════════════ server.js ═══════════════════════
let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('marketing_bonus_test_claimed')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const S_OLD1 = `    const { data: user } = await supabase.from('users').select('is_premium, trial_count, phone_verified').eq('email', email).single();`;
const S_NEW1 = `    const { data: user } = await supabase.from('users').select('is_premium, trial_count, phone_verified, marketing_bonus_test_claimed').eq('email', email).single();`;

if (!server.includes(S_OLD1)) {
  console.error('❌ Nenašiel som presnú kotvu (select is_premium, trial_count, phone_verified). Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server, S_OLD1, S_NEW1, 'server.js: select marketing_bonus_test_claimed');

const S_OLD2 = `    if (user.trial_count >= FREE_TESTS) return res.json({ allowed: false, isPremium: false, trialCount: user.trial_count });`;
const S_NEW2 = `    if (user.trial_count >= FREE_TESTS) return res.json({ allowed: false, isPremium: false, trialCount: user.trial_count, marketingBonusAvailable: !user.marketing_bonus_test_claimed });`;

if (!server.includes(S_OLD2)) {
  console.error('❌ Nenašiel som presnú kotvu (trial_count >= FREE_TESTS response). Nič som nezmenil.');
  process.exit(1);
}
server = replaceOnce(server, S_OLD2, S_NEW2, 'server.js: marketingBonusAvailable v odpovedi');

// Nová routa -- vlož hneď za /api/trial/verify-phone (nájdi jej koniec cez
// nasledujúcu app.post, rovnaký vzor ako predošlé patche v tomto súbore).
const S_ANCHOR = `app.post('/api/trial/verify-phone', rateLimit, async (req, res) => {`;
if (!server.includes(S_ANCHOR)) {
  console.error('❌ Nenašiel som kotvu /api/trial/verify-phone. Nič som nezmenil.');
  process.exit(1);
}
const NEW_ROUTE = `app.post('/api/trial/claim-marketing-bonus', rateLimit, async (req, res) => {
  const user = await verifySupabaseToken(req);
  if (!user) return res.status(401).json({ error: 'Nie si prihlásený.' });
  const email = (user.email || '').toString().trim().toLowerCase();
  try {
    const { data: dbUser } = await supabase.from('users').select('marketing_bonus_test_claimed, trial_count').eq('email', email).maybeSingle();
    if (!dbUser) return res.status(404).json({ error: 'Používateľ nenájdený.' });
    if (dbUser.marketing_bonus_test_claimed) {
      return res.status(400).json({ granted: false, error: 'Bonusový test za súhlas s marketingom si už využil/a.' });
    }
    const newTrialCount = Math.max(0, (dbUser.trial_count || 0) - 1);
    await supabase.from('users').update({
      marketing_emails_opt_out: false,
      marketing_bonus_test_claimed: true,
      trial_count: newTrialCount
    }).eq('email', email);
    res.json({ granted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

` + S_ANCHOR;

server = replaceOnce(server, S_ANCHOR, NEW_ROUTE, 'server.js: nová routa /api/trial/claim-marketing-bonus');

// ═══════════════════════ public/app.html ═══════════════════════
let appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

if (appHtml.includes('offerMarketingBonusTest')) {
  console.error('❌ app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const A_OLD1 = `    let blocked=false,needsPhone=false;
    try{
      const fp=await getDeviceFingerprint();
      const res=await fetch('/api/trial/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,refCode:localStorage.getItem('vsp_pending_ref')||null,deviceFingerprint:fp})});
      const data=await res.json();
      if(data.isPremium){localStorage.setItem('vsp_premium','true');return resolve(true);}  // Premium — žiadny paywall
      if(data.needsPhoneVerification){needsPhone=true;}
      else if(!data.allowed){blocked=true;}
    }catch(e){
      if(count>=FREE_TESTS_REGISTERED)blocked=true;
    }`;
const A_NEW1 = `    let blocked=false,needsPhone=false,marketingBonusAvailable=false;
    try{
      const fp=await getDeviceFingerprint();
      const res=await fetch('/api/trial/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,refCode:localStorage.getItem('vsp_pending_ref')||null,deviceFingerprint:fp})});
      const data=await res.json();
      if(data.isPremium){localStorage.setItem('vsp_premium','true');return resolve(true);}  // Premium — žiadny paywall
      if(data.needsPhoneVerification){needsPhone=true;}
      else if(!data.allowed){blocked=true;marketingBonusAvailable=!!data.marketingBonusAvailable;}
    }catch(e){
      if(count>=FREE_TESTS_REGISTERED)blocked=true;
    }`;

if (!appHtml.includes(A_OLD1)) {
  console.error('❌ Nenašiel som presnú kotvu (requestTrialSlot() try/catch blok). Nič som nezmenil.');
  process.exit(1);
}
appHtml = replaceOnce(appHtml, A_OLD1, A_NEW1, 'app.html: marketingBonusAvailable capture');

const A_OLD2 = `    // Vyčerpané testy — free registrovaný user si vie pozrieť reklamu (so zvukom) za +1 test, max 3×/deň
    if(typeof offerVideoAdReward==='function'){
      const earned=await offerVideoAdReward();
      if(earned)return resolve(true);
    }

    showToast(t('registeredLimitMsg'));showPaywall('registered');resolve(false);`;
const A_NEW2 = `    // Vyčerpané testy — free registrovaný user si vie pozrieť reklamu (so zvukom) za +1 test, max 3×/deň
    if(typeof offerVideoAdReward==='function'){
      const earned=await offerVideoAdReward();
      if(earned)return resolve(true);
    }

    // Alternatíva -- +1 test zadarmo za súhlas s marketingom partnerov (len raz za účet navždy)
    if(marketingBonusAvailable && typeof offerMarketingBonusTest==='function'){
      const earned=await offerMarketingBonusTest();
      if(earned)return resolve(true);
    }

    showToast(t('registeredLimitMsg'));showPaywall('registered');resolve(false);`;

if (!appHtml.includes(A_OLD2)) {
  console.error('❌ Nenašiel som presnú kotvu (video-ad reward blok v requestTrialSlot()). Nič som nezmenil.');
  process.exit(1);
}
appHtml = replaceOnce(appHtml, A_OLD2, A_NEW2, 'app.html: ponuka marketing bonusu v requestTrialSlot()');

const A_OLD3 = `async function offerVideoAdReward(){`;
const A_NEW3 = `async function offerMarketingBonusTest(){
  if (!currentUser) return false;
  return await new Promise(resolve => {
    const overlay = rewardOverlayEl();
    overlay.innerHTML = \`
      <div class="reward-overlay">
        <div class="reward-modal">
          <div class="reward-modal-icon">📬</div>
          <div class="reward-modal-title">Vyčerpal si testy</div>
          <div class="reward-modal-sub">Potvrď súhlas s odberom odporúčaní a ponúk partnerov na email a získaš <strong style="color:var(--volt)">+1 test zadarmo</strong>. Toto môžeš využiť len raz, kedykoľvek sa dá z odberu odhlásiť.</div>
          <div class="reward-modal-actions">
            <button class="reward-btn primary" id="marketingBonusAcceptBtn">✓ Súhlasím a získať test</button>
            <button class="reward-btn ghost" id="marketingBonusDeclineBtn">Nie, ďakujem</button>
          </div>
        </div>
      </div>\`;
    document.getElementById('marketingBonusDeclineBtn').onclick = () => { closeRewardOverlay(); resolve(false); };
    document.getElementById('marketingBonusAcceptBtn').onclick = async () => {
      const btn = document.getElementById('marketingBonusAcceptBtn');
      if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
      try {
        const headers = await getAuthHeader();
        const res = await fetch('/api/trial/claim-marketing-bonus', { method: 'POST', headers });
        const data = await res.json();
        closeRewardOverlay();
        resolve(!!data.granted);
      } catch (e) {
        closeRewardOverlay();
        resolve(false);
      }
    };
  });
}

async function offerVideoAdReward(){`;

if (!appHtml.includes(A_OLD3)) {
  console.error('❌ Nenašiel som presnú kotvu (async function offerVideoAdReward()). Nič som nezmenil.');
  process.exit(1);
}
appHtml = replaceOnce(appHtml, A_OLD3, A_NEW3, 'app.html: pridanie offerMarketingBonusTest()');

const now = Date.now();
fs.copyFileSync(SERVER_PATH, SERVER_PATH + '.pre-259-' + now);
fs.copyFileSync(APP_HTML_PATH, APP_HTML_PATH + '.pre-259-' + now);
fs.writeFileSync(SERVER_PATH, server);
fs.writeFileSync(APP_HTML_PATH, appHtml);

console.log('✅ Bonus test za marketingový súhlas hotový (server.js + app.html).');
console.log('   POZOR: predpokladá spustenú SQL migráciu db/migrate_marketing_bonus_test.sql v Supabase.');
console.log('   Over syntax pred reštartom: node -c server.js');
console.log('   pm2 restart sptrener-main (app.html je statický, stačí tvrdý refresh, ale server.js treba reštart)');
