// Prerobí /odporucame z natvrdo napísaného HTML (patche 137/138/140) na
// DB-driven verziu — číta z public.affiliate_products (zoskupené podľa
// category_slug), ktorú teraz spravuje admin v dash-service (Odporúčame
// panel, dash-service/patches/03+04). Vyžaduje najprv spustenú
// db/migrate_affiliate_products.sql.
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.141-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('affiliate_products')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, () => newStr);
}

const OLD_ROUTE = `app.get('/odporucame', (req, res) => {
  const l = blogLang(req);
  const isCz = l === 'cs';
  const ODPORUCAME_STYLE = \`<style>
.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.6rem;justify-content:center}
.course-card{display:block;background:var(--black2);border:1px solid var(--border);border-radius:14px;padding:1.3rem;text-decoration:none;color:var(--text)}
.course-card h3{font-family:var(--serif);font-size:1.3rem;margin-bottom:.5rem}
.course-card p{color:var(--text2);font-size:.85rem;margin-bottom:.8rem}
.course-price-tag{font-family:var(--mono);font-size:.8rem;color:var(--volt);font-weight:700}
  </style>\`;
  const ODPORUCAME_BODY = isCz ? \`<div class="page">
  <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><span>Doporučujeme</span></nav>
  <h1 class="hero-title" style="text-align:center">Doporučujeme</h1>
  <p class="hero-sub">Ověřené věci pro uchazeče o vysokou školu — vybíráme jen to, co dává smysl.</p>
  \${ODPORUCAME_STYLE}
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🎒 Školní batohy</h2>
  <div class="course-grid">
    <a class="course-card" href="https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fskolni-batohy%2F" target="_blank" rel="sponsored noopener">
      <h3>🎒 Školní batohy</h3>
      <p>BatohyZavazadla.cz — kvalitní batohy do školy i na vysokou, dost místa na notebook, sešity i láhev.</p>
      <span class="course-price-tag">Podívat se na nabídku →</span>
    </a>
  </div>
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🧳 Batohy na cestování</h2>
  <div class="course-grid">
    <a class="course-card" href="https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fna-cestovani%2F" target="_blank" rel="sponsored noopener">
      <h3>🧳 Batohy na cestování</h3>
      <p>BatohyZavazadla.cz — cestovní batohy a batůžky na výlety i delší cesty.</p>
      <span class="course-price-tag">Podívat se na nabídku →</span>
    </a>
  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na této stránce jsou affiliate — pokud si přes ně něco koupíš, můžeme dostat malou provizi. Tebe to nic navíc nestojí.</p>
</div>\` : \`<div class="page">
  <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><span>Odporúčame</span></nav>
  <h1 class="hero-title" style="text-align:center">Odporúčame</h1>
  <p class="hero-sub">Overené veci pre uchádzačov o vysokú školu — vyberáme len to, čo dáva zmysel.</p>
  \${ODPORUCAME_STYLE}
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🎒 Školské batohy</h2>
  <div class="course-grid">
    <a class="course-card" href="https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fskolni-batohy%2F" target="_blank" rel="sponsored noopener">
      <h3>🎒 Školské batohy</h3>
      <p>BatohyZavazadla.cz — kvalitné batohy na školu aj na vysokú, dosť priestoru na notebook, zošity aj fľašu.</p>
      <span class="course-price-tag">Pozrieť ponuku →</span>
    </a>
  </div>
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🧳 Batohy na cestovanie</h2>
  <div class="course-grid">
    <a class="course-card" href="https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fna-cestovani%2F" target="_blank" rel="sponsored noopener">
      <h3>🧳 Batohy na cestovanie</h3>
      <p>BatohyZavazadla.cz — cestovné batohy a ruksaky na výlety aj dlhšie cesty.</p>
      <span class="course-price-tag">Pozrieť ponuku →</span>
    </a>
  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na tejto stránke sú affiliate — ak si cez ne niečo kúpiš, môžeme dostať malú províziu. Teba to nič naviac nestojí.</p>
</div>\`;
  res.send(blogLayout({
    title: isCz ? 'Doporučujeme — SP Tréner' : 'Odporúčame — SP Tréner',
    description: isCz ? 'Ověřené věci pro uchazeče o vysokou školu — batohy, ubytování a další doporučení.' : 'Overené veci pre uchádzačov o vysokú školu — batohy, ubytovanie a ďalšie odporúčania.',
    body: ODPORUCAME_BODY,
    canonicalPath: '/odporucame',
    lang: l
  }));
});`;

