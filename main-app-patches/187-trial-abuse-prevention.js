// Multi-account abuse prevention pre free trial testy — architektúra
// odsúhlasená s uzivatelom: risk-based step-up (nikoho neobťažuj, kým
// nie je dôvod na podozrenie), nie tvrdý blok.
//
// Mechanizmus:
//  1) Pri KAŽDOM /api/trial/check sa pre "čerstvý" účet (trial_count===0,
//     ešte nepoužil telefónne overenie) skontroluje normalizovaný email
//     (Gmail bodky/+tag trik) a device fingerprint (FingerprintJS) proti
//     tabuľke trial_abuse_signals — či niektorý z nich už bol "vyčerpaný"
//     iným účtom.
//  2) Ak áno → namiesto bežných testov zadarmo sa vráti
//     needsPhoneVerification:true, frontend ukáže modal na telefón.
//  3) Po overení SMS kódom (mechanizmus z main-app-patches/185+186) nová
//     routa /api/trial/verify-phone overí Supabase session server-side
//     (NEDÔVERUJE klientovi, len telefónnemu číslu z overeného JWT),
//     skontroluje, či to číslo už niekedy odomklo testy inde, a ak nie,
//     odomkne a označí used.
//  4) Keď účet reálne minie svoje 3 testy, jeho signály (email+fingerprint)
//     sa označia ako "vyčerpané" pre budúce nové účty na tom istom
//     zariadení/emaile.
//
// SQL MIGRÁCIU (spusti v Supabase SQL Editore, JA to spustiť neviem):
//
//   create table if not exists trial_abuse_signals (
//     signal_type text not null check (signal_type in ('device','email_norm','phone')),
//     signal_value text not null,
//     first_email text not null,
//     exhausted_at timestamptz,
//     created_at timestamptz not null default now(),
//     primary key (signal_type, signal_value)
//   );
//   alter table trial_abuse_signals enable row level security;
//
//   alter table users add column if not exists phone_verified boolean not null default false;
//
// Predpoklad: main-app-patches/185 a 186 (SMS hook) uz su aplikovane a
// funkčné, SQL migrácia vyššie uz je spustená v Supabase.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/187-trial-abuse-prevention.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');
const APP_HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

