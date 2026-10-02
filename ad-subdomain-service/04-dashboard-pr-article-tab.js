// Pridáva tretiu tab-u "PR článok" do dashboard.html: viackrokový wizard
// (formulár → AI otázky → odpovede → platba → spracovanie → publikované),
// plus novú cenovú kartu v aside (249€ jednorazovo).
//
// Presný textový match proti overenému živému súboru dashboard.html.
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/04-dashboard-pr-article-tab.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'dashboard.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('productPrArticle')) {
  console.error('❌ Vyzerá to, že PR článok tab už existuje. Nič som nezmenil.');
  process.exit(1);
}

const OLD_TABS = `        <div class="tabs" style="margin:0;flex:1">
          <div class="tab active" id="tabBanners" onclick="switchTab('banners')">Bannery</div>
          <div class="tab" id="tabVideos" onclick="switchTab('videos')">Video reklamy</div>
        </div>`;

const NEW_TABS = `        <div class="tabs" style="margin:0;flex:1">
          <div class="tab active" id="tabBanners" onclick="switchTab('banners')">Bannery</div>
          <div class="tab" id="tabVideos" onclick="switchTab('videos')">Video reklamy</div>
          <div class="tab" id="tabPrArticle" onclick="switchTab('prarticle')">PR článok</div>
        </div>`;

const OLD_VIDEOS_BLOCK_END = `        <div class="card"><h3>Moje video reklamy</h3><div id="videoList"></div></div>
      </div>
    </div>
  </div>

  <aside>`;

const NEW_VIDEOS_BLOCK_END = `        <div class="card"><h3>Moje video reklamy</h3><div id="videoList"></div></div>
      </div>

      <div class="hidden" id="productPrArticle">
        <div id="prArticleContent"></div>
      </div>
    </div>
  </div>

  <aside>`;

const OLD_ASIDE_END = `      <div class="side-note">Podrobný cenník a argumenty, prečo tu inzerovať, nájdeš na <a href="/">hlavnej stránke</a>.</div>
    </div>
  </aside>`;

const NEW_ASIDE_END = `      <div class="side-note">Podrobný cenník a argumenty, prečo tu inzerovať, nájdeš na <a href="/">hlavnej stránke</a>.</div>
    </div>
    <div class="card" style="margin-top:1.1rem">
      <div class="price-compact">
        <span style="font-family:var(--serif);font-size:1.15rem">PR článok</span>
        <span><span class="price-num" style="color:var(--purple2)">249€</span> <span class="price-period">jednorazovo</span></span>
      </div>
      <div class="feat-list">
        <span>AI napíše bilingválny (SK+CZ) článok na mieru</span>
        <span>Trvalý SEO odkaz na blogu — nie rotujúci slot</span>
        <span>Automatická kontrola obsahu pred publikovaním</span>
      </div>
    </div>
  </aside>`;

const OLD_SWITCH_TAB = `function switchTab(tab){
  document.getElementById('tabBanners').classList.toggle('active', tab==='banners');
  document.getElementById('tabVideos').classList.toggle('active', tab==='videos');
  document.getElementById('productBanners').classList.toggle('hidden', tab!=='banners');
  document.getElementById('productVideos').classList.toggle('hidden', tab!=='videos');
}`;

const NEW_SWITCH_TAB = `function switchTab(tab){
  document.getElementById('tabBanners').classList.toggle('active', tab==='banners');
  document.getElementById('tabVideos').classList.toggle('active', tab==='videos');
  document.getElementById('tabPrArticle').classList.toggle('active', tab==='prarticle');
  document.getElementById('productBanners').classList.toggle('hidden', tab!=='banners');
  document.getElementById('productVideos').classList.toggle('hidden', tab!=='videos');
  document.getElementById('productPrArticle').classList.toggle('hidden', tab!=='prarticle');
}`;

const OLD_ENTER_DASHBOARD = `  loadBanners(); loadVideoAds();`;
const NEW_ENTER_DASHBOARD = `  loadBanners(); loadVideoAds(); loadPrArticle();`;

const OLD_TAIL = `if (localStorage.getItem('adsToken')) enterDashboard();`;

