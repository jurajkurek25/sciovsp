// Rieši hlavne zvyšné SEO riziko z auditu (main-app-patches/182): fakulty
// so ZHODNÝM tagom (napr. desiatky "technika" fakúlt na rôznych školách)
// mali doteraz identický text v "Ako vyzerajú prijímačky" aj identické
// otázky v teste — jediný rozdiel bol názov fakulty/školy/mesta. Pri
// ~150 programaticky generovaných stránkach je to presne vzorec, ktorý
// Google Helpful Content penalizuje ako thin/duplicate content.
//
// Rieši sa pridaním REÁLNYCH, OVERENÝCH faktov o kazdej z 39 univerzit
// (rok zalozenia, velkost, ako skutocne funguje prijimacie konanie,
// jeden odlisujuci fakt) — vyskumane cez web-search agentov, NIE
// vymyslene. Kde agent nemal spolahlivy zdroj, pouziva sa vseobecna
// uprimna formulacia namiesto konkretneho (mozno nespravneho) cisla —
// presne podla odporucania z research reportu.
//
// Nova sekcia "O univerzite" sa vklada hned po hero, PRED test — dava
// kontext skor, nez niekto investuje cas do testu, a zaroven dostava
// najunikatnejsi obsah stranky co najvyssie.
//
// Predpoklad: main-app-patches/173, 175, 178 uz su aplikovane.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/184-faculty-uni-facts.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.184-faculty-uni-facts-lock');
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

