(function () {
  const SUPABASE_URL = 'https://zrnqiwareacqyndwchsv.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybnFpd2FyZWFjcXluZHdjaHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDA3NTAsImV4cCI6MjA4OTc3Njc1MH0.iUne23YDxp12Iwxdk9U8MfcV0NTBtrNf9OgsjQdiADk';
  const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const scriptEl = document.currentScript;
  const slug = scriptEl.dataset.slug;
  const gSvg = '<svg width="15" height="15" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>';
  let currentUser = null;
  let purchased = false;

  function isFreeCourse() {
    const slot = document.querySelector('.courseAuthSlot');
    return !!slot && slot.dataset.free === '1';
  }

  function render() {
    const slots = document.querySelectorAll('.courseAuthSlot');
    if (!slots.length) return;
    const buyLabel = isFreeCourse() ? 'Získať zadarmo' : 'Kúpiť kurz';
    slots.forEach(slot => {
      if (currentUser && purchased) {
        slot.innerHTML = '<a class="course-buy-btn" style="display:inline-block;text-decoration:none;text-align:center" href="/kurzy/' + slug + '/watch">Pokračovať →</a>';
      } else if (currentUser) {
        const email = currentUser.email;
        const short = email.length > 22 ? email.substring(0, 20) + '...' : email;
        slot.innerHTML = '<div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">'
          + '<span style="font-family:var(--mono);font-size:.78rem;color:var(--text3)">' + short + '</span>'
          + '<button class="course-buy-btn js-buy-btn">' + buyLabel + '</button>'
          + '</div>';
      } else {
        slot.innerHTML = '<button class="course-buy-btn js-google-btn" style="display:inline-flex;align-items:center;gap:.5rem;background:var(--black2);border:1px solid var(--border2);color:var(--text)">'
          + gSvg + ' Prihlásiť sa cez Google</button>';
      }
    });
    document.querySelectorAll('.js-buy-btn').forEach(btn => btn.onclick = buyCourse);
    document.querySelectorAll('.js-google-btn').forEach(btn => btn.onclick = () => {
      _supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    });
  }

  async function checkPurchased(token) {
    try {
      const res = await fetch('/api/courses/' + slug + '/access', { headers: { Authorization: 'Bearer ' + token } });
      purchased = res.ok;
    } catch (e) {
      purchased = false;
    }
  }

  async function buyCourse() {
    const buyBtns = document.querySelectorAll('.js-buy-btn');
    const free = isFreeCourse();
    buyBtns.forEach(b => { b.disabled = true; b.textContent = free ? 'Získavam prístup…' : 'Chvíľu strpenia…'; });
    try {
      const res = await fetch('/api/courses/' + slug + '/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      const data = await res.json();
      if (data.url) {
        location.href = data.url;
      } else {
        alert(data.error || 'Chyba pri vytváraní platby.');
        buyBtns.forEach(b => { b.disabled = false; b.textContent = free ? 'Získať zadarmo' : 'Kúpiť kurz'; });
      }
    } catch (e) {
      alert('Chyba servera.');
      buyBtns.forEach(b => { b.disabled = false; b.textContent = free ? 'Získať zadarmo' : 'Kúpiť kurz'; });
    }
  }

  async function init() {
    const { data: { session } } = await _supabase.auth.getSession();
    currentUser = session ? session.user : null;
    if (currentUser) await checkPurchased(session.access_token);
    render();
    _supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        currentUser = session.user;
        await checkPurchased(session.access_token);
        render();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        purchased = false;
        render();
      }
    });
  }

  init();
})();