if (!fs.existsSync(SERVER_PATH) || !fs.existsSync(APP_HTML_PATH)) {
  console.error('❌ Nenašiel som server.js alebo public/app.html — spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.187-trial-abuse-prevention-lock');
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

// ═══════════════════════════════════ SERVER.JS ═══════════════════════════════════

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('trial_abuse_signals')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD_TRIAL_CHECK = `app.post('/api/trial/check', rateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Chýba email.' });
  try {
    const { data: user } = await supabase.from('users').select('is_premium, trial_count').eq('email', email).single();
    if (!user) return res.status(404).json({ error: 'Používateľ nenájdený.' });
    if (user.is_premium) return res.json({ allowed: true, isPremium: true, trialCount: user.trial_count });

    const FREE_TESTS = 3;
    if (user.trial_count >= FREE_TESTS) return res.json({ allowed: false, isPremium: false, trialCount: user.trial_count });

    const newCount = user.trial_count + 1;
    await supabase.from('users').update({ trial_count: newCount }).eq('email', email);
    res.json({ allowed: true, isPremium: false, trialCount: newCount });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});`;

const NEW_TRIAL_CHECK = `function normalizeEmailForAbuseCheck(email) {
  const raw = String(email || '').toLowerCase().trim();
  const parts = raw.split('@');
  if (parts.length !== 2) return raw;
  let [local, domain] = parts;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.split('+')[0].replace(/\\./g, '');
    domain = 'gmail.com';
  }
  return local + '@' + domain;
}

app.post('/api/trial/check', rateLimit, async (req, res) => {
  const { email, deviceFingerprint } = req.body;
  if (!email) return res.status(400).json({ error: 'Chýba email.' });
  try {
    const { data: user } = await supabase.from('users').select('is_premium, trial_count, phone_verified').eq('email', email).single();
    if (!user) return res.status(404).json({ error: 'Používateľ nenájdený.' });
    if (user.is_premium) return res.json({ allowed: true, isPremium: true, trialCount: user.trial_count });

    const FREE_TESTS = 3;

    if (!user.phone_verified && user.trial_count === 0) {
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
    }

    if (user.trial_count >= FREE_TESTS) return res.json({ allowed: false, isPremium: false, trialCount: user.trial_count });

    const newCount = user.trial_count + 1;
    await supabase.from('users').update({ trial_count: newCount }).eq('email', email);

    if (newCount >= FREE_TESTS) {
      const marks = [supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() }).eq('signal_type', 'email_norm').eq('signal_value', normalizeEmailForAbuseCheck(email))];
      if (deviceFingerprint) marks.push(supabase.from('trial_abuse_signals').update({ exhausted_at: new Date().toISOString() }).eq('signal_type', 'device').eq('signal_value', String(deviceFingerprint).slice(0, 200)));
      await Promise.all(marks);
    }

    res.json({ allowed: true, isPremium: false, trialCount: newCount });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/trial/verify-phone', rateLimit, async (req, res) => {
  const { email, accessToken } = req.body;
  if (!email || !accessToken) return res.status(400).json({ error: 'Chýba email alebo prístupový token.' });
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser(accessToken);
    if (authErr || !authData || !authData.user || !authData.user.phone) {
      return res.status(401).json({ error: 'Telefón nie je overený.' });
    }
    const phoneNorm = String(authData.user.phone).replace(/[^0-9]/g, '');

    const { data: sig } = await supabase.from('trial_abuse_signals')
      .select('first_email').eq('signal_type', 'phone').eq('signal_value', phoneNorm).maybeSingle();
    if (sig && sig.first_email !== email) {
      return res.json({ unlocked: false, reason: 'phone_already_used' });
    }
    await supabase.from('trial_abuse_signals').upsert(
      { signal_type: 'phone', signal_value: phoneNorm, first_email: email },
      { onConflict: 'signal_type,signal_value', ignoreDuplicates: true }
    );
    await supabase.from('users').update({ phone_verified: true }).eq('email', email);
    res.json({ unlocked: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});`;

server = replaceOnce(server, OLD_TRIAL_CHECK, NEW_TRIAL_CHECK, 'server.js -> /api/trial/check abuse-signal logika + /api/trial/verify-phone');

const serverBackup = SERVER_PATH + '.pre-trial-abuse-prevention-' + Date.now();
fs.copyFileSync(SERVER_PATH, serverBackup);
fs.writeFileSync(SERVER_PATH, server);

// ═══════════════════════════════════ PUBLIC/APP.HTML ═══════════════════════════════════

let appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

if (appHtml.includes('showPhoneVerifyModal')) {
  console.error('❌ public/app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) FingerprintJS CDN script, pred </head>
appHtml = replaceOnce(appHtml,
  `<script src="https://neoworkly.com/widget.js" async></script>

</head>`,
  `<script src="https://neoworkly.com/widget.js" async></script>
<script src="https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@5.2.0/dist/fp.min.js" defer></script>

</head>`,
  'app.html -> FingerprintJS CDN script');

// 2) i18n kľúče -> SK blok
appHtml = replaceOnce(appHtml,
  `    paywallTrialUsed1:'Využil si {n} bezplatný test',paywallTrialUsedN:'Využil si {n} bezplatné testy',`,
  `    paywallTrialUsed1:'Využil si {n} bezplatný test',paywallTrialUsedN:'Využil si {n} bezplatné testy',
    phoneVerifyTitle:'Over si telefónnym číslom',phoneVerifySub:'Vyzerá to, že si túto ponuku už využil(a). Ak si iná osoba, over sa telefónnym číslom a dostaneš svoje testy zadarmo.',
    phoneVerifySendBtn:'Poslať kód →',phoneVerifyCancel:'Zrušiť',phoneVerifyInvalid:'Zadaj platné telefónne číslo vo formáte +421...',
    phoneVerifyCodeTitle:'Zadaj kód',phoneVerifyCodeSub:'Zadaj 6-miestny kód, ktorý sme ti poslali SMS-kou.',phoneVerifyCodeBtn:'Overiť kód',
    phoneVerifyError:'Niečo sa pokazilo, skús to znova.',phoneVerifySuccess:'Overené! Tvoje testy sú odomknuté.',
    phoneVerifyAlreadyUsedTitle:'Číslo už bolo použité',phoneVerifyAlreadyUsed:'Toto telefónne číslo už bolo použité na testy zadarmo. Túto funkciu nemôžeš opakovane využiť.',phoneVerifySeeOptions:'Zobraziť možnosti',`,
  'app.html -> SK i18n kľúče pre telefónne overenie');

// 3) i18n kľúče -> CZ blok
appHtml = replaceOnce(appHtml,
  `    paywallTrialUsed1:'Využil jsi {n} bezplatný test',paywallTrialUsedN:'Využil jsi {n} bezplatné testy',`,
  `    paywallTrialUsed1:'Využil jsi {n} bezplatný test',paywallTrialUsedN:'Využil jsi {n} bezplatné testy',
    phoneVerifyTitle:'Ověř se telefonním číslem',phoneVerifySub:'Vypadá to, že jsi tuto nabídku už využil(a). Pokud jsi jiná osoba, ověř se telefonním číslem a dostaneš své testy zdarma.',
    phoneVerifySendBtn:'Odeslat kód →',phoneVerifyCancel:'Zrušit',phoneVerifyInvalid:'Zadej platné telefonní číslo ve formátu +420...',
    phoneVerifyCodeTitle:'Zadej kód',phoneVerifyCodeSub:'Zadej 6-místný kód, který jsme ti poslali SMS zprávou.',phoneVerifyCodeBtn:'Ověřit kód',
    phoneVerifyError:'Něco se pokazilo, zkus to znovu.',phoneVerifySuccess:'Ověřeno! Tvoje testy jsou odemčené.',
    phoneVerifyAlreadyUsedTitle:'Číslo už bylo použité',phoneVerifyAlreadyUsed:'Toto telefonní číslo už bylo použité na testy zdarma. Tuto funkci nemůžeš opakovaně využít.',phoneVerifySeeOptions:'Zobrazit možnosti',`,
  'app.html -> CZ i18n kľúče pre telefónne overenie');

// 4) requestTrialSlot() -> Promise-based, s vetvou na phone verifikáciu
const OLD_REQUEST_TRIAL = `async function requestTrialSlot(){
  if(isPremium())return true;
  const count=getTrialCount();
  if(!currentUser){
    if(count>=FREE_TESTS_ANON){showToast(t('anonLimitMsg'));showPaywall('anon');return false;}
    incrementTrialCount();return true;
  }
  let blocked=false;
  try{
    const res=await fetch('/api/trial/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,refCode:localStorage.getItem('vsp_pending_ref')||null})});
    const data=await res.json();
    if(data.isPremium){localStorage.setItem('vsp_premium','true');return true;}  // Premium — žiadny paywall
    if(!data.allowed)blocked=true;
  }catch(e){
    if(count>=FREE_TESTS_REGISTERED)blocked=true;
  }
  if(!blocked){incrementTrialCount();return true;}

  // Vyčerpané testy — free registrovaný user si vie pozrieť reklamu (so zvukom) za +1 test, max 3×/deň
  if(typeof offerVideoAdReward==='function'){
    const earned=await offerVideoAdReward();
    if(earned)return true;
  }

  showToast(t('registeredLimitMsg'));showPaywall('registered');return false;
}`;

const NEW_REQUEST_TRIAL = `let pendingTrialResolve=null;
let __cachedFingerprint=null;
async function getDeviceFingerprint(){
  if(__cachedFingerprint)return __cachedFingerprint;
  try{
    const fp=await FingerprintJS.load();
    const result=await fp.get();
    __cachedFingerprint=result.visitorId;
  }catch(e){__cachedFingerprint='';}
  return __cachedFingerprint;
}
function requestTrialSlot(){
  return new Promise(async (resolve)=>{
    if(isPremium())return resolve(true);
    const count=getTrialCount();
    if(!currentUser){
      if(count>=FREE_TESTS_ANON){showToast(t('anonLimitMsg'));showPaywall('anon');return resolve(false);}
      incrementTrialCount();return resolve(true);
    }
    let blocked=false,needsPhone=false;
    try{
      const fp=await getDeviceFingerprint();
      const res=await fetch('/api/trial/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,refCode:localStorage.getItem('vsp_pending_ref')||null,deviceFingerprint:fp})});
      const data=await res.json();
      if(data.isPremium){localStorage.setItem('vsp_premium','true');return resolve(true);}  // Premium — žiadny paywall
      if(data.needsPhoneVerification){needsPhone=true;}
      else if(!data.allowed){blocked=true;}
    }catch(e){
      if(count>=FREE_TESTS_REGISTERED)blocked=true;
    }

    if(needsPhone){
      pendingTrialResolve=resolve;
      showPhoneVerifyModal();
      return;
    }

    if(!blocked){incrementTrialCount();return resolve(true);}

    // Vyčerpané testy — free registrovaný user si vie pozrieť reklamu (so zvukom) za +1 test, max 3×/deň
    if(typeof offerVideoAdReward==='function'){
      const earned=await offerVideoAdReward();
      if(earned)return resolve(true);
    }

    showToast(t('registeredLimitMsg'));showPaywall('registered');resolve(false);
  });
}

// ============================================================
// TELEFÓNNE OVERENIE (anti-multi-account)
// ============================================================
function showPhoneVerifyModal(){
  if(document.getElementById('paywall-overlay'))return;
  const overlay=document.createElement('div');overlay.className='paywall-overlay';overlay.id='paywall-overlay';
  overlay.innerHTML=pvStep1Html();
  document.body.appendChild(overlay);
}
function pvStep1Html(){
  return \`<div class="paywall-box">
    <div class="paywall-icon">📱</div>
    <div class="paywall-title">\${t('phoneVerifyTitle')}</div>
    <div class="paywall-subtitle">\${t('phoneVerifySub')}</div>
    <input type="tel" id="pvPhoneInput" placeholder="+421901234567" style="width:100%;box-sizing:border-box;background:var(--black3);border:1px solid var(--border2);border-radius:10px;padding:.85rem;color:var(--text);font-family:var(--mono);font-size:.9rem;margin-bottom:.75rem;">
    <div id="pvError" style="color:#ff6b6b;font-size:.78rem;margin-bottom:.5rem;"></div>
    <button class="paywall-cta" onclick="pvSendCode()">\${t('phoneVerifySendBtn')}</button>
    <div class="paywall-trial-info" style="cursor:pointer;" onclick="pvCancel()">\${t('phoneVerifyCancel')}</div>
  </div>\`;
}
function pvStep2Html(){
  return \`<div class="paywall-box">
    <div class="paywall-icon">🔑</div>
    <div class="paywall-title">\${t('phoneVerifyCodeTitle')}</div>
    <div class="paywall-subtitle">\${t('phoneVerifyCodeSub')}</div>
    <input type="text" inputmode="numeric" id="pvCodeInput" maxlength="6" placeholder="123456" style="width:100%;box-sizing:border-box;text-align:center;letter-spacing:.3em;font-size:1.3rem;background:var(--black3);border:1px solid var(--border2);border-radius:10px;padding:.85rem;color:var(--text);font-family:var(--mono);margin-bottom:.75rem;">
    <div id="pvError" style="color:#ff6b6b;font-size:.78rem;margin-bottom:.5rem;"></div>
    <button class="paywall-cta" onclick="pvVerifyCode()">\${t('phoneVerifyCodeBtn')}</button>
  </div>\`;
}
function pvCancel(){
  const overlay=document.getElementById('paywall-overlay');if(overlay)overlay.remove();
  if(pendingTrialResolve){const r=pendingTrialResolve;pendingTrialResolve=null;r(false);}
}
async function pvSendCode(){
  const input=document.getElementById('pvPhoneInput');
  const phone=input.value.trim();
  const errEl=document.getElementById('pvError');
  if(!/^\\+[0-9]{8,15}$/.test(phone)){errEl.textContent=t('phoneVerifyInvalid');return;}
  const btn=document.querySelector('#paywall-overlay .paywall-cta');
  if(btn){btn.disabled=true;btn.textContent='...';}
  const {error}=await _supabase.auth.signInWithOtp({phone});
  if(error){errEl.textContent=error.message;if(btn){btn.disabled=false;btn.textContent=t('phoneVerifySendBtn');}return;}
  window.__pvPhone=phone;
  const box=document.querySelector('#paywall-overlay .paywall-box');
  if(box)box.outerHTML=pvStep2Html();
}
async function pvVerifyCode(){
  const code=document.getElementById('pvCodeInput').value.trim();
  const errEl=document.getElementById('pvError');
  const btn=document.querySelector('#paywall-overlay .paywall-cta');
  if(btn){btn.disabled=true;btn.textContent='...';}
  const {data,error}=await _supabase.auth.verifyOtp({phone:window.__pvPhone,token:code,type:'sms'});
  if(error||!data||!data.session){errEl.textContent=t('phoneVerifyError');if(btn){btn.disabled=false;btn.textContent=t('phoneVerifyCodeBtn');}return;}
  try{
    const res=await fetch('/api/trial/verify-phone',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:currentUser.email,accessToken:data.session.access_token})});
    const result=await res.json();
    const overlay=document.getElementById('paywall-overlay');
    if(result.unlocked){
      if(overlay)overlay.remove();
      showToast(t('phoneVerifySuccess'));
      if(pendingTrialResolve){const r=pendingTrialResolve;pendingTrialResolve=null;incrementTrialCount();r(true);}
    } else {
      const box=document.querySelector('#paywall-overlay .paywall-box');
      if(box)box.innerHTML=\`<div class="paywall-icon">🚫</div><div class="paywall-title">\${t('phoneVerifyAlreadyUsedTitle')}</div><div class="paywall-subtitle">\${t('phoneVerifyAlreadyUsed')}</div><button class="paywall-cta" onclick="document.getElementById('paywall-overlay').remove();showPaywall('registered')">\${t('phoneVerifySeeOptions')}</button>\`;
      if(pendingTrialResolve){const r=pendingTrialResolve;pendingTrialResolve=null;r(false);}
    }
  }catch(e){errEl.textContent=t('phoneVerifyError');if(btn){btn.disabled=false;btn.textContent=t('phoneVerifyCodeBtn');}}
}`;

appHtml = replaceOnce(appHtml, OLD_REQUEST_TRIAL, NEW_REQUEST_TRIAL, 'app.html -> requestTrialSlot() prerobenie + phone verify modal');

const appHtmlBackup = APP_HTML_PATH + '.pre-trial-abuse-prevention-' + Date.now();
fs.copyFileSync(APP_HTML_PATH, appHtmlBackup);
fs.writeFileSync(APP_HTML_PATH, appHtml);

console.log('✅ Multi-account abuse prevention hotová (server.js + app.html).');
console.log('   Zálohy:', serverBackup, '|', appHtmlBackup);
console.log('');
console.log('   PRIPOMIENKA: over, či si už spustil SQL migráciu v Supabase (je v komentári na začiatku tohto súboru).');
console.log('   Over syntax server.js pred reštartom: node -c server.js');
