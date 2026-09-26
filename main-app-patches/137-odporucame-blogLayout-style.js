// Prerobí GET /odporucame (patch 135, dovtedy statický public/odporucame.html)
// na server-renderovanú stránku cez rovnakú blogLayout() šablónu ako /blog
// a /kurzy — rovnaký nav, breadcrumb, .page layout aj .course-card mriežka
// (znovupoužité rovnaké CSS triedy, sú page-scoped v <style> vnútri body).
// Vyžaduje main-app-patches/136 (navActive + Odporúčame odkaz v blogLayout()).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.137-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK subor (' + LOCK + ') existuje. Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('ODPORUCAME_BODY')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

const OLD_ROUTE = `app.get('/odporucame', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'odporucame.html'));
});`;

const NEW_ROUTE = `app.get('/odporucame', (req, res) => {
  const ODPORUCAME_BODY = \`<div class="page">
  <nav class="breadcrumb"><a href="/">SP Tréner</a><span>/</span><span>Odporúčame</span></nav>
  <h1 class="hero-title">Odporúčame</h1>
  <p class="hero-sub">Overené veci pre uchádzačov o vysokú školu — vyberáme len to, čo dáva zmysel.</p>
  <style>
.course-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.1rem;margin-top:1.6rem;justify-content:center}
.course-card{display:block;background:var(--black2);border:1px solid var(--border);border-radius:14px;padding:1.3rem;text-decoration:none;color:var(--text)}
.course-card h3{font-family:var(--serif);font-size:1.3rem;margin-bottom:.5rem}
.course-card p{color:var(--text2);font-size:.85rem;margin-bottom:.8rem}
.course-price-tag{font-family:var(--mono);font-size:.8rem;color:var(--volt);font-weight:700}
  </style>
  <h2 style="font-family:var(--serif);font-size:1.4rem;margin-top:2rem;margin-bottom:.5rem">🎒 Školské batohy</h2>
  <div class="course-grid">
    <a class="course-card" href="https://ehub.cz/system/scripts/click.php?a_aid=fee628bb&a_bid=ffcffc9b&desturl=https%3A%2F%2Fwww.batohyzavazadla.cz%2Fskolni-batohy%2F" target="_blank" rel="sponsored noopener">
      <h3>🎒 Školské batohy</h3>
      <p>BatohyZavazadla.cz — kvalitné batohy na školu aj na vysokú, dosť priestoru na notebook, zošity aj fľašu.</p>
      <span class="course-price-tag">Pozrieť ponuku →</span>
    </a>
  </div>
  <p style="margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.72rem;color:var(--text3)">Odkazy na tejto stránke sú affiliate — ak si cez ne niečo kúpiš, môžeme dostať malú províziu. Teba to nič naviac nestojí.</p>
</div>\`;
  res.send(blogLayout({
    title: 'Odporúčame — SP Tréner',
    description: 'Overené veci pre uchádzačov o vysokú školu — batohy, ubytovanie a ďalšie odporúčania.',
    body: ODPORUCAME_BODY,
    canonicalPath: '/odporucame',
    lang: 'sk'
  }));
});`;

const patched = replaceOnce(src, OLD_ROUTE, NEW_ROUTE, '/odporucame route -> blogLayout');

const backup = FILE + '.pre-odporucame-blogLayout-style-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('public/odporucame.html uz nie je pouzivany (mozes ho zmazat, ale nie je to nutne).');
