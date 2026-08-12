// Presúva video URL a skript "živého" chatu z /webinar/live.html (viditeľné
// vo View Source) na server — stránka si ich teraz vyžiada cez fetch()
// namiesto toho, aby boli natvrdo v HTML. Video URL je čitateľná aj v sieťovej
// prevádzke (Network tab), ale to je v poriadku — cieľom je len to, aby
// nebola v statickom zdroji stránky. Musí byť registrovaná PRED SPA fallback
// (rovnaká chyba ako predtým pri confirm/unsubscribe — pozri patch 91).
const fs = require('fs');
const FILE = 'server.js';
const src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/api/webinar/live-data')) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

const SPA_MARKER = `// ── SPA fallback (všetky ostatné routes → index) ─────────────
app.get('*', (req, res) => {`;
const spaCount = src.split(SPA_MARKER).length - 1;
if (spaCount !== 1) { console.error('SPA fallback kotva nie je jednoznacna (najdenych: ' + spaCount + '). Nic som nezmenil.'); process.exit(1); }

const NEW_ROUTE = `app.get('/api/webinar/live-data', (req, res) => {
  res.json({
    videoUrl: process.env.WEBINAR_VIDEO_URL || 'https://videos.jurajkurek.com/webinar.mp4',
    chatScript: [
      { t: 15, name: 'Peťo', text: 'Ahoj všetci! 👋' },
      { t: 40, name: 'Zuzka K.', text: 'Konečne som stihla, ideme na to!' },
      { t: 90, name: 'Martin S.', text: 'Toto ma fakt zaujíma, syn ide budúci rok na prijímačky' },
      { t: 180, name: 'Ivana', text: 'Super, presne som toto potrebovala' },
      { t: 310, name: 'Tomáš', text: 'Počkať, appka to vie sama vygenerovať? 🤯' },
      { t: 420, name: 'Katka B.', text: 'My sme skúšali klasické knihy a nulový posun' },
      { t: 560, name: 'Robo', text: 'Toto dáva zmysel, konečne niekto vysvetľuje prečo' },
      { t: 700, name: 'Simona', text: 'Koľko otázok tam reálne je?' },
      { t: 850, name: 'Filip', text: 'Presne toto mi na iných prípravách chýbalo' },
      { t: 1000, name: 'Lucia', text: 'Toto so spätnou väzbou znie skvele' },
      { t: 1150, name: 'Dominik', text: 'A funguje to aj na právo?' },
      { t: 1300, name: 'Nikola', text: 'Konečne AI, ktorá pomáha namiesto strašenia 😄' },
      { t: 1450, name: 'Peter K.', text: 'Toto by som potreboval už minulý rok' },
      { t: 1600, name: 'Zuzana M.', text: 'Kde sa dá appka vyskúšať?' },
      { t: 1750, name: 'Adam', text: 'Toto vyzerá fakt profesionálne' },
      { t: 1900, name: 'Miroslava', text: 'Idem sa pozrieť na tú ponuku po webinári 👀' },
      { t: 2050, name: 'Jakub', text: 'Práve som si pozrel tú zľavu, oplatí sa!' },
      { t: 2200, name: 'Veronika', text: 'Vďaka za skvelý webinár!' },
      { t: 2350, name: 'Štefan', text: 'Kúpil som Premium, teším sa 🎉' },
      { t: 2500, name: 'Alžbeta', text: 'Toto rozhodne odporúčam všetkým, čo idú na prijímačky' }
    ],
    replyNames: ['Peťo', 'Zuzka K.', 'Martin S.', 'Ivana', 'Tomáš', 'Robo', 'Filip', 'Adam'],
    replyTexts: ['👍', 'presne tak!', 'aj ja si to myslím', 'super otázka', 'to isté som chcel/a napísať 😄'],
    endScreen: {
      sk: { title: 'Vysielanie sa skončilo', body: 'Ak si to stihol/a, čaká na teba špeciálna ponuka len pre účastníkov.', ctaText: 'Zobraziť ponuku →', ctaHref: '/ponuka' },
      cs: { title: 'Vysílání skončilo', body: 'Pokud jsi to stihl/a, čeká na tebe speciální nabídka jen pro účastníky.', ctaText: 'Zobrazit nabídku →', ctaHref: '/ponuka' }
    }
  });
});
` + SPA_MARKER;

const patched = src.replace(SPA_MARKER, NEW_ROUTE);

const backup = FILE + '.pre-webinar-live-data-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('GET /api/webinar/live-data pridany pred SPA fallback.');