if (server.includes('const UNI_FACTS')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('const FACULTY_INDEX = {};')) {
  console.error('❌ Nenašiel som FACULTY_INDEX — over, či je main-app-patches/173 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('const relatedFacs = FACULTY_LIST.filter(')) {
  console.error('❌ Nenašiel som relatedFacs — over, či je main-app-patches/178 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) UNI_FACTS dáta, pred FACULTY_INDEX ═══════════════════════
const OLD_INDEX_ANCHOR = `const FACULTY_INDEX = {};
const FACULTY_LIST = [];`;

const NEW_INDEX_ANCHOR = `const UNI_FACTS = {
  'Univerzita Komenského v Bratislave': {
    sk: { about: 'Univerzita Komenského, založená v roku 1919, je najstaršia a najväčšia univerzita na Slovensku (~25 000 študentov) — prvá vysoká škola s vyučovaním v slovenčine.', admission: 'Prijímacie konanie sa výrazne líši podľa fakulty: na Lekárskej fakulte je to písomná skúška z biológie a chémie (od 2024 aj test logického myslenia), na viacerých humanitných a spoločenskovedných fakultách zas rozhoduje priemer známok zo strednej školy.' },
    cs: { about: 'Univerzita Komenského, založená v roce 1919, je nejstarší a největší univerzita na Slovensku (~25 000 studentů) — první vysoká škola s výukou ve slovenštině.', admission: 'Přijímací řízení se výrazně liší podle fakulty: na Lékařské fakultě jde o písemnou zkoušku z biologie a chemie (od 2024 i test logického myšlení), na řadě humanitních a společenskovědních fakult zase rozhoduje průměr známek ze střední školy.' }
  },
  'Slovenská technická univerzita v Bratislave': {
    sk: { about: 'Slovenská technická univerzita, založená v roku 1937, je najväčšia technická univerzita na Slovensku (~11 000 študentov, 7 fakúlt).', admission: 'Na väčšine fakúlt sa dá dostať bez prijímacej skúšky pri dobrom priemere známok alebo výsledku maturity z matematiky/fyziky — pri prevýšení kapacity alebo slabšom priemere nasleduje písomná prijímacia skúška.' },
    cs: { about: 'Slovenská technická univerzita, založená v roce 1937, je největší technická univerzita na Slovensku (~11 000 studentů, 7 fakult).', admission: 'Na většině fakult se lze dostat bez přijímací zkoušky při dobrém průměru známek nebo výsledku maturity z matematiky/fyziky — při převisu zájemců nebo slabším průměru následuje písemná přijímací zkouška.' }
  },
  'Ekonomická univerzita v Bratislave': {
    sk: { about: 'Ekonomická univerzita v Bratislave, s tradíciou siahajúcou do roku 1940, je najväčšia a najstaršia ekonomicky zameraná univerzita na Slovensku (~7 000 študentov).', admission: 'Prijímanie prebieha formou písomných prijímacích skúšok v stanovených termínoch — presný priebeh sa líši podľa fakulty a študijného programu.' },
    cs: { about: 'Ekonomická univerzita v Bratislavě, s tradicí sahající do roku 1940, je největší a nejstarší ekonomicky zaměřená univerzita na Slovensku (~7 000 studentů).', admission: 'Přijímání probíhá formou písemných přijímacích zkoušek ve stanovených termínech — přesný průběh se liší podle fakulty a studijního programu.' }
  },
  'Univerzita Pavla Jozefa Šafárika': {
    sk: { about: 'Univerzita Pavla Jozefa Šafárika v Košiciach, založená v roku 1959, je druhá najstaršia klasická (netechnická) univerzita na Slovensku.', admission: 'Napríklad na Lekárskej fakulte platí: pri priemere známok do 1,50 za posledné 3 roky strednej školy sa dá dostať bez skúšky, inak nasleduje písomná prijímacia skúška — na iných fakultách sa podmienky líšia.' },
    cs: { about: 'Univerzita Pavla Jozefa Šafárika v Košicích, založená v roce 1959, je druhá nejstarší klasická (netechnická) univerzita na Slovensku.', admission: 'Například na Lékařské fakultě platí: při průměru známek do 1,50 za poslední 3 roky střední školy se lze dostat bez zkoušky, jinak následuje písemná přijímací zkouška — na jiných fakultách se podmínky liší.' }
  },
  'Technická univerzita v Košiciach': {
    sk: { about: 'Technická univerzita v Košiciach, založená v roku 1952, patrí medzi najväčšie univerzity na Slovensku — má 9 fakúlt na 3 kampusoch v 2 mestách.', admission: 'Na väčšine fakúlt sa uchádzači vyberajú podľa priemeru známok zo strednej školy bez písomnej skúšky — napríklad na Ekonomickej fakulte rozhoduje priamo poradie podľa priemeru.' },
    cs: { about: 'Technická univerzita v Košicích, založená v roce 1952, patří mezi největší univerzity na Slovensku — má 9 fakult na 3 kampusech ve 2 městech.', admission: 'Na většině fakult se uchazeči vybírají podle průměru známek ze střední školy bez písemné zkoušky — například na Ekonomické fakultě rozhoduje přímo pořadí podle průměru.' }
  },
  'Univerzita veterinárskeho lekárstva a farmácie': {
    sk: { about: 'Univerzita veterinárskeho lekárstva a farmácie v Košiciach, založená v roku 1949, je jediná univerzita na Slovensku zameraná výhradne na veterinárstvo a farmáciu (~2 000 študentov).', admission: 'Na väčšinu študijných programov sa vyžaduje písomná prijímacia skúška, pri niektorých programoch sa dá dostať aj bez nej.' },
    cs: { about: 'Univerzita veterinárního lékařství a farmacie v Košicích, založená v roce 1949, je jediná univerzita na Slovensku zaměřená výhradně na veterinářství a farmacii (~2 000 studentů).', admission: 'Na většinu studijních programů se vyžaduje písemná přijímací zkouška, u některých programů se lze dostat i bez ní.' }
  },
  'Žilinská univerzita v Žiline': {
    sk: { about: 'Žilinská univerzita, založená v roku 1953 oddelením od Českého vysokého učení technického v Prahe (pôvodne železničné inžinierstvo), má približne 8 000–10 000 študentov.', admission: 'Pri priemere známok do 2,0 (za prvé 3–4 roky strednej školy) sa dá dostať bez skúšky, inak nasleduje písomný test zo slovenského jazyka, spoločenských vied a informatiky.' },
    cs: { about: 'Žilinská univerzita, založená v roce 1953 oddělením od Českého vysokého učení technického v Praze (původně železniční inženýrství), má přibližně 8 000–10 000 studentů.', admission: 'Při průměru známek do 2,0 (za první 3–4 roky střední školy) se lze dostat bez zkoušky, jinak následuje písemný test ze slovenského jazyka, společenských věd a informatiky.' }
  },
  'Univerzita Mateja Bela': {
    sk: { about: 'Univerzita Mateja Bela v Banskej Bystrici, založená v roku 1992, má približne 6 000–8 000 študentov.', admission: 'Pri niektorých programoch (napr. mediálne štúdiá pri priemere do 1,30) sa dá dostať bez skúšky, inak nasleduje písomná prijímacia skúška s minimálne 50 % úspešnosťou.' },
    cs: { about: 'Univerzita Mateja Bela v Banské Bystrici, založená v roce 1992, má přibližně 6 000–8 000 studentů.', admission: 'U některých programů (např. mediální studia při průměru do 1,30) se lze dostat bez zkoušky, jinak následuje písemná přijímací zkouška s minimálně 50% úspěšností.' }
  },
  'Univerzita Konštantína Filozofa': {
    sk: { about: 'Univerzita Konštantína Filozofa v Nitre nadväzuje na pedagogický inštitút z roku 1959, súčasný názov nesie od roku 1996 (~8 000 študentov).', admission: 'Prijímacie podmienky sa líšia podľa fakulty a študijného programu.' },
    cs: { about: 'Univerzita Konštantína Filozofa v Nitře navazuje na pedagogický institut z roku 1959, současný název nese od roku 1996 (~8 000 studentů).', admission: 'Přijímací podmínky se liší podle fakulty a studijního programu.' }
  },
  'Slovenská poľnohospodárska univerzita': {
    sk: { about: 'Slovenská poľnohospodárska univerzita v Nitre, založená v roku 1952, je jediná univerzita na Slovensku špecializovaná na poľnohospodárstvo.', admission: 'Prijímacie podmienky sa líšia podľa fakulty a študijného programu.' },
    cs: { about: 'Slovenská zemědělská univerzita v Nitře, založená v roce 1952, je jediná univerzita na Slovensku specializovaná na zemědělství.', admission: 'Přijímací podmínky se liší podle fakulty a studijního programu.' }
  },
  'Trnavská univerzita': {
    sk: { about: 'Trnavská univerzita nadväzuje na univerzitu založenú v roku 1635 kardinálom Petrom Pázmáňom — najstaršiu univerzitnú tradíciu na Slovensku. V súčasnej podobe funguje od roku 1992 (~5 000 študentov).', admission: 'Podmienky sa líšia podľa fakulty — pri niektorých programoch (napr. Verejné zdravotníctvo) rozhoduje priamo priemer známok zo strednej školy, pri iných je potrebná prijímacia skúška.' },
    cs: { about: 'Trnavská univerzita navazuje na univerzitu založenou v roce 1635 kardinálem Petrem Pázmáněm — nejstarší univerzitní tradici na Slovensku. V současné podobě funguje od roku 1992 (~5 000 studentů).', admission: 'Podmínky se liší podle fakulty — u některých programů (např. Veřejné zdravotnictví) rozhoduje přímo průměr známek ze střední školy, u jiných je potřeba přijímací zkouška.' }
  },
  'Univerzita sv. Cyrila a Metoda': {
    sk: { about: 'Univerzita sv. Cyrila a Metoda v Trnave, založená v roku 1997, ponúka cez 140 študijných programov na 5 fakultách.', admission: 'Prijímacie podmienky sa líšia podľa fakulty a študijného programu.' },
    cs: { about: 'Univerzita sv. Cyrila a Metoděje v Trnavě, založená v roce 1997, nabízí přes 140 studijních programů na 5 fakultách.', admission: 'Přijímací podmínky se liší podle fakulty a studijního programu.' }
  },
  'Katolícka univerzita': {
    sk: { about: 'Katolícka univerzita v Ružomberku, založená v roku 2000, je jediná verejná univerzita na Slovensku s katolíckym zameraním.', admission: 'Prijímacie podmienky si stanovuje každá fakulta samostatne (filozofická, pedagogická, teologická, zdravotnícka).' },
    cs: { about: 'Katolická univerzita v Ružomberku, založená v roce 2000, je jediná veřejná univerzita na Slovensku s katolickým zaměřením.', admission: 'Přijímací podmínky si stanovuje každá fakulta samostatně (filozofická, pedagogická, teologická, zdravotnická).' }
  },
  'Prešovská univerzita': {
    sk: { about: 'Prešovská univerzita vznikla v roku 1997 oddelením od Univerzity Pavla Jozefa Šafárika v Košiciach. Má 8 fakúlt a približne 7 800 študentov — podľa vlastných údajov tretia najväčšia univerzita na Slovensku.', admission: 'Prijímacie podmienky sa líšia podľa fakulty a študijného programu.' },
    cs: { about: 'Prešovská univerzita vznikla v roce 1997 oddělením od Univerzity Pavla Jozefa Šafárika v Košicích. Má 8 fakult a přibližně 7 800 studentů — podle vlastních údajů třetí největší univerzita na Slovensku.', admission: 'Přijímací podmínky se liší podle fakulty a studijního programu.' }
  },
  'Akadémia umení': {
    sk: { about: 'Akadémia umení v Banskej Bystrici, založená v roku 1997, má 3 fakulty (výtvarné, hudobné a dramatické, scénické umenia) a približne 500–600 študentov.', admission: 'Prijatie sa rozhoduje na základe talentovej skúšky.' },
    cs: { about: 'Akademie umění v Banské Bystrici, založená v roce 1997, má 3 fakulty (výtvarná, hudební a dramatická, scénická umění) a přibližně 500–600 studentů.', admission: 'Přijetí se rozhoduje na základě talentové zkoušky.' }
  },
  'Vysoká škola múzických umení': {
    sk: { about: 'Vysoká škola múzických umení v Bratislave, založená v roku 1949, je najväčšia umelecká vysoká škola na Slovensku (divadlo, film a televízia, hudba a tanec, ~1 000 študentov).', admission: 'Prijatie sa rozhoduje na základe talentových skúšok — posudzuje sa kreativita, technická zručnosť a umelecký prejav.' },
    cs: { about: 'Vysoká škola múzických umění v Bratislavě, založená v roce 1949, je největší umělecká vysoká škola na Slovensku (divadlo, film a televize, hudba a tanec, ~1 000 studentů).', admission: 'Přijetí se rozhoduje na základě talentových zkoušek — posuzuje se kreativita, technická zručnost a umělecký projev.' }
  },
  'Vysoká škola výtvarných umení': {
    sk: { about: 'Vysoká škola výtvarných umení v Bratislave, založená v roku 1949, bola prvou vysokou školou na Slovensku zameranou na výtvarné umenie.', admission: 'Prijatie sa rozhoduje na základe talentových skúšok a pohovorov zameraných na zvolený študijný program.' },
    cs: { about: 'Vysoká škola výtvarných umění v Bratislavě, založená v roce 1949, byla první vysokou školou na Slovensku zaměřenou na výtvarné umění.', admission: 'Přijetí se rozhoduje na základě talentových zkoušek a pohovorů zaměřených na zvolený studijní program.' }
  },
  'Technická univerzita vo Zvolene': {
    sk: { about: 'Technická univerzita vo Zvolene, založená v roku 1952, je jediná univerzita na Slovensku špecializovaná na lesníctvo a drevárske technológie (~2 000 študentov).', admission: 'Prijímacie podmienky si stanovuje každá fakulta samostatne.' },
    cs: { about: 'Technická univerzita ve Zvolenu, založená v roce 1952, je jediná univerzita na Slovensku specializovaná na lesnictví a dřevařské technologie (~2 000 studentů).', admission: 'Přijímací podmínky si stanovuje každá fakulta samostatně.' }
  },
  'Trenčianska univerzita Alexandra Dubčeka': {
    sk: { about: 'Trenčianska univerzita Alexandra Dubčeka, založená v roku 1997 a pomenovaná po Alexandrovi Dubčekovi, má približne 2 000 študentov.', admission: 'Prijímacie podmienky sa líšia podľa fakulty a študijného programu.' },
    cs: { about: 'Trenčianská univerzita Alexandra Dubčeka, založená v roce 1997 a pojmenovaná po Alexandru Dubčekovi, má přibližně 2 000 studentů.', admission: 'Přijímací podmínky se liší podle fakulty a studijního programu.' }
  },
  'Slovenská zdravotnícka univerzita': {
    sk: { about: 'Slovenská zdravotnícka univerzita v Bratislave, založená v roku 2002, je jediná univerzita na Slovensku výhradne zameraná na zdravotnícke vzdelávanie vo všetkých troch stupňoch štúdia.', admission: 'Napríklad na Všeobecné lekárstvo pozostáva prijímacia skúška zo 160 otázok (80 z biológie, 80 z chémie), 150 minút, max. 640 bodov, plus bonusové body za stredoškolské olympiády.' },
    cs: { about: 'Slovenská zdravotnická univerzita v Bratislavě, založená v roce 2002, je jediná univerzita na Slovensku výhradně zaměřená na zdravotnické vzdělávání ve všech třech stupních studia.', admission: 'Například na Všeobecné lékařství se přijímací zkouška skládá ze 160 otázek (80 z biologie, 80 z chemie), 150 minut, max. 640 bodů, plus bonusové body za středoškolské olympiády.' }
  },
  'Univerzita Karlova': {
    sk: { about: 'Univerzita Karlova v Prahe, založená v roku 1348, je najstaršia univerzita v strednej Európe (~48 000–50 000 študentov).', admission: 'Neexistuje jednotný model — líši sa silne podľa fakulty: lekárske fakulty majú písomné testy (fyzika/chémia/biológia), Filozofická a Fakulta sociálnych vied vlastné alebo SCIO testy, inde prijímacie pohovory.' },
    cs: { about: 'Univerzita Karlova v Praze, založená v roce 1348, je nejstarší univerzita ve střední Evropě (~48 000–50 000 studentů).', admission: 'Neexistuje jednotný model — liší se silně podle fakulty: lékařské fakulty mají písemné testy (fyzika/chemie/biologie), Filozofická a Fakulta sociálních věd vlastní nebo SCIO testy, jinde přijímací pohovory.' }
  },
  'České vysoké učení technické': {
    sk: { about: 'České vysoké učení technické v Prahe, založené v roku 1707, je najstaršia civilná (nevojenská) technická univerzita v Európe (~18 000–20 000 študentov).', admission: 'Na väčšine technických fakúlt je to písomná prijímacia skúška z matematiky, ktorá sa dá odpustiť pri dobrom maturitnom výsledku z matematiky.' },
    cs: { about: 'České vysoké učení technické v Praze, založené v roce 1707, je nejstarší civilní (nevojenská) technická univerzita v Evropě (~18 000–20 000 studentů).', admission: 'Na většině technických fakult jde o písemnou přijímací zkoušku z matematiky, kterou lze prominout při dobrém maturitním výsledku z matematiky.' }
  },
  'Vysoká škola ekonomická': {
    sk: { about: 'Vysoká škola ekonomická v Prahe nadväzuje na tradíciu siahajúcu do roku 1919, súčasný názov nesie od roku 1953. Je najväčšou ekonomickou vysokou školou v Česku (~14 000 študentov).', admission: 'Prijatie sa rozhoduje buď na základe vlastných prijímacích skúšok, alebo najlepšieho výsledku z Národných porovnávacích skúšok (NSZ/SCIO).' },
    cs: { about: 'Vysoká škola ekonomická v Praze navazuje na tradici sahající do roku 1919, současný název nese od roku 1953. Je největší ekonomickou vysokou školou v Česku (~14 000 studentů).', admission: 'Přijetí se rozhoduje buď na základě vlastních přijímacích zkoušek, nebo nejlepšího výsledku z Národních srovnávacích zkoušek (NSZ/SCIO).' }
  },
  'Masarykova univerzita': {
    sk: { about: 'Masarykova univerzita v Brne, založená v roku 1919, je druhá najväčšia vysoká škola v Česku (~35 000 študentov).', admission: '6 z 10 fakúlt používa TSP (Test študijných predpokladov) ako hlavné alebo jediné kritérium; Lekárska a Farmaceutická fakulta majú odborné testy z biológie/chémie/fyziky, Fakulta sociálnych štúdií zas SCIO testy zo spoločenských vied.' },
    cs: { about: 'Masarykova univerzita v Brně, založená v roce 1919, je druhá největší vysoká škola v Česku (~35 000 studentů).', admission: '6 z 10 fakult používá TSP (Test studijních předpokladů) jako hlavní nebo jediné kritérium; Lékařská a Farmaceutická fakulta mají odborné testy z biologie/chemie/fyziky, Fakulta sociálních studií zase SCIO testy ze společenských věd.' }
  },
  'Vysoké učení technické': {
    sk: { about: 'Vysoké učení technické v Brne, založené v roku 1899, je najstaršia univerzita v Brne a prvá česká vysoká škola na Morave — dnes najväčšia technická univerzita v Česku (~18 000–19 000 študentov).', admission: 'Podmienky prijatia si stanovuje každá fakulta samostatne.' },
    cs: { about: 'Vysoké učení technické v Brně, založené v roce 1899, je nejstarší univerzita v Brně a první česká vysoká škola na Moravě — dnes největší technická univerzita v Česku (~18 000–19 000 studentů).', admission: 'Podmínky přijetí si stanovuje každá fakulta samostatně.' }
  },
  'Univerzita Palackého': {
    sk: { about: 'Univerzita Palackého v Olomouci, založená v roku 1573, je druhá najstaršia univerzita v Česku (~20 000–23 000 študentov).', admission: 'Väčšina fakúlt (napr. Filozofická, Fakulta telesnej kultúry) spolieha na Národné porovnávacie skúšky (NSZ/SCIO); pri programoch s nízkym záujmom sa dajú odpustiť, inde majú fakulty vlastné skúšky.' },
    cs: { about: 'Univerzita Palackého v Olomouci, založená v roce 1573, je druhá nejstarší univerzita v Česku (~20 000–23 000 studentů).', admission: 'Většina fakult (např. Filozofická, Fakulta tělesné kultury) spoléhá na Národní srovnávací zkoušky (NSZ/SCIO); u programů s nízkým zájmem lze prominout, jinde mají fakulty vlastní zkoušky.' }
  },
  'Ostravská univerzita': {
    sk: { about: 'Ostravská univerzita, založená v roku 1991, má približne 10 000 študentov a sídli tu najmladšia lekárska fakulta v Česku.', admission: 'Podmienky prijatia sa líšia podľa fakulty — niektoré prijímacie skúšky vyžadujú, iné nie.' },
    cs: { about: 'Ostravská univerzita, založená v roce 1991, má přibližně 10 000 studentů a sídlí zde nejmladší lékařská fakulta v Česku.', admission: 'Podmínky přijetí se liší podle fakulty — některé přijímací zkoušky vyžadují, jiné ne.' }
  },
  'Vysoká škola báňská – Technická univerzita': {
    sk: { about: 'Vysoká škola báňská – Technická univerzita Ostrava nadväzuje na Banskú akadémiu založenú v roku 1849 v Příbrami (do Ostravy sa presunula v roku 1945) — jednu z najstarších banských škôl v Európe. Má približne 23 000 študentov.', admission: 'Pri technických odboroch je zvyčajne potrebná prijímacia skúška alebo test, ktorý sa dá pri dobrej maturite odpustiť.' },
    cs: { about: 'Vysoká škola báňská – Technická univerzita Ostrava navazuje na Báňskou akademii založenou v roce 1849 v Příbrami (do Ostravy se přesunula v roce 1945) — jednu z nejstarších hornických škol v Evropě. Má přibližně 23 000 studentů.', admission: 'U technických oborů je obvykle potřeba přijímací zkouška nebo test, který lze při dobré maturitě prominout.' }
  },
  'Jihočeská univerzita': {
    sk: { about: 'Juhočeská univerzita v Českých Budějoviciach, založená v roku 1991, má 8 fakúlt a približne 9 000 študentov.', admission: 'Podmienky prijatia si stanovuje každá fakulta samostatne.' },
    cs: { about: 'Jihočeská univerzita v Českých Budějovicích, založená v roce 1991, má 8 fakult a přibližně 9 000 studentů.', admission: 'Podmínky přijetí si stanovuje každá fakulta samostatně.' }
  },
  'Univerzita Pardubice': {
    sk: { about: 'Univerzita Pardubice nadväzuje na Vysokú školu chemickú založenú v roku 1950, univerzitný názov nesie od roku 1994 (~7 000–8 000 študentov).', admission: 'Podmienky prijatia a termíny si stanovuje každá fakulta samostatne.' },
    cs: { about: 'Univerzita Pardubice navazuje na Vysokou školu chemickou založenou v roce 1950, univerzitní název nese od roku 1994 (~7 000–8 000 studentů).', admission: 'Podmínky přijetí a termíny si stanovuje každá fakulta samostatně.' }
  },
  'Technická univerzita v Liberci': {
    sk: { about: 'Technická univerzita v Liberci, založená v roku 1953, má približne 6 000–7 000 študentov.', admission: 'Napríklad Fakulta textilná prijíma bez prijímacej skúšky, Fakulta umenia a architektúry vyžaduje talentovú skúšku — na iných fakultách sa podmienky líšia.' },
    cs: { about: 'Technická univerzita v Liberci, založená v roce 1953, má přibližně 6 000–7 000 studentů.', admission: 'Například Fakulta textilní přijímá bez přijímací zkoušky, Fakulta umění a architektury vyžaduje talentovou zkoušku — na jiných fakultách se podmínky liší.' }
  },
  'Univerzita Hradec Králové': {
    sk: { about: 'Univerzita Hradec Králové nadväzuje na Pedagogický inštitút z roku 1959, univerzitný názov nesie od roku 2000 (~6 500 študentov).', admission: 'Podmienky prijatia sa líšia podľa fakulty a študijného programu, prihlášky sa podávajú samostatne na každú fakultu.' },
    cs: { about: 'Univerzita Hradec Králové navazuje na Pedagogický institut z roku 1959, univerzitní název nese od roku 2000 (~6 500 studentů).', admission: 'Podmínky přijetí se liší podle fakulty a studijního programu, přihlášky se podávají samostatně na každou fakultu.' }
  },
  'Západočeská univerzita': {
    sk: { about: 'Západočeská univerzita v Plzni vznikla v roku 1991 zlúčením Vysokej školy strojnej a elektrotechnickej s Pedagogickou fakultou (~12 000–13 000 študentov).', admission: 'Fakulty si vypisujú vlastné termíny a formy prijímacích skúšok, ktoré sa líšia pre bakalárske aj magisterské štúdium.' },
    cs: { about: 'Západočeská univerzita v Plzni vznikla v roce 1991 sloučením Vysoké školy strojní a elektrotechnické s Pedagogickou fakultou (~12 000–13 000 studentů).', admission: 'Fakulty si vypisují vlastní termíny a formy přijímacích zkoušek, které se liší pro bakalářské i magisterské studium.' }
  },
  'Mendelova univerzita': {
    sk: { about: 'Mendelova univerzita v Brne, založená v roku 1919 ako Vysoká škola zemědělská (univerzitný názov od 1994), je najstaršia samostatná poľnohospodársky zameraná vysoká škola v Česku (~11 000 študentov).', admission: 'O prijatí často rozhoduje priemer známok zo strednej školy a maturity; pri niektorých fakultách sa používajú NSZ/SCIO testy, pri výtvarných odboroch talentová skúška.' },
    cs: { about: 'Mendelova univerzita v Brně, založená v roce 1919 jako Vysoká škola zemědělská (univerzitní název od 1994), je nejstarší samostatná zemědělsky zaměřená vysoká škola v Česku (~11 000 studentů).', admission: 'O přijetí často rozhoduje průměr známek ze střední školy a maturity; u některých fakult se používají NSZ/SCIO testy, u výtvarných oborů talentová zkouška.' }
  },
  'Veterinární univerzita Brno': {
    sk: { about: 'Veterinárna univerzita Brno, založená v roku 1918, je jediná veterinárna univerzita v Česku.', admission: 'Prijímacie konanie organizujú fakulty samostatne.' },
    cs: { about: 'Veterinární univerzita Brno, založená v roce 1918, je jediná veterinární univerzita v Česku.', admission: 'Přijímací řízení organizují fakulty samostatně.' }
  },
  'Akademie múzických umění': {
    sk: { about: 'Akademie múzických umění v Prahe, založená v roku 1945, je najväčšia umelecká vysoká škola v Česku (~1 500 študentov).', admission: 'Prijatie sa rozhoduje na základe talentovej skúšky (divadlo, film, hudba, tanec).' },
    cs: { about: 'Akademie múzických umění v Praze, založená v roce 1945, je největší umělecká vysoká škola v Česku (~1 500 studentů).', admission: 'Přijetí se rozhoduje na základě talentové zkoušky (divadlo, film, hudba, tanec).' }
  },
  'Vysoká škola uměleckoprůmyslová': {
    sk: { about: 'Vysoká škola uměleckoprůmyslová v Prahe, založená v roku 1885, je jedna z najstarších umeleckopriemyselných škôl v Európe (~600 študentov).', admission: 'Prijatie sa rozhoduje na základe dvojkolovej talentovej skúšky (portfólio + praktická časť).' },
    cs: { about: 'Vysoká škola uměleckoprůmyslová v Praze, založená v roce 1885, je jedna z nejstarších uměleckoprůmyslových škol v Evropě (~600 studentů).', admission: 'Přijetí se rozhoduje na základě dvoukolové talentové zkoušky (portfolio + praktická část).' }
  },
  'Akademie výtvarných umění': {
    sk: { about: 'Akademie výtvarných umění v Prahe, založená v roku 1799, je najmenšia verejná vysoká škola v Česku.', admission: 'Prijímacie konanie je dvojkolová talentová skúška, veľmi selektívna (pomer uchádzačov k prijatým približne 7:1).' },
    cs: { about: 'Akademie výtvarných umění v Praze, založená v roce 1799, je nejmenší veřejná vysoká škola v Česku.', admission: 'Přijímací řízení je dvoukolová talentová zkouška, velmi selektivní (poměr uchazečů k přijatým přibližně 7:1).' }
  },
  'Slezská univerzita v Opavě': {
    sk: { about: 'Sliezska univerzita v Opave, založená v roku 1991, je jediná vysoká škola v Česku založená po roku 1989 „na zelenej lúke" — teda bez nadväznosti na predchádzajúcu inštitúciu (~5 300 študentov).', admission: 'Viaceré programy prijímajú cez Národné porovnávacie skúšky (NSZ/SCIO), iné majú vlastné prijímacie skúšky.' },
    cs: { about: 'Slezská univerzita v Opavě, založená v roce 1991, je jediná vysoká škola v Česku založená po roce 1989 „na zelené louce" — tedy bez návaznosti na předchozí instituci (~5 300 studentů).', admission: 'Řada programů přijímá přes Národní srovnávací zkoušky (NSZ/SCIO), jiné mají vlastní přijímací zkoušky.' }
  }
};

const FACULTY_INDEX = {};
const FACULTY_LIST = [];`;

server = replaceOnce(server, OLD_INDEX_ANCHOR, NEW_INDEX_ANCHOR, 'UNI_FACTS dáta');

// ═══════════════════════ 2) výpočet uniFactsHtml, pred zostavením body ═══════════════════════
const OLD_RELATED = `  const relatedFacs = FACULTY_LIST.filter(function(f) { return f.uSlug === rec.uSlug && f.fSlug !== rec.fSlug; });
  const relatedHtml = relatedFacs.length ? (
    '<section class="fac-related">'
    + '<h2>' + (isCs ? 'Další obory na ' : 'Ďalšie fakulty na ') + escapeHtml(rec.university) + '</h2>'
    + '<ul class="fac-related-list">' + relatedFacs.map(function(f) { return '<li><a href="/skola/' + f.uSlug + '/' + f.fSlug + langQS + '">' + escapeHtml(f.faculty) + '</a></li>'; }).join('') + '</ul>'
    + '</section>'
  ) : '';

  const body = '<main class="page">' + breadcrumb`;

const NEW_RELATED = `  const relatedFacs = FACULTY_LIST.filter(function(f) { return f.uSlug === rec.uSlug && f.fSlug !== rec.fSlug; });
  const relatedHtml = relatedFacs.length ? (
    '<section class="fac-related">'
    + '<h2>' + (isCs ? 'Další obory na ' : 'Ďalšie fakulty na ') + escapeHtml(rec.university) + '</h2>'
    + '<ul class="fac-related-list">' + relatedFacs.map(function(f) { return '<li><a href="/skola/' + f.uSlug + '/' + f.fSlug + langQS + '">' + escapeHtml(f.faculty) + '</a></li>'; }).join('') + '</ul>'
    + '</section>'
  ) : '';

  const uniFacts = UNI_FACTS[rec.university] && UNI_FACTS[rec.university][lang];
  const uniFactsHtml = uniFacts ? (
    '<section class="fac-uni-facts">'
    + '<h2>' + (isCs ? 'O univerzitě' : 'O univerzite') + '</h2>'
    + '<p>' + uniFacts.about + '</p>'
    + '<p>' + uniFacts.admission + '</p>'
    + '</section>'
  ) : '';

  const body = '<main class="page">' + breadcrumb`;

server = replaceOnce(server, OLD_RELATED, NEW_RELATED, 'výpočet uniFactsHtml z UNI_FACTS');

// ═══════════════════════ 3) vlož uniFactsHtml hneď po hero, pred testom ═══════════════════════
const OLD_HERO_END = `    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + facultyQuizWidget(lang, statements)`;

const NEW_HERO_END = `    + '<p class="fac-intro">' + heroIntro + '</p>'
    + '</section>'
    + uniFactsHtml
    + facultyQuizWidget(lang, statements)`;

server = replaceOnce(server, OLD_HERO_END, NEW_HERO_END, 'body -> vlož uniFactsHtml hneď po hero');

// ═══════════════════════ 4) CSS pre .fac-uni-facts ═══════════════════════
server = replaceOnce(server,
  `.fac-related-list a{color:var(--text2);text-decoration:none;font-size:.86rem}.fac-related-list a:hover{color:var(--volt)}</style>';`,
  `.fac-related-list a{color:var(--text2);text-decoration:none;font-size:.86rem}.fac-related-list a:hover{color:var(--volt)}.fac-uni-facts{margin-bottom:1.5rem;padding:1.5rem;background:var(--black2);border:1px solid var(--border);border-radius:16px}.fac-uni-facts h2{font-family:var(--serif);font-size:1.1rem;margin-bottom:.6rem}.fac-uni-facts p{color:var(--text2);font-size:.88rem;line-height:1.6;margin-bottom:.7rem}.fac-uni-facts p:last-child{margin-bottom:0}</style>';`,
  'CSS: .fac-uni-facts');

const backup = SERVER_PATH + '.pre-faculty-uni-facts-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Sekcia "O univerzite" (rok založenia, veľkosť, ako reálne funguje prijímačka, odlišujúci fakt) pridaná hneď po hero na všetky fakultné stránky — reálne overené fakty pre 39 univerzít, žiadne fabrikované čísla.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
