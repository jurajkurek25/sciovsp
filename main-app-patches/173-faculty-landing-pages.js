// Vygeneruje SEO landing stranku pre KAZDU fakultu z UNI_DB (36 univerzit,
// SK+CZ, ~150 fakult) na jednej zdielanej sablone /skola/:univerzita/:fakulta
// (rovnaky princip ako blogLayout() pre blog posty — jeden sablonovy
// engine, ziadne rucne pisanie 150 stranok).
//
// Kazda stranka ma kratky "sedi mi tento odbor?" mini-test — reuzuje
// PRESNE tie iste vyroky, ktore uz pouziva hlavny kviz na kam-na-vysoku
// (3 vyroky na kazdy tag danej fakulty), takze ziaden novy obsah sa
// nevymysla, len sa znovu-pouziva uz overeny kviz engine v mensom meradle.
//
// Pridava aj /skola (adresar vsetkych univerzit/fakult, kvoli
// crawlovatelnosti) a rozsiruje sitemap.xml o vsetky nove URL.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/173-faculty-landing-pages.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.173-faculty-landing-pages-lock');
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

let server = fs.readFileSync(SERVER_PATH, 'utf8');

if (server.includes('FACULTY_INDEX')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) data + routy, pred /blog/:slug ═══════════════════════
const NEW_BLOCK = `
// ============================================================
// FACULTY LANDING PAGES (/skola/:univerzita/:fakulta) — jedna sablona
// pre vsetky fakulty z UNI_DB, s mini-testom "sedi mi tento odbor?"
// znovu-pouzivajucim vyroky z hlavneho kam-na-vysoku kvizu.
// ============================================================
function slugify(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const UNI_DB = [
  {n:'Univerzita Komenského v Bratislave',c:'SK',city:'Bratislava',f:[
    {n:'Právnická fakulta',t:['law']},{n:'Lekárska fakulta',t:['medicina']},{n:'Farmaceutická fakulta',t:['medicina']},
    {n:'Prírodovedecká fakulta',t:['technika']},{n:'Fakulta matematiky, fyziky a informatiky',t:['technika']},
    {n:'Filozofická fakulta',t:['humanitne']},{n:'Pedagogická fakulta',t:['pedagogika']},{n:'Fakulta managementu',t:['ekonomia']},
    {n:'Fakulta sociálnych a ekonomických vied',t:['vsp','ekonomia']}
  ]},
  {n:'Slovenská technická univerzita v Bratislave',c:'SK',city:'Bratislava',f:[
    {n:'Fakulta informatiky a informačných technológií',t:['technika']},{n:'Fakulta elektrotechniky a informatiky',t:['technika']},
    {n:'Strojnícka fakulta',t:['technika']},{n:'Stavebná fakulta',t:['technika']},{n:'Fakulta architektúry a dizajnu',t:['umenie']}
  ]},
  {n:'Ekonomická univerzita v Bratislave',c:'SK',city:'Bratislava',f:[
    {n:'Národohospodárska fakulta',t:['ekonomia']},{n:'Fakulta podnikového manažmentu',t:['ekonomia']}
  ]},
  {n:'Univerzita Pavla Jozefa Šafárika',c:'SK',city:'Košice',f:[
    {n:'Lekárska fakulta',t:['medicina']},{n:'Právnická fakulta',t:['law']},{n:'Prírodovedecká fakulta',t:['technika']},{n:'Filozofická fakulta',t:['humanitne']},
    {n:'Fakulta verejnej správy',t:['vsp']}
  ]},
  {n:'Technická univerzita v Košiciach',c:'SK',city:'Košice',f:[
    {n:'Fakulta elektrotechniky a informatiky',t:['technika']},{n:'Strojnícka fakulta',t:['technika']},{n:'Stavebná fakulta',t:['technika']}
  ]},
  {n:'Univerzita veterinárskeho lekárstva a farmácie',c:'SK',city:'Košice',f:[{n:'Veterinárska fakulta',t:['medicina']}]},
  {n:'Žilinská univerzita v Žiline',c:'SK',city:'Žilina',f:[
    {n:'Strojnícka fakulta',t:['technika']},{n:'Elektrotechnická fakulta',t:['technika']},{n:'Stavebná fakulta',t:['technika']},
    {n:'Fakulta prevádzky a ekonomiky dopravy a spojov',t:['ekonomia']}
  ]},
  {n:'Univerzita Mateja Bela',c:'SK',city:'Banská Bystrica',f:[
    {n:'Právnická fakulta',t:['law']},{n:'Ekonomická fakulta',t:['ekonomia']},{n:'Pedagogická fakulta',t:['pedagogika']},{n:'Filozofická fakulta',t:['humanitne']}
  ]},
  {n:'Univerzita Konštantína Filozofa',c:'SK',city:'Nitra',f:[
    {n:'Pedagogická fakulta',t:['pedagogika']},{n:'Filozofická fakulta',t:['humanitne']},{n:'Fakulta prírodných vied a informatiky',t:['technika']}
  ]},
  {n:'Slovenská poľnohospodárska univerzita',c:'SK',city:'Nitra',f:[
    {n:'Fakulta biotechnológie a potravinárstva',t:['medicina']},{n:'Technická fakulta',t:['technika']},{n:'Fakulta ekonomiky a manažmentu',t:['ekonomia']}
  ]},
  {n:'Trnavská univerzita',c:'SK',city:'Trnava',f:[
    {n:'Právnická fakulta',t:['law']},{n:'Pedagogická fakulta',t:['pedagogika']},{n:'Filozofická fakulta',t:['humanitne']}
  ]},
  {n:'Univerzita sv. Cyrila a Metoda',c:'SK',city:'Trnava',f:[
    {n:'Filozofická fakulta (psychológia)',t:['psych']},{n:'Fakulta masmediálnej komunikácie',t:['vsp','humanitne']},{n:'Fakulta sociálnych vied',t:['vsp','humanitne']}
  ]},
  {n:'Katolícka univerzita',c:'SK',city:'Ružomberok',f:[{n:'Pedagogická fakulta',t:['pedagogika']},{n:'Filozofická fakulta',t:['humanitne']}]},
  {n:'Prešovská univerzita',c:'SK',city:'Prešov',f:[
    {n:'Pedagogická fakulta',t:['pedagogika']},{n:'Filozofická fakulta',t:['humanitne']},{n:'Fakulta zdravotníckych odborov',t:['medicina']}
  ]},
  {n:'Akadémia umení',c:'SK',city:'Banská Bystrica',f:[{n:'Umelecké odbory',t:['umenie']}]},
  {n:'Vysoká škola múzických umení',c:'SK',city:'Bratislava',f:[{n:'Umelecké odbory',t:['umenie']}]},
  {n:'Vysoká škola výtvarných umení',c:'SK',city:'Bratislava',f:[{n:'Umelecké odbory',t:['umenie']}]},
  {n:'Technická univerzita vo Zvolene',c:'SK',city:'Zvolen',f:[{n:'Drevárska fakulta',t:['technika']},{n:'Lesnícka fakulta',t:['technika']}]},
  {n:'Trenčianska univerzita Alexandra Dubčeka',c:'SK',city:'Trenčín',f:[
    {n:'Fakulta priemyselných technológií (Púchov)',t:['technika']},{n:'Fakulta sociálno-ekonomických vzťahov',t:['ekonomia']},
    {n:'Fakulta špeciálnej techniky',t:['technika']},{n:'Fakulta zdravotníctva',t:['medicina']}
  ]},
  {n:'Slovenská zdravotnícka univerzita',c:'SK',city:'Bratislava',f:[{n:'Zdravotnícke odbory',t:['medicina']}]},
  {n:'Univerzita Karlova',c:'CZ',city:'Praha',f:[
    {n:'Právnická fakulta',t:['law']},{n:'1. lékařská fakulta',t:['medicina']},{n:'Farmaceutická fakulta',t:['medicina']},
    {n:'Filozofická fakulta',t:['humanitne']},{n:'Přírodovědecká fakulta',t:['technika']},{n:'Matematicko-fyzikální fakulta',t:['technika']},
    {n:'Pedagogická fakulta',t:['pedagogika']},{n:'Fakulta sociálních věd',t:['vsp','ekonomia']}
  ]},
  {n:'České vysoké učení technické',c:'CZ',city:'Praha',f:[
    {n:'Fakulta informačních technologií',t:['technika']},{n:'Fakulta elektrotechnická',t:['technika']},
    {n:'Fakulta strojní',t:['technika']},{n:'Fakulta stavební',t:['technika']}
  ]},
  {n:'Vysoká škola ekonomická',c:'CZ',city:'Praha',f:[{n:'Ekonomické obory',t:['ekonomia']}]},
  {n:'Masarykova univerzita',c:'CZ',city:'Brno',f:[
    {n:'Právnická fakulta',t:['law']},{n:'Lékařská fakulta',t:['medicina']},{n:'Přírodovědecká fakulta',t:['technika']},
    {n:'Filozofická fakulta',t:['humanitne']},{n:'Pedagogická fakulta',t:['pedagogika']},{n:'Fakulta sociálních studií',t:['vsp','humanitne']}
  ]},
  {n:'Vysoké učení technické',c:'CZ',city:'Brno',f:[
    {n:'Fakulta informačních technologií',t:['technika']},{n:'Fakulta strojního inženýrství',t:['technika']},
    {n:'Fakulta elektrotechniky a komunikačních technologií',t:['technika']},{n:'Fakulta architektury',t:['umenie']}
  ]},
  {n:'Univerzita Palackého',c:'CZ',city:'Olomouc',f:[
    {n:'Lékařská fakulta',t:['medicina']},{n:'Právnická fakulta',t:['law']},{n:'Pedagogická fakulta',t:['pedagogika']},
    {n:'Filozofická fakulta',t:['humanitne']},{n:'Přírodovědecká fakulta',t:['technika']}
  ]},
  {n:'Ostravská univerzita',c:'CZ',city:'Ostrava',f:[
    {n:'Lékařská fakulta',t:['medicina']},{n:'Pedagogická fakulta',t:['pedagogika']},{n:'Filozofická fakulta',t:['humanitne']}
  ]},
  {n:'Vysoká škola báňská – Technická univerzita',c:'CZ',city:'Ostrava',f:[{n:'Technické obory',t:['technika']}]},
  {n:'Jihočeská univerzita',c:'CZ',city:'České Budějovice',f:[
    {n:'Pedagogická fakulta',t:['pedagogika']},{n:'Zdravotně sociální fakulta',t:['medicina']},{n:'Přírodovědecká fakulta',t:['technika']}
  ]},
  {n:'Univerzita Pardubice',c:'CZ',city:'Pardubice',f:[
    {n:'Fakulta chemicko-technologická',t:['technika']},{n:'Dopravní fakulta Jana Pernera',t:['technika']}
  ]},
  {n:'Technická univerzita v Liberci',c:'CZ',city:'Liberec',f:[{n:'Technické obory',t:['technika']}]},
  {n:'Univerzita Hradec Králové',c:'CZ',city:'Hradec Králové',f:[{n:'Pedagogická fakulta',t:['pedagogika']}]},
  {n:'Západočeská univerzita',c:'CZ',city:'Plzeň',f:[
    {n:'Fakulta právnická',t:['law']},{n:'Fakulta elektrotechnická',t:['technika']},{n:'Fakulta strojní',t:['technika']}
  ]},
  {n:'Mendelova univerzita',c:'CZ',city:'Brno',f:[
    {n:'Provozně ekonomická fakulta',t:['ekonomia']},{n:'Agronomická fakulta',t:['technika']}
  ]},
  {n:'Veterinární univerzita Brno',c:'CZ',city:'Brno',f:[{n:'Veterinární obory',t:['medicina']}]},
  {n:'Akademie múzických umění',c:'CZ',city:'Praha',f:[{n:'Umělecké obory',t:['umenie']}]},
  {n:'Vysoká škola uměleckoprůmyslová',c:'CZ',city:'Praha',f:[{n:'Umělecké obory',t:['umenie']}]},
  {n:'Akademie výtvarných umění',c:'CZ',city:'Praha',f:[{n:'Umělecké obory',t:['umenie']}]},
  {n:'Slezská univerzita v Opavě',c:'CZ',city:'Opava',f:[
    {n:'Filozoficko-přírodovědecká fakulta',t:['humanitne','technika']},{n:'Obchodně podnikatelská fakulta (Karviná)',t:['ekonomia']},
    {n:'Fakulta veřejných politik',t:['vsp']}
  ]}
];

const QUIZ_STATEMENTS = {
  vsp: [
    {sk:'Rád/rada sleduješ správy, politiku a dianie vo svete.',cs:'Rád/a sleduješ zprávy, politiku a dění ve světě.'},
    {sk:'Baví ťa uvažovať nad všeobecnými súvislosťami viac než sa hneď vrhnúť do jednej úzkej témy.',cs:'Baví tě přemýšlet nad obecnými souvislostmi víc, než se hned vrhnout do jedné úzké oblasti.'},
    {sk:'Rád/rada by si vedel/a viac o tom, ako funguje štát, verejná správa alebo medzinárodná politika.',cs:'Rád/a bys věděl/a víc o tom, jak funguje stát, veřejná správa nebo mezinárodní politika.'}
  ],
  psych: [
    {sk:'Zaujíma ťa, prečo sa ľudia správajú presne tak, ako sa správajú.',cs:'Zajímá tě, proč se lidé chovají přesně tak, jak se chovají.'},
    {sk:'Kamaráti sa ti často zdôveria a ty ich rád/rada vypočuješ a poradíš.',cs:'Kamarádi se ti často svěřují a ty je rád/a vyslechneš a poradíš.'},
    {sk:'Všímaš si, keď sa niekto v skupine cíti trápne alebo vylúčene — a chceš to napraviť.',cs:'Všímáš si, když se někdo ve skupině cítí trapně nebo vyloučeně — a chceš to napravit.'}
  ],
  law: [
    {sk:'Baví ťa argumentovať a obhajovať svoj názor aj v ostrej diskusii.',cs:'Baví tě argumentovat a obhajovat svůj názor i v ostré diskusi.'},
    {sk:'Vadí ti nespravodlivosť a chcel/chcela by si vedieť brániť pravidlá a práva iných.',cs:'Vadí ti nespravedlnost a chtěl/a bys umět bránit pravidla a práva druhých.'},
    {sk:'Čítaš zmluvy, pravidlá hier alebo predpisy dôkladnejšie než väčšina ľudí okolo teba.',cs:'Čteš smlouvy, pravidla her nebo předpisy důkladněji než většina lidí kolem tebe.'}
  ],
  medicina: [
    {sk:'Zaujíma ťa, ako presne funguje ľudské (alebo zvieracie) telo.',cs:'Zajímá tě, jak přesně funguje lidské (nebo zvířecí) tělo.'},
    {sk:'Dokázal/dokázala by si zvládnuť nepríjemný pohľad (napr. krv), ak by si tým niekomu pomohol/pomohla.',cs:'Zvládl/a bys nepříjemný pohled (např. krev), pokud by to někomu pomohlo.'},
    {sk:'Baví ťa starať sa o niekoho, keď je chorý alebo zranený.',cs:'Baví tě starat se o někoho, když je nemocný nebo zraněný.'}
  ],
  technika: [
    {sk:'Rád/rada riešiš logické hádanky, matematické úlohy alebo programovanie.',cs:'Rád/a řešíš logické hádanky, matematické úlohy nebo programování.'},
    {sk:'Zaujíma ťa, ako veci fungujú zvnútra — stroje, softvér, technológie.',cs:'Zajímá tě, jak věci fungují zevnitř — stroje, software, technologie.'},
    {sk:'Keď sa ti niečo pokazí (počítač, bicykel...), skôr sa to pokúsiš opraviť sám/sama, než to hneď niesť niekomu inému.',cs:'Když se ti něco pokazí (počítač, kolo...), spíš se to pokusíš opravit sám/sama, než to hned nést někomu jinému.'}
  ],
  pedagogika: [
    {sk:'Baví ťa niekomu niečo trpezlivo vysvetľovať, kým to nepochopí.',cs:'Baví tě někomu něco trpělivě vysvětlovat, dokud to nepochopí.'},
    {sk:'Vieš si predstaviť, že by si každý deň pracoval/a s deťmi alebo mládežou.',cs:'Umíš si představit, že bys každý den pracoval/a s dětmi nebo mládeží.'},
    {sk:'Ako dieťa si rád/rada "hral/a na učiteľa" alebo organizoval/a hry pre mladších.',cs:'Jako dítě sis rád/a "hrál/a na učitele" nebo organizoval/a hry pro mladší.'}
  ],
  ekonomia: [
    {sk:'Zaujíma ťa, ako fungujú peniaze, firmy a trh.',cs:'Zajímá tě, jak fungují peníze, firmy a trh.'},
    {sk:'Rád/rada by si viedol/viedla tím, projekt alebo vlastný biznis.',cs:'Rád/a bys vedl/a tým, projekt nebo vlastní byznys.'},
    {sk:'Sleduješ akcie, kryptomeny, startupy alebo biznis novinky aspoň občas z vlastného záujmu.',cs:'Sleduješ akcie, kryptoměny, startupy nebo byznys novinky aspoň občas z vlastního zájmu.'}
  ],
  humanitne: [
    {sk:'Baví ťa čítať, písať alebo učiť sa cudzie jazyky.',cs:'Baví tě číst, psát nebo učit se cizí jazyky.'},
    {sk:'Zaujíma ťa história, filozofia alebo to, prečo spoločnosti a kultúry fungujú tak, ako fungujú.',cs:'Zajímá tě historie, filozofie nebo to, proč společnosti a kultury fungují tak, jak fungují.'},
    {sk:'Vieš stráviť hodiny čítaním knihy alebo skúmaním témy, ktorá ťa jednoducho zaujala.',cs:'Umíš strávit hodiny čtením knihy nebo zkoumáním tématu, které tě jednoduše zaujalo.'}
  ],
  umenie: [
    {sk:'Rád/rada tvoríš — kresliš, fotíš, píšeš, hráš hudbu alebo niečo navrhuješ.',cs:'Rád/a tvoříš — kreslíš, fotíš, píšeš, hraješ hudbu nebo něco navrhuješ.'},
    {sk:'Všímaš si dizajn, farby a estetiku vecí okolo seba viac než väčšina ľudí.',cs:'Všímáš si designu, barev a estetiky věcí kolem sebe víc než většina lidí.'},
    {sk:'Aj keď ťa nikto nepožiadal, občas si niečo nakreslíš, nafotíš alebo vytvoríš len tak, pre seba.',cs:'I když tě nikdo nepožádal, občas si něco nakreslíš, nafotíš nebo vytvoříš jen tak, pro sebe.'}
  ]
};

const FIELD_LABELS = {
  sk: {vsp:'Všeobecné študijné predpoklady',psych:'Psychológia',law:'Právo',medicina:'Medicína',technika:'Technika a IT',pedagogika:'Pedagogika',ekonomia:'Ekonómia',humanitne:'Humanitné vedy',umenie:'Umenie'},
  cs: {vsp:'Všeobecné studijní předpoklady',psych:'Psychologie',law:'Právo',medicina:'Medicína',technika:'Technika a IT',pedagogika:'Pedagogika',ekonomia:'Ekonomie',humanitne:'Humanitní vědy',umenie:'Umění'}
};

const FACULTY_INDEX = {};
const FACULTY_LIST = [];
UNI_DB.forEach(function(uni) {
  const uSlug = slugify(uni.n);
  uni.f.forEach(function(fac) {
    const fSlug = slugify(fac.n);
    const rec = { university: uni.n, faculty: fac.n, city: uni.city, country: uni.c, tags: fac.t, uSlug: uSlug, fSlug: fSlug };
    FACULTY_INDEX[uSlug + '/' + fSlug] = rec;
    FACULTY_LIST.push(rec);
  });
});

function facultyQuizWidget(lang, statements) {
  const isCs = lang === 'cs';
  const total = statements.length;
  const qHtml = statements.map(function(s, i) {
    return '<div class="fq-q"><p>' + escapeHtml(s[lang]) + '</p><div class="fq-scale" data-q="' + i + '">'
      + '<button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button><button type="button" data-v="5">5</button>'
      + '</div></div>';
  }).join('');
  const verdictHigh = isCs ? 'Vypadá to, že by ti to mohlo sedět!' : 'Vyzerá to, že by ti to mohlo sedieť!';
  const verdictMid = isCs ? 'Částečná shoda — stojí za to prozkoumat i jiné obory.' : 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.';
  const verdictLow = isCs ? 'Asi to není přesně pro tebe — zkus si udělat i plný test.' : 'Asi to nie je presne pre teba — skús si spraviť aj plný test.';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';
  const quizSub = isCs ? 'Odpověz na pár otázek a zjisti to za minutu — zdarma.' : 'Odpovedz na pár otázok a zisti to za minútu — zadarmo.';
  const submitLabel = isCs ? 'Zjistit shodu →' : 'Zistiť zhodu →';
  const ctaLabel = isCs ? 'Udělat plný test zdarma →' : 'Spraviť plný test zadarma →';
  const ctaHref = '/kam-na-vysoku' + (isCs ? '?lang=cs' : '');

  return '<div class="faculty-quiz">'
    + '<h2>' + quizHeading + '</h2>'
    + '<p class="fq-sub">' + quizSub + '</p>'
    + '<div id="fqQuestions">' + qHtml + '</div>'
    + '<button id="fqSubmit" class="fq-submit" disabled>' + submitLabel + '</button>'
    + '<div id="fqResult" class="fq-result" style="display:none"></div>'
    + '</div>'
    + '<style>'
    + '.faculty-quiz{margin-top:2rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border2);border-radius:16px}'
    + '.faculty-quiz h2{font-family:var(--serif);font-size:1.4rem;margin-bottom:.4rem}'
    + '.fq-sub{color:var(--text2);font-size:.9rem;margin-bottom:1.2rem}'
    + '.fq-q{margin-bottom:1.1rem}.fq-q p{font-size:.92rem;margin-bottom:.5rem}'
    + '.fq-scale{display:flex;gap:.4rem}'
    + '.fq-scale button{flex:1;padding:.5rem;background:var(--black3);border:1px solid var(--border2);border-radius:8px;color:var(--text2);font-family:var(--mono);cursor:pointer}'
    + '.fq-scale button.active{background:var(--volt);color:var(--black);border-color:var(--volt);font-weight:700}'
    + '.fq-submit{width:100%;margin-top:.5rem;padding:.9rem;background:var(--volt);border:none;border-radius:10px;color:var(--black);font-weight:700;font-family:var(--mono);cursor:pointer}'
    + '.fq-submit:disabled{opacity:.4;cursor:not-allowed}'
    + '.fq-result{text-align:center;padding:1rem 0}'
    + '.fq-pct{font-family:var(--serif);font-size:3rem;color:var(--volt)}'
    + '.fq-cta{display:inline-block;margin-top:1rem;padding:.8rem 1.4rem;background:var(--volt);color:var(--black);border-radius:10px;font-weight:700;font-family:var(--mono);text-decoration:none}'
    + '</style>'
    + '<script>(function(){'
    + 'var answers={};var total=' + total + ';'
    + 'document.querySelectorAll(".fq-scale button").forEach(function(btn){'
    + 'btn.onclick=function(){'
    + 'var scale=btn.closest(".fq-scale");'
    + 'scale.querySelectorAll("button").forEach(function(b){b.classList.remove("active")});'
    + 'btn.classList.add("active");'
    + 'answers[scale.dataset.q]=Number(btn.dataset.v);'
    + 'document.getElementById("fqSubmit").disabled=Object.keys(answers).length<total;'
    + '};});'
    + 'document.getElementById("fqSubmit").onclick=function(){'
    + 'var sum=0;for(var k in answers){sum+=answers[k]}'
    + 'var pct=Math.round(sum/(total*5)*100);'
    + 'var verdict=pct>=70?' + JSON.stringify(verdictHigh) + ':pct>=40?' + JSON.stringify(verdictMid) + ':' + JSON.stringify(verdictLow) + ';'
    + 'document.getElementById("fqQuestions").style.display="none";'
    + 'document.getElementById("fqSubmit").style.display="none";'
    + 'var r=document.getElementById("fqResult");r.style.display="block";'
    + 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div><p>\\'+verdict+\\'</p><a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a>\\';'
    + '};'
    + '})();</script>';
}

app.get('/skola', async (req, res) => {
  const lang = blogLang(req);
  const isCs = lang === 'cs';
  const grouped = {};
  UNI_DB.forEach(function(uni) {
    const uSlug = slugify(uni.n);
    grouped[uni.c] = grouped[uni.c] || [];
    grouped[uni.c].push({ name: uni.n, city: uni.city, uSlug: uSlug, faculties: uni.f.map(function(f) { return { name: f.n, fSlug: slugify(f.n) }; }) });
  });
  const countries = [{ code: 'SK', label: 'Slovensko', flag: '🇸🇰' }, { code: 'CZ', label: 'Česko', flag: '🇨🇿' }];
  const langQS = isCs ? '?lang=cs' : '';
  const sectionsHtml = countries.map(function(c) {
    const unis = grouped[c.code] || [];
    const uniHtml = unis.map(function(u) {
      const facLinks = u.faculties.map(function(f) {
        return '<li><a href="/skola/' + u.uSlug + '/' + f.fSlug + langQS + '">' + escapeHtml(f.name) + '</a></li>';
      }).join('');
      return '<div class="skola-uni"><h3>' + escapeHtml(u.name) + ' <span class="skola-city">— ' + escapeHtml(u.city) + '</span></h3><ul>' + facLinks + '</ul></div>';
    }).join('');
    return '<section class="skola-country"><h2>' + c.flag + ' ' + c.label + '</h2>' + uniHtml + '</section>';
  }).join('');
  const title = isCs ? 'Vysoké školy a fakulty — test, jestli ti sedí' : 'Vysoké školy a fakulty — test, či ti sedia';
  const description = isCs ? 'Kompletní seznam veřejných vysokých škol a fakult v Česku a na Slovensku — zjisti zdarma, jestli se pro tebe hodí.' : 'Kompletný zoznam verejných vysokých škôl a fakúlt na Slovensku a v Česku — zisti zadarmo, či sa pre teba hodia.';
  const body = '<main class="page"><h1 class="hero-title">' + title + '</h1><div class="skola-list">' + sectionsHtml + '</div></main>'
    + '<style>.skola-country{margin-bottom:2.5rem}.skola-uni{margin-bottom:1.4rem}.skola-uni h3{font-family:var(--mono);font-size:.95rem;margin-bottom:.5rem}.skola-city{color:var(--text3);font-weight:400}.skola-uni ul{list-style:none;padding-left:1rem}.skola-uni li{margin-bottom:.3rem}.skola-uni a{color:var(--text2);text-decoration:none;font-size:.88rem}.skola-uni a:hover{color:var(--volt)}</style>';
  res.send(blogLayout({ title: title, description: description, body: body, canonicalPath: '/skola', lang: lang, ogType: 'website' }));
});

app.get('/skola/:uSlug/:fSlug', async (req, res) => {
  const lang = blogLang(req);
  const rec = FACULTY_INDEX[req.params.uSlug + '/' + req.params.fSlug];
  const notFoundTitle = lang === 'cs' ? 'Fakulta nenalezena' : 'Fakulta sa nenašla';
  if (!rec) {
    return res.status(404).send(blogLayout({
      title: notFoundTitle, description: '', canonicalPath: '/skola/' + req.params.uSlug + '/' + req.params.fSlug, lang: lang,
      body: '<main class="page"><div class="prose"><h2>' + notFoundTitle + '</h2></div></main>'
    }));
  }
  const isCs = lang === 'cs';
  const labels = FIELD_LABELS[lang];
  const tagNames = rec.tags.map(function(t) { return labels[t] || t; }).join(', ');
  const flag = rec.country === 'SK' ? '🇸🇰' : '🇨🇿';
  const statements = [];
  rec.tags.forEach(function(t) { (QUIZ_STATEMENTS[t] || []).forEach(function(s) { statements.push(s); }); });
  const title = 'Sedí mi ' + rec.faculty + '? — ' + rec.university;
  const description = (isCs ? 'Zjisti zdarma za minutu, jestli se pro tebe hodí ' : 'Zisti zadarmo za minútu, či sa pre teba hodí ') + rec.faculty + ' (' + rec.university + ', ' + rec.city + ').';
  const langQS = isCs ? '?lang=cs' : '';
  const breadcrumb = '<nav class="breadcrumb"><a href="/' + langQS + '">SP Tréner</a><span>/</span><a href="/skola' + langQS + '">' + (isCs ? 'Fakulty' : 'Fakulty') + '</a><span>/</span><span>' + escapeHtml(rec.faculty) + '</span></nav>';
  const body = '<main class="page">' + breadcrumb + '<article class="prose">'
    + '<div class="fac-eyebrow">' + flag + ' ' + escapeHtml(rec.city) + '</div>'
    + '<h1 class="hero-title">' + escapeHtml(rec.faculty) + '</h1>'
    + '<p class="prose-meta">' + escapeHtml(rec.university) + '</p>'
    + '<p>' + (isCs ? 'Zaměření: ' : 'Zameranie: ') + escapeHtml(tagNames) + '</p>'
    + facultyQuizWidget(lang, statements)
    + '</article></main>';
  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'CollegeOrUniversity', name: rec.university,
    department: { '@type': 'CollegeOrUniversity', name: rec.faculty },
    address: { '@type': 'PostalAddress', addressLocality: rec.city, addressCountry: rec.country }
  }];
  res.send(blogLayout({ title: title, description: description, body: body, canonicalPath: '/skola/' + rec.uSlug + '/' + rec.fSlug, lang: lang, ogType: 'website', jsonLd: jsonLd }));
});

app.get('/blog/:slug', async (req, res) => {`;

