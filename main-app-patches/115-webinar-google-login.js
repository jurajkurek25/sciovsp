// Registrácia na /webinar doteraz bola úplne anonymná (meno+email vo
// formulári, žiadny login) — POST /api/webinar/register od main-app-
// patches/114 už vyžaduje Google prihlásenie (email sa berie z overenej
// Supabase session, nie z tela requestu). Bez tejto zmeny by 114 samotný
// registráciu úplne zablokoval (401 na každý pokus). Vyžaduje, aby 114
// bol už nasadený.
const fs = require('fs');
const FILE = 'public/webinar.html';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('regGoogleBtn')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

// ── 1) HTML: nahraď email input Google-login tlačidlom ──
patched = replaceOnce(patched,
`  <div class="reg-form" id="regForm">
    <label id="tNameLabel">Meno</label>
    <input type="text" id="regName" placeholder="Tvoje meno">
    <label id="tEmailLabel">Email</label>
    <input type="email" id="regEmail" placeholder="tvoj@email.sk">
    <button id="regSubmitBtn"><span id="tRegSubmit">Zaregistrovať sa zadarmo</span></button>
    <div class="err" id="regErr"></div>
  </div>`,
`  <div class="reg-form" id="regForm">
    <label id="tNameLabel">Meno</label>
    <input type="text" id="regName" placeholder="Tvoje meno">
    <button id="regGoogleBtn" style="display:none"><span id="tRegGoogle">Prihlásiť sa cez Google</span></button>
    <button id="regSubmitBtn" style="display:none"><span id="tRegSubmit">Zaregistrovať sa zadarmo</span></button>
    <div class="err" id="regErr"></div>
  </div>`,
  '1: HTML formular');

// ── 2) Supabase klient (stránka doteraz nemala žiadny auth) ──
patched = replaceOnce(patched,
  '<script>\n// Zachytenie partnerského ?ref= presne ako na hlavnej index.html',
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
const SUPABASE_URL = 'https://zrnqiwareacqyndwchsv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybnFpd2FyZWFjcXluZHdjaHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDA3NTAsImV4cCI6MjA4OTc3Njc1MH0.iUne23YDxp12Iwxdk9U8MfcV0NTBtrNf9OgsjQdiADk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

function updateRegFormAuthState() {
  const googleBtn = document.getElementById('regGoogleBtn');
  const submitBtn = document.getElementById('regSubmitBtn');
  if (currentUser) {
    googleBtn.style.display = 'none';
    submitBtn.style.display = 'block';
  } else {
    googleBtn.style.display = 'block';
    submitBtn.style.display = 'none';
  }
}
document.getElementById('regGoogleBtn').onclick = () => {
  _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
};
_supabase.auth.getSession().then(({ data: { session } }) => {
  currentUser = session ? session.user : null;
  updateRegFormAuthState();
});
_supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') { currentUser = session.user; updateRegFormAuthState(); }
  if (event === 'SIGNED_OUT') { currentUser = null; updateRegFormAuthState(); }
});

// Zachytenie partnerského ?ref= presne ako na hlavnej index.html`,
  '2: supabase klient');

// ── 3) submitRegistration: Bearer token namiesto email v tele ──
patched = replaceOnce(patched,
`function submitRegistration(name, email) {
  return fetch('/api/webinar/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name || null, email, slotStartMs: nextSlot.getTime() })
  }).catch(() => {});
}

document.getElementById('regSubmitBtn').onclick = () => {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const errEl = document.getElementById('regErr');
  if (!email || !email.includes('@')) { errEl.textContent = t('emailError'); return; }
  errEl.textContent = '';
  const session = { slotStartMs: nextSlot.getTime(), name: name || null, email };
  localStorage.setItem('sp_webinar_session', JSON.stringify(session));
  // Nepresmerovávame rovno na vysielanie — najprv poďakovanie + potvrdenie
  // opt-inu, nech je jasné, že treba potvrdiť email pred pripomienkami.
  submitRegistration(name, email).finally(() => { location.href = '/webinar/dakujeme'; });
};`,
`function submitRegistration(name, token) {
  return fetch('/api/webinar/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ name: name || null })
  }).catch(() => {});
}

document.getElementById('regSubmitBtn').onclick = async () => {
  if (!currentUser) return;
  const name = document.getElementById('regName').value.trim();
  const errEl = document.getElementById('regErr');
  errEl.textContent = '';
  const session = { slotStartMs: nextSlot.getTime(), name: name || null, email: currentUser.email };
  localStorage.setItem('sp_webinar_session', JSON.stringify(session));
  const { data: { session: authSession } } = await _supabase.auth.getSession();
  const token = authSession ? authSession.access_token : null;
  // Nepresmerovávame rovno na vysielanie — najprv poďakovanie + potvrdenie
  // opt-inu, nech je jasné, že treba potvrdiť email pred pripomienkami.
  submitRegistration(name, token).finally(() => { location.href = '/webinar/dakujeme'; });
};`,
  '3: submitRegistration + click handler');

// ── 4) i18n: regGoogle text SK/CZ ──
patched = replaceOnce(patched,
  `    nameLabel: 'Meno', emailLabel: 'Email', regSubmit: 'Zaregistrovať sa zadarmo', emailError: 'Zadaj platný email.',`,
  `    nameLabel: 'Meno', emailLabel: 'Email', regSubmit: 'Zaregistrovať sa zadarmo', emailError: 'Zadaj platný email.', regGoogle: 'Prihlásiť sa cez Google',`,
  '4: T.sk regGoogle');

patched = replaceOnce(patched,
  `    nameLabel: 'Jméno', emailLabel: 'Email', regSubmit: 'Zaregistrovat se zdarma', emailError: 'Zadej platný email.',`,
  `    nameLabel: 'Jméno', emailLabel: 'Email', regSubmit: 'Zaregistrovat se zdarma', emailError: 'Zadej platný email.', regGoogle: 'Přihlásit se přes Google',`,
  '5: T.cs regGoogle');

// ── 5) setLang(): aplikuj regGoogle text ──
patched = replaceOnce(patched,
  `  document.getElementById('tRegSubmit').textContent = t('regSubmit');`,
  `  document.getElementById('tRegSubmit').textContent = t('regSubmit');
  document.getElementById('tRegGoogle').textContent = t('regGoogle');`,
  '6: setLang regGoogle');

const backup = FILE + '.pre-webinar-google-login-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
