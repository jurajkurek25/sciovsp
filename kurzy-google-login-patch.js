const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('kurz-detail.js')) {
  console.error('Uz je aplikovane (najdene kurz-detail.js), nic som nezmenil.');
  process.exit(1);
}

const OLD = `      <div class="course-buy-box">
        <span class="course-price-tag">\${priceStr} €</span>
        <button class="course-buy-btn" data-slug="\${course.slug}" onclick="buyCourse(this)">Kúpiť kurz</button>
      </div>
    </main>
    <script>
    async function buyCourse(btn) {
      const email = prompt('Email, na ktorý si vytvoríš/máš účet SP Tréner:');
      if (!email) return;
      btn.disabled = true; btn.textContent = 'Chvíľu strpenia…';
      try {
        const res = await fetch('/api/courses/' + btn.dataset.slug + '/checkout', {
          method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.url) location.href = data.url;
        else { alert(data.error || 'Chyba pri vytváraní platby.'); btn.disabled = false; btn.textContent = 'Kúpiť kurz'; }
      } catch (e) { alert('Chyba servera.'); btn.disabled = false; btn.textContent = 'Kúpiť kurz'; }
    }
    </script>\`;`;

if (!src.includes(OLD)) {
  console.error('Nenasiel som presny buy-box blok. Nic som nezmenil.');
  process.exit(1);
}

const NEW = `      <div class="course-buy-box">
        <span class="course-price-tag">\${priceStr} €</span>
        <div id="courseAuthSlot"><span style="color:var(--text3);font-size:.85rem">Načítavam…</span></div>
      </div>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/kurz-detail.js" data-slug="\${course.slug}"></script>\`;`;

const patched = src.replace(OLD, NEW);
const backup = FILE + '.pre-kurzy-google-login-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
