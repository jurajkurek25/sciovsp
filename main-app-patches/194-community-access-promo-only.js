// Oprava medzery z main-app-patches/118: komunitu doteraz dostal KAŽDÝ,
// kto kúpil cez /ponuka (webinárovú cestu), aj keď mu okno akciovej ceny
// už vypršalo a zaplatil plnú (classic) cenu -- webhook sa pozeral len na
// viaWebinar==='1', nie na to, či skutočne "stihol" akciové okno.
//
// pricingMode do Stripe metadata sa ukladá už od main-app-patches/114
// (server-side, klient si ho nemôže vynútiť) -- 'promo' len vtedy, keď
// getWebinarOfferStatus(email).state === 'active' v momente checkoutu.
// Tento patch pridáva presne túto podmienku aj do udeľovania komunity:
// komunitu dostanú výhradne tí, čo kúpili cez webinár A v aktívnom okne
// (promo cena) -- presne "tí, čo to stihli".
//
// VYŽADUJE: main-app-patches/118-community-backend-wiring.js už nasadený
// (tento patch stavia presne na jeho výstupnom texte).
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.194-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iny beh tohto patchu prave prebieha alebo neuprataný LOCK zo zlyhaneho behu (' + LOCK + ' existuje). Nic som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

const src = fs.readFileSync(FILE, 'utf8');

if (src.includes("session.metadata?.viaWebinar === '1' && session.metadata?.pricingMode === 'promo'")) {
  console.error('Uz je aplikovane, nic som nezmenil.');
  process.exit(1);
}

function replaceOnce(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) { console.error(label + ' kotva nie je jednoznacna (najdenych: ' + count + '). Nic som nezmenil.'); process.exit(1); }
  return s.replace(oldStr, newStr);
}

let patched = src;

patched = replaceOnce(patched,
`          // Komunita je bonus VÝHRADNE pre webinárovú cestu — kvízová
          // (/kam-na-vysoku) ani bežné mesačné predplatné ju nedostanú.
          // Viazaná na túto konkrétnu platbu — vyprší spolu s ňou.
          if (session.metadata?.viaWebinar === '1') {
            membershipUpsert.community_access_until = membershipExpiresAt.toISOString();
          }`,
`          // Komunita je bonus VÝHRADNE pre webinárovú cestu A LEN pre tých,
          // čo kúpili v aktívnom okne akciovej ceny (pricingMode==='promo',
          // nastavené server-side pri checkoute podľa getWebinarOfferStatus)
          // — kto to nestihol a zaplatil plnú (classic) cenu, komunitu
          // nedostane. Kvízová cesta (/kam-na-vysoku) ani bežné mesačné
          // predplatné ju nedostanú vôbec. Viazaná na túto konkrétnu
          // platbu — vyprší spolu s ňou.
          if (session.metadata?.viaWebinar === '1' && session.metadata?.pricingMode === 'promo') {
            membershipUpsert.community_access_until = membershipExpiresAt.toISOString();
          }`,
  '1: community_access_until len pre promo (stihli)');

const backup = FILE + '.pre-community-access-promo-only-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, patched);
console.log('OK - zaloha:', backup);
console.log('Komunita sa teraz udeli LEN pri viaWebinar=1 AND pricingMode=promo (t.j. tym, co stihli akciove okno).');
