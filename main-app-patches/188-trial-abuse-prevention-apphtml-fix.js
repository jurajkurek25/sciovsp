// main-app-patches/187 zlyhal na app.html kroku (kotva pred </head>
// počítala s prázdnym riadkom, produkcia mala riadok s dvomi medzerami
// "  " namiesto prázdneho) — server.js sa MEDZITÝM UŽ ÚSPEŠNE aplikoval
// a zapísal, takže tento patch sa dotýka LEN public/app.html, server.js
// necháva presne tak, ako je.
//
// Rovnaký obsah ako app.html časť patchu 187, len opravená prvá kotva.
//
// Predpoklad: main-app-patches/187 bol spustený a server.js časť
// prebehla (over: grep -c "trial_abuse_signals" server.js -> 1+),
// ale public/app.html JEŠTE NEOBSAHUJE "showPhoneVerifyModal".
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/188-trial-abuse-prevention-apphtml-fix.js

const fs = require('fs');
const path = require('path');

const APP_HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

if (!fs.existsSync(APP_HTML_PATH)) {
  console.error('❌ Nenašiel som public/app.html — spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.188-trial-abuse-prevention-apphtml-fix-lock');
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

let appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

if (appHtml.includes('showPhoneVerifyModal')) {
  console.error('❌ public/app.html: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// 1) FingerprintJS CDN script, hneď za neoworkly skriptom — kotva NEZÁVISÍ
// od okolitého whitespace (predchádzajúci pokus zlyhal presne na tomto:
// dokonca aj samotný Write nástroj potichu orezáva trailing whitespace
// v reťazcoch, takže spoliehať sa na presný whitespace okolo </head> je krehké).
appHtml = replaceOnce(appHtml,
  `<script src="https://neoworkly.com/widget.js" async></script>`,
  `<script src="https://neoworkly.com/widget.js" async></script>
<script src="https://cdn.jsdelivr.net/npm/@fingerprintjs/fingerprintjs@5.2.0/dist/fp.min.js" defer></script>`,
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

const appHtmlBackup = APP_HTML_PATH + '.pre-trial-abuse-prevention-fix-' + Date.now();
fs.copyFileSync(APP_HTML_PATH, appHtmlBackup);
fs.writeFileSync(APP_HTML_PATH, appHtml);

console.log('✅ public/app.html doplnený (FingerprintJS + i18n + phone verify modal). server.js nebol menený (už bol hotový z patchu 187).');
console.log('   Záloha:', appHtmlBackup);
console.log('   app.html je statický súbor — pm2 restart naň netreba, stačí hard-refresh v prehliadači.');
