// Nahradza plochych 3 "pacilo by sa mi to?" vyrokov na kazdy odbor
// poriadnym 3-rozmerovym testom (6 vyrokov: 2x zaujem, 2x predpoklady na
// realny styl studia, 2x realita povolania po skole) — niekto, kto sem
// prisiel z platenej reklamy hladajuc konkretnu skolu, cakal viac ako
// povrchny 3-otazkovy kviz.
//
// Vysledok teraz ukazuje rozpad na 3 percenta (Zaujem / Predpoklady /
// Realita povolania), nie len jedno cislo — a ak je Zaujem vyrazne
// vyssie ako Realita povolania (typicky "romanticka predstava o odbore"
// vzorec), prida sa k tomu extra uprimny postreh namiesto len
// prazdneho "sedi ti to / nesedi".
//
// Predpoklad: main-app-patches/173 a 175 uz su aplikovane.
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/176-faculty-quiz-deeper.js

const fs = require('fs');
const path = require('path');

const SERVER_PATH = path.join(process.cwd(), 'server.js');

if (!fs.existsSync(SERVER_PATH)) {
  console.error('❌ Nenašiel som súbor:', SERVER_PATH, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.176-faculty-quiz-deeper-lock');
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

if (server.includes("d:'reality'")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!server.includes('FIELD_ICONS')) {
  console.error('❌ Nenašiel som FIELD_ICONS — over, či je main-app-patches/175 už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}

// ═══════════════════════ 1) QUIZ_STATEMENTS -> 3-rozmerový, 6 na odbor ═══════════════════════
const OLD_STATEMENTS = `const QUIZ_STATEMENTS = {
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
};`;

const NEW_STATEMENTS = `const QUIZ_STATEMENTS = {
  vsp: [
    {d:'interest',sk:'Rád/rada sleduješ správy, politiku a dianie vo svete.',cs:'Rád/a sleduješ zprávy, politiku a dění ve světě.'},
    {d:'interest',sk:'Zaujíma ťa, ako sa v spoločnosti rozhodujú dôležité veci — zákony, verejné politiky, medzinárodné vzťahy.',cs:'Zajímá tě, jak se ve společnosti rozhodují důležité věci — zákony, veřejné politiky, mezinárodní vztahy.'},
    {d:'aptitude',sk:'Vieš spracovať veľké množstvo textu a vytiahnuť z neho podstatu, aj keď je suchý a formálny.',cs:'Umíš zpracovat velké množství textu a vytáhnout z něj podstatu, i když je suchý a formální.'},
    {d:'aptitude',sk:'Nevadí ti, že veľa vecí v spoločenských vedách nemá jednu "správnu" odpoveď — vieš argumentovať aj v nejasných situáciách.',cs:'Nevadí ti, že hodně věcí ve společenských vědách nemá jednu "správnou" odpověď — umíš argumentovat i v nejasných situacích.'},
    {d:'reality',sk:'Vieš, že po tomto odbore väčšinou nejdeš rovno do vedúcej pozície — čaká ťa roky budovania si pozície v štátnej správe, NGO alebo analytike.',cs:'Víš, že po tomto oboru většinou nejdeš rovnou do vedoucí pozice — čekají tě roky budování pozice ve státní správě, NGO nebo analytice.'},
    {d:'reality',sk:'Neprekáža ti, že plat na začiatku kariéry v spoločenskovednej sfére často nie je najvyšší — dôležitejší je pre teba zmysel práce.',cs:'Nevadí ti, že plat na začátku kariéry ve společenskovědní sféře často není nejvyšší — důležitější je pro tebe smysl práce.'}
  ],
  psych: [
    {d:'interest',sk:'Zaujíma ťa, prečo sa ľudia správajú presne tak, ako sa správajú.',cs:'Zajímá tě, proč se lidé chovají přesně tak, jak se chovají.'},
    {d:'interest',sk:'Kamaráti sa ti často zdôveria a ty ich rád/rada vypočuješ a poradíš.',cs:'Kamarádi se ti často svěřují a ty je rád/a vyslechneš a poradíš.'},
    {d:'aptitude',sk:'Zvládaš počúvať ťažké príbehy iných ľudí bez toho, aby ťa to úplne psychicky vyčerpalo.',cs:'Zvládáš poslouchat těžké příběhy jiných lidí, aniž by tě to úplně psychicky vyčerpalo.'},
    {d:'aptitude',sk:'Baví ťa aj "suchšia" stránka psychológie — štatistika, výskumné metódy a biologické základy správania, nielen rozhovory.',cs:'Baví tě i "suchší" stránka psychologie — statistika, výzkumné metody a biologické základy chování, nejen rozhovory.'},
    {d:'reality',sk:'Vieš, že samotné vyštudovanie psychológie ešte neznamená, že môžeš rovno robiť terapiu — vyžaduje to ďalšie roky výcviku a supervízie.',cs:'Víš, že samotné vystudování psychologie ještě neznamená, že můžeš rovnou dělat terapii — vyžaduje to další roky výcviku a supervize.'},
    {d:'reality',sk:'Neprekáža ti, že práca psychológa/čky často znamená veľa papierovania a administratívy popri samotnej práci s klientmi.',cs:'Nevadí ti, že práce psychologa/žky často znamená hodně papírování a administrativy vedle samotné práce s klienty.'}
  ],
  law: [
    {d:'interest',sk:'Baví ťa argumentovať a obhajovať svoj názor aj v ostrej diskusii.',cs:'Baví tě argumentovat a obhajovat svůj názor i v ostré diskusi.'},
    {d:'interest',sk:'Vadí ti nespravodlivosť a chcel/chcela by si vedieť brániť pravidlá a práva iných.',cs:'Vadí ti nespravedlnost a chtěl/a bys umět bránit pravidla a práva druhých.'},
    {d:'aptitude',sk:'Vieš sa učiť naspamäť veľké množstvo presných formulácií a paragrafov, aj keď ťa to nebaví.',cs:'Umíš se učit nazpaměť velké množství přesných formulací a paragrafů, i když tě to nebaví.'},
    {d:'aptitude',sk:'Dokážeš dlho sedieť nad hustým, formálnym textom a nevzdať sa, kým mu nerozumieš.',cs:'Dokážeš dlouho sedět nad hustým, formálním textem a nevzdat to, dokud mu nerozumíš.'},
    {d:'reality',sk:'Vieš, že väčšina práce právnika/čky nie je dramatické vystupovanie na súde, ale prevažne písanie zmlúv, dokumentov a research.',cs:'Víš, že většina práce právníka/čky není dramatické vystupování u soudu, ale převážně psaní smluv, dokumentů a research.'},
    {d:'reality',sk:'Si pripravený/á na to, že prvé roky po škole (koncipientúra) sú väčšinou náročné a slabo platené, kým si vybuduješ prax.',cs:'Jsi připravený/á na to, že první roky po škole (koncipientura) jsou většinou náročné a málo placené, než si vybuduješ praxi.'}
  ],
  medicina: [
    {d:'interest',sk:'Zaujíma ťa, ako presne funguje ľudské (alebo zvieracie) telo.',cs:'Zajímá tě, jak přesně funguje lidské (nebo zvířecí) tělo.'},
    {d:'interest',sk:'Dokázal/dokázala by si zvládnuť nepríjemný pohľad (napr. krv), ak by si tým niekomu pomohol/pomohla.',cs:'Zvládl/a bys nepříjemný pohled (např. krev), pokud by to někomu pomohlo.'},
    {d:'aptitude',sk:'Vieš sa učiť obrovské množstvo faktov naspamäť (anatómia, biochémia) aj bez toho, aby to hneď dávalo praktický zmysel.',cs:'Umíš se učit obrovské množství faktů nazpaměť (anatomie, biochemie), i bez toho, aby to hned dávalo praktický smysl.'},
    {d:'aptitude',sk:'Zvládaš fungovať pod tlakom a rýchlo sa rozhodovať, aj keď je situácia stresujúca.',cs:'Zvládáš fungovat pod tlakem a rychle se rozhodovat, i když je situace stresující.'},
    {d:'reality',sk:'Vieš, že štúdium medicíny trvá 6 rokov a ešte pred sebou máš roky špecializácie predtým, než budeš samostatne pracovať.',cs:'Víš, že studium medicíny trvá 6 let a ještě před sebou máš roky specializace, než budeš samostatně pracovat.'},
    {d:'reality',sk:'Si zmierený/á s tým, že práca v zdravotníctve často znamená nočné služby, cezčasy a citovo náročné situácie.',cs:'Jsi smířený/á s tím, že práce ve zdravotnictví často znamená noční služby, přesčasy a citově náročné situace.'}
  ],
  technika: [
    {d:'interest',sk:'Rád/rada riešiš logické hádanky, matematické úlohy alebo programovanie.',cs:'Rád/a řešíš logické hádanky, matematické úlohy nebo programování.'},
    {d:'interest',sk:'Zaujíma ťa, ako veci fungujú zvnútra — stroje, softvér, technológie.',cs:'Zajímá tě, jak věci fungují zevnitř — stroje, software, technologie.'},
    {d:'aptitude',sk:'Nevadí ti tráviť hodiny hľadaním jednej chyby v kóde alebo výpočte, kým ju nenájdeš.',cs:'Nevadí ti trávit hodiny hledáním jedné chyby v kódu nebo výpočtu, dokud ji nenajdeš.'},
    {d:'aptitude',sk:'Matematika a fyzika ti na strednej škole išli aspoň priemerne dobre, aj keď ťa možno nebavili všetky ich časti.',cs:'Matematika a fyzika ti na střední škole šly aspoň průměrně dobře, i když tě možná nebavily všechny jejich části.'},
    {d:'reality',sk:'Vieš, že technické odbory sú náročné na množstvo učiva a domácich úloh — voľného času počas semestra je menej než na iných odboroch.',cs:'Víš, že technické obory jsou náročné na množství učiva a domácích úkolů — volného času během semestru je méně než na jiných oborech.'},
    {d:'reality',sk:'Neprekáža ti predstava, že veľkú časť práce budeš tráviť sám/sama pri počítači, sústredený/á na jeden problém.',cs:'Nevadí ti představa, že velkou část práce budeš trávit sám/sama u počítače, soustředěný/á na jeden problém.'}
  ],
  pedagogika: [
    {d:'interest',sk:'Baví ťa niekomu niečo trpezlivo vysvetľovať, kým to nepochopí.',cs:'Baví tě někomu něco trpělivě vysvětlovat, dokud to nepochopí.'},
    {d:'interest',sk:'Vieš si predstaviť, že by si každý deň pracoval/a s deťmi alebo mládežou.',cs:'Umíš si představit, že bys každý den pracoval/a s dětmi nebo mládeží.'},
    {d:'aptitude',sk:'Zvládaš zostať trpezlivý/á a pokojný/á aj vtedy, keď sa niečo neustále opakuje a nejde podľa plánu.',cs:'Zvládáš zůstat trpělivý/á a klidný/á i tehdy, když se něco neustále opakuje a nejde podle plánu.'},
    {d:'aptitude',sk:'Vieš udržať pozornosť a rešpekt skupiny ľudí, aj keď niektorí z nich nemajú záujem počúvať.',cs:'Umíš udržet pozornost a respekt skupiny lidí, i když někteří z nich nemají zájem poslouchat.'},
    {d:'reality',sk:'Vieš, že plat začínajúceho učiteľa/ky na Slovensku/v Česku často nepatrí medzi najvyššie — dôležitejší je pre teba zmysel práce.',cs:'Víš, že plat začínajícího učitele/ky v Česku/na Slovensku často nepatří mezi nejvyšší — důležitější je pro tebe smysl práce.'},
    {d:'reality',sk:'Si pripravený/á na to, že súčasťou práce je aj množstvo administratívy a papierovania mimo samotného vyučovania.',cs:'Jsi připravený/á na to, že součástí práce je i množství administrativy a papírování mimo samotné vyučování.'}
  ],
  ekonomia: [
    {d:'interest',sk:'Zaujíma ťa, ako fungujú peniaze, firmy a trh.',cs:'Zajímá tě, jak fungují peníze, firmy a trh.'},
    {d:'interest',sk:'Rád/rada by si viedol/viedla tím, projekt alebo vlastný biznis.',cs:'Rád/a bys vedl/a tým, projekt nebo vlastní byznys.'},
    {d:'aptitude',sk:'Práca s číslami, tabuľkami a grafmi ťa nebaví o nič menej, než práca s ľuďmi alebo textom.',cs:'Práce s čísly, tabulkami a grafy tě nebaví o nic méně, než práce s lidmi nebo textem.'},
    {d:'aptitude',sk:'Vieš si predstaviť analyzovať dáta a trendy, aj keď výsledok nie je hneď jasný na prvý pohľad.',cs:'Umíš si představit analyzovat data a trendy, i když výsledek není hned jasný na první pohled.'},
    {d:'reality',sk:'Vieš, že konkurencia na ekonomických odboroch a neskôr na trhu práce je vysoká — úspech si často treba budovať aktívne, nie čakať, že príde sám.',cs:'Víš, že konkurence na ekonomických oborech a později na trhu práce je vysoká — úspěch si často musíš budovat aktivně, ne čekat, že přijde sám.'},
    {d:'reality',sk:'Neprekáža ti, že prvé roky v korporátnom prostredí môžu znamenať dlhé hodiny a tlak na výkon.',cs:'Nevadí ti, že první roky v korporátním prostředí mohou znamenat dlouhé hodiny a tlak na výkon.'}
  ],
  humanitne: [
    {d:'interest',sk:'Baví ťa čítať, písať alebo učiť sa cudzie jazyky.',cs:'Baví tě číst, psát nebo učit se cizí jazyky.'},
    {d:'interest',sk:'Zaujíma ťa história, filozofia alebo to, prečo spoločnosti a kultúry fungujú tak, ako fungujú.',cs:'Zajímá tě historie, filozofie nebo to, proč společnosti a kultury fungují tak, jak fungují.'},
    {d:'aptitude',sk:'Vieš dlho čítať a analyzovať texty bez toho, aby ťa to odradilo, aj keď nemajú jednoznačný záver.',cs:'Umíš dlouho číst a analyzovat texty, aniž by tě to odradilo, i když nemají jednoznačný závěr.'},
    {d:'aptitude',sk:'Baví ťa písať dlhšie súvislé texty a formulovať vlastné myšlienky na papieri.',cs:'Baví tě psát delší souvislé texty a formulovat vlastní myšlenky na papíře.'},
    {d:'reality',sk:'Vieš, že uplatnenie po humanitných odboroch je často menej priamočiare než pri "praktickejších" odboroch — treba si vedieť vybudovať vlastnú cestu.',cs:'Víš, že uplatnění po humanitních oborech je často méně přímočaré než u "praktičtějších" oborů — musíš si umět vybudovat vlastní cestu.'},
    {d:'reality',sk:'Neprekáža ti predstava, že budeš musieť aktívne hľadať a kombinovať rôzne pracovné príležitosti (učenie, publikovanie, analytika...).',cs:'Nevadí ti představa, že budeš muset aktivně hledat a kombinovat různé pracovní příležitosti (výuka, publikování, analytika...).'}
  ],
  umenie: [
    {d:'interest',sk:'Rád/rada tvoríš — kresliš, fotíš, píšeš, hráš hudbu alebo niečo navrhuješ.',cs:'Rád/a tvoříš — kreslíš, fotíš, píšeš, hraješ hudbu nebo něco navrhuješ.'},
    {d:'interest',sk:'Všímaš si dizajn, farby a estetiku vecí okolo seba viac než väčšina ľudí.',cs:'Všímáš si designu, barev a estetiky věcí kolem sebe víc než většina lidí.'},
    {d:'aptitude',sk:'Zvládaš prijímať tvrdú spätnú väzbu na svoju prácu a nevzdávať sa po nej.',cs:'Zvládáš přijímat tvrdou zpětnou vazbu na svou práci a nevzdávat se po ní.'},
    {d:'aptitude',sk:'Dokážeš tvoriť aj vtedy, keď ťa práve "nenapadá nič" — nečakáš len na inšpiráciu.',cs:'Dokážeš tvořit i tehdy, když tě zrovna "nic nenapadá" — nečekáš jen na inspiraci.'},
    {d:'reality',sk:'Vieš, že v umeleckej kariére je bežné mať nepravidelný príjem, najmä na začiatku — treba si vedieť aj sám/sama nájsť príležitosti.',cs:'Víš, že v umělecké kariéře je běžné mít nepravidelný příjem, zejména na začátku — musíš si umět i sám/sama najít příležitosti.'},
    {d:'reality',sk:'Neprekáža ti predstava, že popri tvorbe budeš musieť riešiť aj "biznis" stránku — propagáciu, klientov, financie.',cs:'Nevadí ti představa, že vedle tvorby budeš muset řešit i "byznys" stránku — propagaci, klienty, finance.'}
  ]
};`;

server = replaceOnce(server, OLD_STATEMENTS, NEW_STATEMENTS, 'QUIZ_STATEMENTS -> 3-rozmerový (interest/aptitude/reality), 6 na odbor');

// ═══════════════════════ 2) facultyQuizWidget() -> rozpad na 3 percentá + honest callout ═══════════════════════
const OLD_WIDGET2 = `function facultyQuizWidget(lang, statements) {
  const isCs = lang === 'cs';
  const total = statements.length;
  const likertLo = isCs ? 'Nesouhlasím' : 'Nesúhlasím';
  const likertHi = isCs ? 'Souhlasím' : 'Súhlasím';
  const qHtml = statements.map(function(s, i) {
    return '<div class="fq-q"><p>' + escapeHtml(s[lang]) + '</p><div class="fq-scale" data-q="' + i + '">'
      + '<button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button><button type="button" data-v="5">5</button>'
      + '</div><div class="fq-scale-labels"><span>' + likertLo + '</span><span>' + likertHi + '</span></div></div>';
  }).join('');
  const verdictHigh = isCs ? 'Vypadá to, že by ti to mohlo sedět!' : 'Vyzerá to, že by ti to mohlo sedieť!';
  const verdictMid = isCs ? 'Částečná shoda — stojí za to prozkoumat i jiné obory.' : 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.';
  const verdictLow = isCs ? 'Asi to není přesně pro tebe — zkus si udělat i plný test.' : 'Asi to nie je presne pre teba — skús si spraviť aj plný test.';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';
  const quizSub = isCs ? 'Odpověz na pár otázek a zjisti to za minutu — zdarma, bez registrace.' : 'Odpovedz na pár otázok a zisti to za minútu — zadarmo, bez registrácie.';
  const submitLabel = isCs ? 'Zjistit shodu →' : 'Zistiť zhodu →';
  const ctaLabel = isCs ? 'Udělat plný test zdarma →' : 'Spraviť plný test zadarma →';
  const ctaHref = '/kam-na-vysoku' + (isCs ? '?lang=cs' : '');
  const homeLabel = isCs ? 'Zjistit víc o SP Tréner →' : 'Zistiť viac o SP Tréner →';
  const homeHref = '/' + (isCs ? '?lang=cs' : '');

  return '<div class="faculty-quiz">'
    + '<h2>' + quizHeading + '</h2>'
    + '<p class="fq-sub">' + quizSub + '</p>'
    + '<div id="fqQuestions">' + qHtml + '</div>'
    + '<button id="fqSubmit" class="fq-submit" disabled>' + submitLabel + '</button>'
    + '<div id="fqResult" class="fq-result" style="display:none"></div>'
    + '</div>'`;

const NEW_WIDGET2 = `function facultyQuizWidget(lang, statements) {
  const isCs = lang === 'cs';
  const total = statements.length;
  const dims = statements.map(function(s) { return s.d; });
  const likertLo = isCs ? 'Nesouhlasím' : 'Nesúhlasím';
  const likertHi = isCs ? 'Souhlasím' : 'Súhlasím';
  const dimLabel = { interest: isCs ? 'Zájem' : 'Záujem', aptitude: isCs ? 'Předpoklady' : 'Predpoklady', reality: isCs ? 'Realita povolání' : 'Realita povolania' };
  const qHtml = statements.map(function(s, i) {
    return '<div class="fq-q"><span class="fq-q-dim">' + dimLabel[s.d] + '</span><p>' + escapeHtml(s[lang]) + '</p><div class="fq-scale" data-q="' + i + '">'
      + '<button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button><button type="button" data-v="4">4</button><button type="button" data-v="5">5</button>'
      + '</div><div class="fq-scale-labels"><span>' + likertLo + '</span><span>' + likertHi + '</span></div></div>';
  }).join('');
  const verdictHigh = isCs ? 'Vypadá to, že by ti to mohlo sedět!' : 'Vyzerá to, že by ti to mohlo sedieť!';
  const verdictMid = isCs ? 'Částečná shoda — stojí za to prozkoumat i jiné obory.' : 'Čiastočná zhoda — oplatí sa preskúmať aj iné odbory.';
  const verdictLow = isCs ? 'Asi to není přesně pro tebe — zkus si udělat i plný test.' : 'Asi to nie je presne pre teba — skús si spraviť aj plný test.';
  const gapWarning = isCs
    ? 'Zajímá tě to víc, než kolik si zatím umíš představit realitu tohoto povolání — vyplatí se to prozkoumat hlouběji (např. promluvit si s někým, kdo to už dělá).'
    : 'Zaujíma ťa to viac, než koľko si zatiaľ vieš predstaviť realitu tohto povolania — oplatí sa to preskúmať hlbšie (napr. porozprávať sa s niekým, kto to už robí).';
  const quizHeading = isCs ? 'Sedí ti tento obor?' : 'Sedí ti tento odbor?';
  const quizSub = isCs ? 'Hlubší test — zájem, předpoklady i realita povolání. Zabere 2 minuty, zdarma, bez registrace.' : 'Hlbší test — záujem, predpoklady aj realita povolania. Zaberie 2 minúty, zadarmo, bez registrácie.';
  const submitLabel = isCs ? 'Zjistit shodu →' : 'Zistiť zhodu →';
  const ctaLabel = isCs ? 'Udělat plný test zdarma →' : 'Spraviť plný test zadarma →';
  const ctaHref = '/kam-na-vysoku' + (isCs ? '?lang=cs' : '');
  const homeLabel = isCs ? 'Zjistit víc o SP Tréner →' : 'Zistiť viac o SP Tréner →';
  const homeHref = '/' + (isCs ? '?lang=cs' : '');
  const dimBarLabel = { interest: dimLabel.interest, aptitude: dimLabel.aptitude, reality: dimLabel.reality };

  return '<div class="faculty-quiz">'
    + '<h2>' + quizHeading + '</h2>'
    + '<p class="fq-sub">' + quizSub + '</p>'
    + '<div id="fqQuestions">' + qHtml + '</div>'
    + '<button id="fqSubmit" class="fq-submit" disabled>' + submitLabel + '</button>'
    + '<div id="fqResult" class="fq-result" style="display:none"></div>'
    + '</div>'`;

server = replaceOnce(server, OLD_WIDGET2, NEW_WIDGET2, 'facultyQuizWidget() HTML -> dimenzie na otázkach + gapWarning setup');

// ═══════════════════════ 3) CSS -> .fq-q-dim, .fq-dim-bars ═══════════════════════
server = replaceOnce(server,
  "+ '.fq-q{margin-bottom:1.3rem}.fq-q p{font-size:.92rem;margin-bottom:.5rem}'",
  "+ '.fq-q{margin-bottom:1.3rem}.fq-q p{font-size:.92rem;margin-bottom:.5rem}'\n    + '.fq-q-dim{display:block;font-family:var(--mono);font-size:.65rem;letter-spacing:.06em;text-transform:uppercase;color:var(--volt);margin-bottom:.3rem}'\n    + '.fq-dim-bars{display:grid;gap:.5rem;margin:0 0 1.2rem;text-align:left}'\n    + '.fq-dim-row{display:flex;align-items:center;gap:.6rem;font-size:.78rem;color:var(--text2)}'\n    + '.fq-dim-row .fq-dim-name{width:auto;min-width:110px;flex-shrink:0}'\n    + '.fq-dim-track{flex:1;height:6px;background:var(--black3);border-radius:99px;overflow:hidden}'\n    + '.fq-dim-fill{height:100%;background:var(--volt)}'\n    + '.fq-dim-pct{width:36px;text-align:right;font-family:var(--mono);flex-shrink:0}'\n    + '.fq-gap-warning{background:rgba(200,255,0,.06);border:1px solid rgba(200,255,0,.2);border-radius:10px;padding:.8rem 1rem;font-size:.82rem;color:var(--text2);text-align:left;margin:1rem 0}'",
  'CSS: .fq-q-dim + .fq-dim-bars + .fq-gap-warning');

// ═══════════════════════ 4) scoring JS -> rozpad na dimenzie + gap warning ═══════════════════════
const OLD_SCORE_JS = `+ 'document.getElementById("fqSubmit").onclick=function(){'
    + 'var sum=0;for(var k in answers){sum+=answers[k]}'
    + 'var pct=Math.round(sum/(total*5)*100);'
    + 'var verdict=pct>=70?' + JSON.stringify(verdictHigh) + ':pct>=40?' + JSON.stringify(verdictMid) + ':' + JSON.stringify(verdictLow) + ';'
    + 'document.getElementById("fqQuestions").style.display="none";'
    + 'document.getElementById("fqSubmit").style.display="none";'
    + 'var r=document.getElementById("fqResult");r.style.display="block";'
    + 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div><p>\\'+verdict+\\'</p><a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a><a class="fq-cta-secondary" href="' + homeHref + '">' + homeLabel + '</a>\\';'
    + '};'`;

const NEW_SCORE_JS = `+ 'document.getElementById("fqSubmit").onclick=function(){'
    + 'var dims=' + JSON.stringify(dims) + ';'
    + 'var sum=0;var byDim={interest:[],aptitude:[],reality:[]};'
    + 'for(var k in answers){sum+=answers[k];var d=dims[Number(k)];if(byDim[d])byDim[d].push(answers[k]);}'
    + 'var pct=Math.round(sum/(total*5)*100);'
    + 'function avgPct(arr){if(!arr.length)return 0;var s=0;for(var i=0;i<arr.length;i++)s+=arr[i];return Math.round(s/(arr.length*5)*100);}'
    + 'var pInterest=avgPct(byDim.interest);var pAptitude=avgPct(byDim.aptitude);var pReality=avgPct(byDim.reality);'
    + 'var verdict=pct>=70?' + JSON.stringify(verdictHigh) + ':pct>=40?' + JSON.stringify(verdictMid) + ':' + JSON.stringify(verdictLow) + ';'
    + 'var gapHtml=(pInterest-pReality>=25)?\\'<div class="fq-gap-warning">💡 \\'+' + JSON.stringify(gapWarning) + '+\\'</div>\\':\\'\\';'
    + 'var barsHtml=\\'<div class="fq-dim-bars">\\''
    + '+\\'<div class="fq-dim-row"><span class="fq-dim-name">' + dimBarLabel.interest + '</span><div class="fq-dim-track"><div class="fq-dim-fill" style="width:\\'+pInterest+\\'%"></div></div><span class="fq-dim-pct">\\'+pInterest+\\'%</span></div>\\''
    + '+\\'<div class="fq-dim-row"><span class="fq-dim-name">' + dimBarLabel.aptitude + '</span><div class="fq-dim-track"><div class="fq-dim-fill" style="width:\\'+pAptitude+\\'%"></div></div><span class="fq-dim-pct">\\'+pAptitude+\\'%</span></div>\\''
    + '+\\'<div class="fq-dim-row"><span class="fq-dim-name">' + dimBarLabel.reality + '</span><div class="fq-dim-track"><div class="fq-dim-fill" style="width:\\'+pReality+\\'%"></div></div><span class="fq-dim-pct">\\'+pReality+\\'%</span></div>\\''
    + '+\\'</div>\\';'
    + 'document.getElementById("fqQuestions").style.display="none";'
    + 'document.getElementById("fqSubmit").style.display="none";'
    + 'var r=document.getElementById("fqResult");r.style.display="block";'
    + 'r.innerHTML=\\'<div class="fq-pct">\\'+pct+\\'%</div>\\'+barsHtml+\\'<p>\\'+verdict+\\'</p>\\'+gapHtml+\\'<a class="fq-cta" href="' + ctaHref + '">' + ctaLabel + '</a><a class="fq-cta-secondary" href="' + homeHref + '">' + homeLabel + '</a>\\';'
    + '};'`;

server = replaceOnce(server, OLD_SCORE_JS, NEW_SCORE_JS, 'scoring JS -> dimension breakdown + gap warning');

const backup = SERVER_PATH + '.pre-faculty-quiz-deeper-' + Date.now();
fs.copyFileSync(SERVER_PATH, backup);
fs.writeFileSync(SERVER_PATH, server);

console.log('✅ Fakultný test je teraz 3-rozmerový (Záujem/Predpoklady/Realita povolania), 6 otázok na odbor namiesto 3, s rozpadom vo výsledku a "gap" upozornením.');
console.log('   Záloha:', backup);
console.log('   Over syntax pred reštartom: node -c server.js');