const PR_ARTICLE_JS = `
// ─── PR článok (jednorazová platba, AI interview + auto-publikovanie) ───

let currentPrArticle = null;
let prPollTimer = null;

function prArticleFormHtml(){
  return \`<div class="card">
    <h3>Nový PR článok</h3>
    <p style="font-size:.8rem;color:var(--text3);margin-bottom:.9rem">Napíš pár viet o produkte — AI sa ťa potom opýta doplňujúce otázky, aby vedela napísať konkrétny, užitočný článok (nie generickú reklamu). Po zaplatení sa článok automaticky vygeneruje, skontroluje a vypublikuje na blog.sptrener.online.</p>
    <div id="prArticleFormMsg"></div>
    <form id="prArticleForm" onsubmit="return submitPrArticleForm(event)">
      <div class="field"><label>Názov firmy/produktu</label><input type="text" id="prCompanyName" required></div>
      <div class="field"><label>Čo produkt robí</label><input type="text" id="prProductInfo" required></div>
      <div class="field"><label>Prečo sa to hodí študentom</label><input type="text" id="prStudentBenefit" required></div>
      <div class="field"><label>Aký výsledok z toho majú študenti</label><input type="text" id="prStudentOutcome" required></div>
      <div class="field"><label>Prečo sa to hodí na náš blog</label><input type="text" id="prBlogFit" required></div>
      <div class="field"><label>Cieľová URL</label><input type="url" id="prTargetUrl" placeholder="https://..." required></div>
      <button class="btn" type="submit" id="prArticleFormBtn">Odoslať a vygenerovať otázky →</button>
    </form>
  </div>\`;
}

function prArticleQuestionsHtml(pr){
  const qs = pr.questions || [];
  return \`<div class="card">
    <h3>Doplňujúce otázky od AI</h3>
    <p style="font-size:.8rem;color:var(--text3);margin-bottom:.9rem">Odpovede použije AI na napísanie konkrétneho článku — čím konkrétnejšie odpovieš, tým lepší výsledok.</p>
    <div id="prAnswersMsg"></div>
    <form id="prAnswersForm" onsubmit="return submitPrArticleAnswers(event, \${pr.id})">
      \${qs.map((q,i) => \`<div class="field"><label>\${q}</label><input type="text" id="prAnswer\${i}" required></div>\`).join('')}
      <button class="btn" type="submit" id="prAnswersBtn">Odoslať odpovede →</button>
    </form>
  </div>\`;
}

function prArticleAnsweredHtml(pr){
  return \`<div class="card">
    <h3>Pripravené na publikovanie</h3>
    <p style="font-size:.8rem;color:var(--text3);margin-bottom:1rem">Po zaplatení AI automaticky vygeneruje bilingválny (SK+CZ) článok, skontroluje ho a vypublikuje na blog. Zvyčajne to trvá do minúty.</p>
    <div class="price-compact"><span style="font-family:var(--serif);font-size:1.15rem">PR článok</span><span><span class="price-num" style="color:var(--purple2)">249€</span> <span class="price-period">jednorazovo</span></span></div>
    <div id="prCheckoutMsg"></div>
    <button class="btn" onclick="startPrArticleCheckout(\${pr.id})">Zaplatiť 249€ a publikovať →</button>
  </div>\`;
}

function prArticleProcessingHtml(){
  return \`<div class="card">
    <h3>Spracúva sa…</h3>
    <p style="font-size:.85rem;color:var(--text2)">Platba prebehla úspešne. AI teraz píše a kontroluje tvoj článok — zvyčajne to trvá do minúty. Táto stránka sa sama obnoví.</p>
  </div>\`;
}

function prArticlePublishedHtml(pr){
  return \`<div class="card">
    <h3>Článok je live! 🎉</h3>
    <p style="font-size:.85rem;color:var(--text2);margin-bottom:1rem">Tvoj PR článok bol automaticky vygenerovaný, skontrolovaný a vypublikovaný.</p>
    <a class="btn" href="\${pr.blogUrl}" target="_blank" style="margin-bottom:.75rem;text-decoration:none;display:block;text-align:center">Pozrieť článok →</a>
    <button class="btn secondary" onclick="resetPrArticleForm()">Vytvoriť ďalší PR článok</button>
  </div>\`;
}

function prArticleFailedHtml(pr){
  return \`<div class="card">
    <h3>Niečo sa nepodarilo</h3>
    <p style="font-size:.85rem;color:var(--text2);margin-bottom:.75rem">Automatické vygenerovanie/publikovanie článku zlyhalo.\${pr.failReason ? ' Dôvod: ' + pr.failReason : ''}</p>
    <p style="font-size:.8rem;color:var(--text3);margin-bottom:1rem">Ak si za tento článok už zaplatil, ozveme sa ti emailom s riešením (oprava a ručné publikovanie, alebo vrátenie platby).</p>
    <button class="btn secondary" onclick="resetPrArticleForm()">Skúsiť nový PR článok</button>
  </div>\`;
}

function resetPrArticleForm(){
  currentPrArticle = null;
  document.getElementById('prArticleContent').innerHTML = prArticleFormHtml();
}

function renderPrArticle(){
  const el = document.getElementById('prArticleContent');
  if (!el) return;
  const pr = currentPrArticle;
  if (!pr) { el.innerHTML = prArticleFormHtml(); return; }
  if (pr.status === 'questions_ready') { el.innerHTML = prArticleQuestionsHtml(pr); return; }
  if (pr.status === 'answered') { el.innerHTML = prArticleAnsweredHtml(pr); return; }
  if (pr.status === 'paid' || pr.status === 'generating') { el.innerHTML = prArticleProcessingHtml(); startPrArticlePolling(); return; }
  if (pr.status === 'published') { el.innerHTML = prArticlePublishedHtml(pr); return; }
  if (pr.status === 'failed') { el.innerHTML = prArticleFailedHtml(pr); return; }
  el.innerHTML = prArticleFormHtml();
}

async function loadPrArticle(){
  try {
    const data = await api('/api/pr-articles/mine');
    currentPrArticle = (data.prArticles && data.prArticles[0]) || null;
    renderPrArticle();
  } catch(e) { renderPrArticle(); }
}

function startPrArticlePolling(){
  if (prPollTimer) return;
  prPollTimer = setInterval(async () => {
    await loadPrArticle();
    if (!currentPrArticle || (currentPrArticle.status !== 'paid' && currentPrArticle.status !== 'generating')) {
      clearInterval(prPollTimer); prPollTimer = null;
    }
  }, 5000);
}

async function submitPrArticleForm(e){
  e.preventDefault();
  const btn = document.getElementById('prArticleFormBtn');
  btn.disabled = true; btn.textContent = 'Generujem otázky…';
  try {
    const data = await api('/api/pr-articles', { method:'POST', body: JSON.stringify({
      companyName: prCompanyName.value, productInfo: prProductInfo.value, studentBenefit: prStudentBenefit.value,
      studentOutcome: prStudentOutcome.value, blogFit: prBlogFit.value, targetUrl: prTargetUrl.value
    })});
    currentPrArticle = data.prArticle;
    renderPrArticle();
  } catch(err) { showMsg('prArticleFormMsg', err.message, 'error'); btn.disabled = false; btn.textContent = 'Odoslať a vygenerovať otázky →'; }
  return false;
}

async function submitPrArticleAnswers(e, id){
  e.preventDefault();
  const btn = document.getElementById('prAnswersBtn');
  btn.disabled = true; btn.textContent = 'Odosielam…';
  const qs = (currentPrArticle && currentPrArticle.questions) || [];
  const answers = qs.map((_,i) => document.getElementById('prAnswer'+i).value);
  try {
    const data = await api(\`/api/pr-articles/\${id}/answers\`, { method:'POST', body: JSON.stringify({ answers }) });
    currentPrArticle = data.prArticle;
    renderPrArticle();
  } catch(err) { showMsg('prAnswersMsg', err.message, 'error'); btn.disabled = false; btn.textContent = 'Odoslať odpovede →'; }
  return false;
}

async function startPrArticleCheckout(id){
  try { const d = await api(\`/api/pr-articles/\${id}/checkout\`, {method:'POST'}); location.href = d.url; }
  catch(err){ showMsg('prCheckoutMsg', err.message, 'error'); }
}

if (localStorage.getItem('adsToken')) enterDashboard();`;

for (const [name, needle] of [['tabs', OLD_TABS], ['videos block end', OLD_VIDEOS_BLOCK_END], ['aside end', OLD_ASIDE_END], ['switchTab', OLD_SWITCH_TAB], ['enterDashboard loaders', OLD_ENTER_DASHBOARD], ['tail', OLD_TAIL]]) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v dashboard.html. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-pr-article-tab-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_TABS, NEW_TABS);
out = out.replace(OLD_VIDEOS_BLOCK_END, NEW_VIDEOS_BLOCK_END);
out = out.replace(OLD_ASIDE_END, NEW_ASIDE_END);
out = out.replace(OLD_SWITCH_TAB, NEW_SWITCH_TAB);
out = out.replace(OLD_ENTER_DASHBOARD, NEW_ENTER_DASHBOARD);
out = out.replace(OLD_TAIL, PR_ARTICLE_JS);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ "PR článok" tab pridaný do dashboard.html (formulár → AI otázky → odpovede → platba → publikované).');
console.log('   Záloha pôvodného dashboard.html:', backupPath);