const NEW_ROUTE = `app.get('/odporucame', async (req, res) => {
  const l = blogLang(req);
  const isCz = l === 'cs';
  try {
    const { data: products } = await supabase.from('affiliate_products').select('*').eq('active', true).order('category_slug').order('sort_order');
    const byCategory = [];
    const catIndex = {};
    for (const p of (products || [])) {
      if (!(p.category_slug in catIndex)) {
        catIndex[p.category_slug] = byCategory.length;
        byCategory.push({ title: isCz ? p.category_title_cs : p.category_title_sk, icon: p.icon, items: [] });
      }
      byCategory[catIndex[p.category_slug]].items.push(p);
    }
    const ODPORUCAME_STYLE = \`<style>
.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.6rem;justify-content:center}
.course-card{display:block;background:var(--black2);border:1px solid var(--border);border-radius:14px;padding:1.3rem;text-decoration:none;color:var(--text)}
.course-card h3{font-family:var(--serif);font-size:1.3rem;margin-bottom:.5rem}
.course-card p{color:var(--text2);font-size:.85rem;margin-bottom:.8rem}
.course-price-tag{font-family:var(--mono);font-size:.8rem;color:var(--volt);font-weight:700}
  </style>\`;
    const sections = byCategory.map(cat => \`
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">\${cat.icon} \${escapeHtml(cat.title)}</h2>
  <div class="course-grid">\${cat.items.map(p => \`
    <a class="course-card" href="\${escapeHtml(p.url)}" target="_blank" rel="sponsored noopener">
      <h3>\${p.icon} \${escapeHtml(isCz ? p.title_cs : p.title_sk)}</h3>
      <p>\${escapeHtml(isCz ? p.description_cs : p.description_sk)}</p>
      <span class="course-price-tag">\${escapeHtml(isCz ? p.cta_cs : p.cta_sk)}</span>
    </a>\`).join('')}
  </div>\`).join('');
    const emptyState = isCz ? '<p class="muted">Zatím tu nejsou žádná doporučení.</p>' : '<p class="muted">Zatiaľ tu nie sú žiadne odporúčania.</p>';
    const disclosure = isCz
      ? 'Odkazy na této stránce jsou affiliate — pokud si přes ně něco koupíš, můžeme dostat malou provizi. Tebe to nic navíc nestojí.'
      : 'Odkazy na tejto stránke sú affiliate — ak si cez ne niečo kúpiš, môžeme dostať malú províziu. Teba to nič naviac nestojí.';
    const body = \`<div class="page">
  <nav class="breadcrumb"><a href="/\${isCz ? '?lang=cs' : ''}">SP Tréner</a><span>/</span><span>\${isCz ? 'Doporučujeme' : 'Odporúčame'}</span></nav>
  <h1 class="hero-title" style="text-align:center">\${isCz ? 'Doporučujeme' : 'Odporúčame'}</h1>
  <p class="hero-sub">\${isCz ? 'Ověřené věci pro uchazeče o vysokou školu — vybíráme jen to, co dává smysl.' : 'Overené veci pre uchádzačov o vysokú školu — vyberáme len to, čo dáva zmysel.'}</p>
  \${ODPORUCAME_STYLE}
  \${sections || emptyState}
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">\${disclosure}</p>
</div>\`;
    res.send(blogLayout({
      title: isCz ? 'Doporučujeme — SP Tréner' : 'Odporúčame — SP Tréner',
      description: isCz ? 'Ověřené věci pro uchazeče o vysokou školu — batohy, ubytování a další doporučení.' : 'Overené veci pre uchádzačov o vysokú školu — batohy, ubytovanie a ďalšie odporúčania.',
      body,
      canonicalPath: '/odporucame',
      lang: l
    }));
  } catch (e) {
    console.error('odporucame error:', e.message);
    res.status(500).send('Chyba servera.');
  }
});`;

const patched = replaceOnce(src, OLD_ROUTE, NEW_ROUTE, '/odporucame -> DB-driven');

const backup = FILE + '.pre-odporucame-db-driven-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Over, ze db/migrate_affiliate_products.sql uz bezal.');