server = replaceOnce(server, "app.get('/blog/:slug', async (req, res) => {", NEW_BLOCK, 'server.js: faculty data + /skola routes');

// ═══════════════════════ 2) sitemap.xml rozšírenie ═══════════════════════
server = replaceOnce(server,
  "      ...(coursesForSitemap || []).map(c => ({ loc: BASE_URL_BLOG + '/kurzy/' + c.slug, lastmod: c.created_at, changefreq: 'monthly', priority: '0.7' }))\n    ];",
  "      ...(coursesForSitemap || []).map(c => ({ loc: BASE_URL_BLOG + '/kurzy/' + c.slug, lastmod: c.created_at, changefreq: 'monthly', priority: '0.7' })),\n      { loc: BASE_URL_BLOG + '/skola', changefreq: 'monthly', priority: '0.6' },\n      ...FACULTY_LIST.map(f => ({ loc: BASE_URL_BLOG + '/skola/' + f.uSlug + '/' + f.fSlug, changefreq: 'monthly', priority: '0.5' }))\n    ];",
  'server.js: sitemap.xml faculty URLs');

const backup = SERVER_PATH + '.pre-faculty-landing-pages-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ /skola (adresár) + /skola/:univerzita/:fakulta (~150 stránok) + sitemap.xml pridané.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
