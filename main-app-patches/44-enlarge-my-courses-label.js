const fs = require('fs');
const FILE = 'public/app.html';
const src = fs.readFileSync(FILE, 'utf8');

const OLD = `mcRoot.innerHTML=\`<div style="font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin:1.5rem 0 .8rem;">🎓 Moje kurzy</div>
        <div class="mode-grid">
          <a class="mode-card" href="/kurzy"><span class="card-icon">🎓</span><div class="card-title">Zatiaľ nemáš žiadny kurz</div><div class="card-desc">Pozri si ponuku video kurzov →</div></a>
        </div>\`;
      return;
    }
    mcRoot.innerHTML=\`<div style="font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin:1.5rem 0 .8rem;">🎓 Moje kurzy</div>`;
const NEW = `mcRoot.innerHTML=\`<div style="font-family:var(--serif);font-size:1.4rem;color:var(--text);margin:1.8rem 0 .9rem;">🎓 Moje kurzy</div>
        <div class="mode-grid">
          <a class="mode-card" href="/kurzy"><span class="card-icon">🎓</span><div class="card-title">Zatiaľ nemáš žiadny kurz</div><div class="card-desc">Pozri si ponuku video kurzov →</div></a>
        </div>\`;
      return;
    }
    mcRoot.innerHTML=\`<div style="font-family:var(--serif);font-size:1.4rem;color:var(--text);margin:1.8rem 0 .9rem;">🎓 Moje kurzy</div>`;

if (src.includes(NEW)) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}
if (!src.includes(OLD)) { console.error('Nenasiel som kotvu pre nadpis Moje kurzy. Nic som nezmenil.'); process.exit(1); }

const patched = src.replace(OLD, NEW);

const backup = FILE + '.pre-enlarge-my-courses-label-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
