// Vkladá 40 nových bilingválnych (SK+CZ) blogových článkov do blog_posts —
// rovnaký vzor ako ad-service/40-run-seed-blog-batch2-supabase.js
// (@supabase/supabase-js klient, presne ako sa k DB pripája produkčný
// server.js cez SUPABASE_URL / SUPABASE_SERVICE_KEY z .env).
//
// Témy pokrývajú SEO medzery voči existujúcim ~16 článkom: formátové
// vysvetlivky VŠP/OSP typov úloh, odbory, ktoré appka pokrýva ale blog zatiaľ
// nie (IT, architektúra, farmácia, veterinárstvo, žurnalistika, sociálna
// práca, verejná správa, strojárstvo, umenie), mestské/školské prehľady
// (naviazané na 39 škôl v kam-na-vysoku.html), rozhodovací/lievikový obsah
// naviazaný na kam-na-vysoku kvíz a darčekové karty, a vlastné funkcie appky
// (percentil 85, AI generátor, AI Mentor, SP Klany, Mirror Mode/Time-Kill).
//
// Idempotentné: pred insertom pre každý slug overí, či už v DB existuje.
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online (musí tam byť .env
// s SUPABASE_URL a SUPABASE_SERVICE_KEY):
//   node 99-seed-blog-batch4.js

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL alebo SUPABASE_SERVICE_KEY chýba v .env. Nič som nevložil.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const CTA_SK = '<p>V SP Tréner nájdeš neobmedzené AI-generované cvičné testy, personalizovanú analýzu slabých miest a reálnu simuláciu na čas — presne to, čo potrebuješ na cielenú, nie len dlhú prípravu.</p>';
const CTA_CS = '<p>V SP Tréner najdeš neomezené AI-generované cvičné testy, personalizovanou analýzu slabých míst a reálnou simulaci na čas — přesně to, co potřebuješ k cílené, ne jen dlouhé přípravě.</p>';

const ROWS = [
{
  slug: 'doplnanie-do-textu-vsp-navod',
  title: 'Doplňovanie do textu vo VŠP: ako vybrať správnu dvojicu slov',
  excerpt: 'Presný postup, ako riešiť úlohy na doplňovanie do textu vo verbálnej časti VŠP — na čo sa sústrediť a akých chýb sa vyvarovať.',
  tag: 'Verbálna časť', read_time: '5 min čítania',
  content: '<p>Doplňovanie do textu je jeden z najčastejších typov úloh vo verbálnej časti VŠP — vyberáš dvojicu alebo trojicu slov, ktorá do vety sedí významovo aj štylisticky. Znie to jednoducho, no práve tu uchádzači strácajú prekvapivo veľa bodov kvôli zbytočnému ponáhľaniu.</p><h2>Prečo sa tu chybuje</h2><p>Najčastejšia chyba je vybrať prvú možnosť, ktorá „znie dobre", bez toho, aby si dosadil všetky slová z dvojice naraz. Jedno slovo môže sedieť perfektne, druhé z tej istej možnosti však vetu naruší.</p><h2>Postup, ktorý funguje</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Prečítaj si celú vetu bez doplnených slov a skús si vytvoriť vlastnú predstavu, čo by tam malo byť.</li><li>Dosaď <strong>obe</strong> slová z každej možnosti naraz, nie len jedno.</li><li>Over si logickú aj štylistickú súvislosť — slovo môže gramaticky sedieť, ale významovo protirečiť zvyšku vety.</li><li>Ak váhaš medzi dvoma možnosťami, hľadaj slovo, ktoré sa hodí do vety najprirodzenejšie, nie len „technicky správne".</li></ol><h2>Typická pasca</h2><p>Testy zámerne zaraďujú možnosti, kde jedno slovo z dvojice je lákavé, ale druhé ju kazí. Kto sa sústredí len na prvé slovo, urobí chybu, ktorej sa dalo ľahko vyhnúť.</p>' + CTA_SK,
  title_cs: 'Doplňování do textu ve VŠP/OSP: jak vybrat správnou dvojici slov',
  excerpt_cs: 'Přesný postup, jak řešit úlohy na doplňování do textu ve verbální části VŠP/OSP — na co se soustředit a jakých chyb se vyvarovat.',
  tag_cs: 'Verbální část', read_time_cs: '5 min čtení',
  content_cs: '<p>Doplňování do textu je jeden z nejčastějších typů úloh ve verbální části VŠP/OSP — vybíráš dvojici nebo trojici slov, která do věty sedí významově i stylisticky. Zní to jednoduše, ale právě tady uchazeči ztrácejí překvapivě hodně bodů kvůli zbytečnému spěchu.</p><h2>Proč se tu chybuje</h2><p>Nejčastější chyba je vybrat první možnost, která „zní dobře", aniž bys dosadil všechna slova z dvojice najednou. Jedno slovo může sedět perfektně, druhé ze stejné možnosti však větu naruší.</p><h2>Postup, který funguje</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Přečti si celou větu bez doplněných slov a zkus si vytvořit vlastní představu, co by tam mělo být.</li><li>Dosaď <strong>obě</strong> slova z každé možnosti najednou, ne jen jedno.</li><li>Ověř si logickou i stylistickou souvislost — slovo může gramaticky sedět, ale významově odporovat zbytku věty.</li><li>Pokud váháš mezi dvěma možnostmi, hledej slovo, které se hodí do věty nejpřirozeněji, ne jen „technicky správně".</li></ol><h2>Typická past</h2><p>Testy záměrně zařazují možnosti, kde jedno slovo z dvojice je lákavé, ale druhé ji kazí. Kdo se soustředí jen na první slovo, udělá chybu, které se dalo snadno vyhnout.</p>' + CTA_CS
},
{
  slug: 'koherencia-textu-vsp',
  title: 'Koherencia textu vo VŠP: ako nájsť vetu, ktorá nezapadá',
  excerpt: 'Úlohy na koherenciu textu testujú, či vieš rozpoznať vetu, ktorá logicky nezapadá do odseku. Tu je systematický postup, ako ich riešiť rýchlo.',
  tag: 'Verbálna časť', read_time: '5 min čítania',
  content: '<p>Pri úlohách na koherenciu dostaneš krátky odsek, v ktorom jedna veta logicky alebo tematicky nezapadá do zvyšku textu. Cieľom nie je nájsť gramatickú chybu, ale narušenie plynulosti myšlienky.</p><h2>Na čo sa sústrediť</h2><p>Väčšina odsekov má jasnú „niť" — jednu hlavnú myšlienku, ktorú jednotlivé vety rozvíjajú. Veta, ktorá nezapadá, zvyčajne buď mení tému, protirečí predchádzajúcej vete, alebo prináša informáciu, ktorá s ostatnými nesúvisí.</p><h2>Postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Prečítaj si celý odsek raz, bez zastavovania sa pri jednotlivých vetách.</li><li>Skús zhrnúť hlavnú myšlienku odseku jednou vetou vo svojej hlave.</li><li>Prejdi vety znova a over si, ktorá k tejto myšlienke nepatrí alebo ju narúša.</li><li>Ak váhaš medzi dvoma vetami, over si, ktorá z nich mení smer textu výraznejšie.</li></ol><h2>Bežná chyba</h2><p>Uchádzači často hľadajú vetu, ktorá je „najzložitejšia" alebo najdlhšia, namiesto tej, ktorá skutočne logicky nesedí. Dĺžka ani zložitosť vety nie sú indikátorom — jediné, na čom záleží, je, či sa hodí do myšlienkovej línie odseku.</p>' + CTA_SK,
  title_cs: 'Koherence textu ve VŠP/OSP: jak najít větu, která nezapadá',
  excerpt_cs: 'Úlohy na koherenci textu testují, zda umíš rozpoznat větu, která logicky nezapadá do odstavce. Tady je systematický postup, jak je řešit rychle.',
  tag_cs: 'Verbální část', read_time_cs: '5 min čtení',
  content_cs: '<p>U úloh na koherenci dostaneš krátký odstavec, ve kterém jedna věta logicky nebo tematicky nezapadá do zbytku textu. Cílem není najít gramatickou chybu, ale narušení plynulosti myšlenky.</p><h2>Na co se soustředit</h2><p>Většina odstavců má jasnou „nit" — jednu hlavní myšlenku, kterou jednotlivé věty rozvíjejí. Věta, která nezapadá, obvykle buď mění téma, odporuje předchozí větě, nebo přináší informaci, která s ostatními nesouvisí.</p><h2>Postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Přečti si celý odstavec jednou, bez zastavování se u jednotlivých vět.</li><li>Zkus shrnout hlavní myšlenku odstavce jednou větou ve své hlavě.</li><li>Projdi věty znovu a ověř si, která k této myšlence nepatří nebo ji narušuje.</li><li>Pokud váháš mezi dvěma větami, ověř si, která z nich mění směr textu výrazněji.</li></ol><h2>Běžná chyba</h2><p>Uchazeči často hledají větu, která je „nejsložitější" nebo nejdelší, místo té, která skutečně logicky nesedí. Délka ani složitost věty nejsou indikátorem — jediné, na čem záleží, je, zda se hodí do myšlenkové linie odstavce.</p>' + CTA_CS
},
{
  slug: 'porovnavanie-cislenych-vyrazov-vsp',
  title: 'Porovnávanie číselných výrazov: rýchly postup bez zbytočného počítania',
  excerpt: 'Pri porovnávaní hodnôt vo VŠP väčšinou nepotrebuješ presný výsledok — stačí vedieť, ktorá strana je väčšia. Ukazujeme, ako na to rýchlejšie.',
  tag: 'Analytická časť', read_time: '5 min čítania',
  content: '<p>Úlohy typu „porovnaj výraz vľavo a vpravo" patria medzi tie, kde sa dá ušetriť najviac času — pokiaľ nepočítaš zbytočne presne. Cieľom väčšinou nie je zistiť presný výsledok, ale len to, ktorá strana je väčšia, menšia alebo rovnaká.</p><h2>Prečo sa oplatí nepočítať do konca</h2><p>Uchádzači často automaticky dopočítajú oba výrazy na presné číslo, hoci stačí ich zjednodušiť natoľko, aby bol vzťah medzi nimi jasný. Presné počítanie stojí čas, ktorý sa dá využiť inde.</p><h2>Techniky, ktoré fungujú</h2><ul><li><strong>Odčítanie spoločnej časti</strong> — ak sa oba výrazy delia o rovnaký člen, odstráň ho a porovnaj len zvyšok.</li><li><strong>Zaokrúhľovanie</strong> — pri veľkých alebo desatinných číslach väčšinou stačí odhad na rád veľkosti.</li><li><strong>Substitúcia extrémnych hodnôt</strong> — pri výrazoch s premennou skús dosadiť 0, 1 alebo záporné číslo, aby si rýchlo overil smer nerovnosti.</li></ul><h2>Na čo si dať pozor</h2><p>Pri zápornych číslach a zlomkoch sa smer nerovnosti ľahko „otočí" — vždy si over, či násobíš alebo delíš záporným číslom, pretože to mení znamienko nerovnosti.</p>' + CTA_SK,
  title_cs: 'Porovnávání číselných výrazů: rychlý postup bez zbytečného počítání',
  excerpt_cs: 'U porovnávání hodnot ve VŠP/OSP většinou nepotřebuješ přesný výsledek — stačí vědět, která strana je větší. Ukazujeme, jak na to rychleji.',
  tag_cs: 'Analytická časť', read_time_cs: '5 min čtení',
  content_cs: '<p>Úlohy typu „porovnej výraz vlevo a vpravo" patří mezi ty, kde se dá ušetřit nejvíc času — pokud nepočítáš zbytečně přesně. Cílem většinou není zjistit přesný výsledek, ale jen to, která strana je větší, menší nebo stejná.</p><h2>Proč se vyplatí nepočítat do konce</h2><p>Uchazeči často automaticky dopočítají oba výrazy na přesné číslo, ačkoli stačí je zjednodušit natolik, aby byl vztah mezi nimi jasný. Přesné počítání stojí čas, který se dá využít jinde.</p><h2>Techniky, které fungují</h2><ul><li><strong>Odečtení společné části</strong> — pokud se oba výrazy dělí o stejný člen, odstraň ho a porovnej jen zbytek.</li><li><strong>Zaokrouhlování</strong> — u velkých nebo desetinných čísel většinou stačí odhad na řád velikosti.</li><li><strong>Substituce extrémních hodnot</strong> — u výrazů s proměnnou zkus dosadit 0, 1 nebo záporné číslo, abys rychle ověřil směr nerovnosti.</li></ul><h2>Na co si dát pozor</h2><p>U záporných čísel a zlomků se směr nerovnosti snadno „otočí" — vždy si ověř, zda násobíš nebo dělíš záporným číslem, protože to mění znaménko nerovnosti.</p>' + CTA_CS
},
{
  slug: 'postacujuce-podmienky-vsp',
  title: 'Postačujúce podmienky vo VŠP: typ úlohy, na ktorom sa najčastejšie chybuje',
  excerpt: 'Postačujúce podmienky patria medzi najviac podceňovaný typ analytických úloh. Vysvetľujeme, ako ich riešiť bez zbytočného hádania.',
  tag: 'Analytická časť', read_time: '5 min čítania',
  content: '<p>Postačujúce podmienky patria medzi typ úloh, ktoré na prvý pohľad pôsobia jednoducho, no práve preto sa pri nich najčastejšie chybuje unáhlením. Úlohou je zistiť, či daná informácia sama osebe stačí na jednoznačné zodpovedanie otázky.</p><h2>Kde sa najčastejšie chybuje</h2><p>Najbežnejšia chyba je posúdiť podmienku len na základe „typického" prípadu a prehliadnuť okrajovú situáciu, v ktorej podmienka neplatí — napríklad nulu, záporné číslo alebo rovnosť namiesto nerovnosti.</p><h2>Postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Over si podmienku na bežnom, „typickom" príklade.</li><li>Skús aktívne nájsť protipríklad — situáciu, v ktorej by podmienka mohla zlyhať.</li><li>Ak protipríklad nájdeš, podmienka nie je postačujúca. Ak nie, pravdepodobne postačujúca je.</li><li>Pri viacerých podmienkach naraz over si každú samostatne aj v kombinácii.</li></ol><h2>Prečo sa to oplatí trénovať</h2><p>Tento typ úloh sa v testoch objavuje opakovane a s tréningom sa dá riešiť výrazne rýchlejšie — kľúčové je zautomatizovať si návyk hľadať protipríklad namiesto potvrdzovania prvej intuície.</p>' + CTA_SK,
  title_cs: 'Postačující podmínky ve VŠP/OSP: typ úlohy, na kterém se nejčastěji chybuje',
  excerpt_cs: 'Postačující podmínky patří mezi nejvíce podceňovaný typ analytických úloh. Vysvětlujeme, jak je řešit bez zbytečného hádání.',
  tag_cs: 'Analytická časť', read_time_cs: '5 min čtení',
  content_cs: '<p>Postačující podmínky patří mezi typ úloh, které na první pohled působí jednoduše, ale právě proto se u nich nejčastěji chybuje unáhlením. Úkolem je zjistit, zda daná informace sama o sobě stačí k jednoznačnému zodpovězení otázky.</p><h2>Kde se nejčastěji chybuje</h2><p>Nejběžnější chyba je posoudit podmínku jen na základě „typického" případu a přehlédnout okrajovou situaci, ve které podmínka neplatí — například nulu, záporné číslo nebo rovnost místo nerovnosti.</p><h2>Postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Ověř si podmínku na běžném, „typickém" příkladu.</li><li>Zkus aktivně najít protipříklad — situaci, ve které by podmínka mohla selhat.</li><li>Pokud protipříklad najdeš, podmínka není postačující. Pokud ne, pravděpodobně postačující je.</li><li>U více podmínek najednou ověř si každou samostatně i v kombinaci.</li></ol><h2>Proč se to vyplatí trénovat</h2><p>Tento typ úloh se v testech objevuje opakovaně a s tréninkem se dá řešit výrazně rychleji — klíčové je zautomatizovat si návyk hledat protipříklad místo potvrzování první intuice.</p>' + CTA_CS
},
{
  slug: 'ako-citat-grafy-tabulky-rychlo',
  title: 'Ako čítať grafy a tabuľky rýchlo v analytickej časti VŠP',
  excerpt: 'Najväčšia časová strata v analytickej časti nie je počítanie, ale zbytočné čítanie celého grafu. Ukazujeme presný postup, ako to obísť.',
  tag: 'Analytická časť', read_time: '5 min čítania',
  content: '<p>Grafy a tabuľky sú v analytickej časti VŠP takmer isté — a zároveň patria medzi miesta, kde sa najviac plytvá časom. Väčšina uchádzačov si najprv „prečíta" celý graf a až potom sa pozrie na otázku, čo je presne opačné poradie, aké by malo byť.</p><h2>Správne poradie krokov</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Prečítaj si najprv otázku — presne vieš, čo hľadáš.</li><li>Až potom sa pozri do grafu alebo tabuľky, a to len na hodnoty, ktoré k odpovedi potrebuješ.</li><li>Nepočítaj nič navyše — ak stačí porovnanie, nepočítaj presné hodnoty.</li></ol><h2>Bežné typy otázok</h2><p>Najčastejšie sa objavujú otázky na najvyššiu/najnižšiu hodnotu, rozdiel medzi dvomi kategóriami, percentuálnu zmenu alebo trend. Každý z týchto typov vyžaduje pozerať sa na graf inak — pri trende sleduješ smer, pri rozdiele len dve konkrétne hodnoty.</p><h2>Ako trénovať rýchlosť</h2><p>Rýchlosť pri grafoch sa nezíska tým, že vieš rýchlo počítať, ale tým, že vieš rýchlo nájsť, kam sa v grafe pozrieť. To sa buduje len opakovaním veľkého množstva rôznych typov grafov a tabuliek.</p>' + CTA_SK,
  title_cs: 'Jak číst grafy a tabulky rychle v analytické části VŠP/OSP',
  excerpt_cs: 'Největší časová ztráta v analytické části není počítání, ale zbytečné čtení celého grafu. Ukazujeme přesný postup, jak to obejít.',
  tag_cs: 'Analytická časť', read_time_cs: '5 min čtení',
  content_cs: '<p>Grafy a tabulky jsou v analytické části VŠP/OSP téměř jisté — a zároveň patří mezi místa, kde se nejvíc plýtvá časem. Většina uchazečů si nejdřív „přečte" celý graf a až poté se podívá na otázku, což je přesně opačné pořadí, jaké by mělo být.</p><h2>Správné pořadí kroků</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Přečti si nejdřív otázku — přesně víš, co hledáš.</li><li>Až poté se podívej do grafu nebo tabulky, a to jen na hodnoty, které k odpovědi potřebuješ.</li><li>Nepočítej nic navíc — pokud stačí porovnání, nepočítej přesné hodnoty.</li></ol><h2>Běžné typy otázok</h2><p>Nejčastěji se objevují otázky na nejvyšší/nejnižší hodnotu, rozdíl mezi dvěma kategoriemi, procentuální změnu nebo trend. Každý z těchto typů vyžaduje dívat se na graf jinak — u trendu sleduješ směr, u rozdílu jen dvě konkrétní hodnoty.</p><h2>Jak trénovat rychlost</h2><p>Rychlost u grafů se nezíská tím, že umíš rychle počítat, ale tím, že umíš rychle najít, kam se v grafu podívat. To se buduje jen opakováním velkého množství různých typů grafů a tabulek.</p>' + CTA_CS
},
{
  slug: 'slovne-ulohy-vsp-percenta-rychlost-praca',
  title: 'Slovné úlohy vo VŠP: percentá, rýchlosť a spoločná práca bez zdĺhavého počítania',
  excerpt: 'Tri najčastejšie typy slovných úloh v analytickej časti VŠP a šablónovité postupy, ktoré ich riešia rýchlo a spoľahlivo.',
  tag: 'Analytická časť', read_time: '6 min čítania',
  content: '<p>Slovné úlohy sa v analytickej časti VŠP opakujú v podobných variáciách — percentá, rýchlosť/vzdialenosť/čas a spoločná práca. Kto má pre každý typ pripravený jednoduchý postup, rieši ich výrazne rýchlejšie než ten, kto si vzorec odvodzuje odznova pri každej úlohe.</p><h2>Percentá</h2><p>Najčastejšia pasca je zámena „o koľko percent viac" a „na koľko percent". Vždy si over, či sa otázka pýta na percentuálnu zmenu, alebo na výslednú hodnotu ako percento pôvodnej.</p><h2>Rýchlosť, vzdialenosť, čas</h2><p>Vzťah dráha = rýchlosť × čas platí vždy, no kľúčové je dávať pozor na jednotky — ak je rýchlosť v km/h a čas v minútach, treba prepočítať skôr, než začneš počítať.</p><h2>Spoločná práca</h2><p>Pri úlohách typu „koľko trvá, keď pracujú dvaja spolu" sa oplatí pracovať s prevrátenými hodnotami časov (tzv. výkon za jednotku času) a tie sčítať — namiesto zložitého odvodzovania od nuly pri každej úlohe.</p><h2>Ako si vybudovať rýchlosť</h2><p>Šablónovitý postup funguje len vtedy, keď ho poznáš naspamäť a vieš ho aplikovať automaticky. To sa dosiahne len opakovaným riešením desiatok variácií toho istého typu úlohy.</p>' + CTA_SK,
  title_cs: 'Slovní úlohy ve VŠP/OSP: procenta, rychlost a společná práce bez zdlouhavého počítání',
  excerpt_cs: 'Tři nejčastější typy slovních úloh v analytické části VŠP/OSP a šablonovité postupy, které je řeší rychle a spolehlivě.',
  tag_cs: 'Analytická časť', read_time_cs: '6 min čtení',
  content_cs: '<p>Slovní úlohy se v analytické části VŠP/OSP opakují v podobných variacích — procenta, rychlost/vzdálenost/čas a společná práce. Kdo má pro každý typ připravený jednoduchý postup, řeší je výrazně rychleji než ten, kdo si vzorec odvozuje znovu při každé úloze.</p><h2>Procenta</h2><p>Nejčastější past je záměna „o kolik procent víc" a „na kolik procent". Vždy si ověř, zda se otázka ptá na procentuální změnu, nebo na výslednou hodnotu jako procento původní.</p><h2>Rychlost, vzdálenost, čas</h2><p>Vztah dráha = rychlost × čas platí vždy, ale klíčové je dávat pozor na jednotky — pokud je rychlost v km/h a čas v minutách, je třeba přepočítat dřív, než začneš počítat.</p><h2>Společná práce</h2><p>U úloh typu „jak dlouho trvá, když pracují dva společně" se vyplatí pracovat s převrácenými hodnotami časů (tzv. výkon za jednotku času) a ty sečíst — místo složitého odvozování od nuly u každé úlohy.</p><h2>Jak si vybudovat rychlost</h2><p>Šablonovitý postup funguje jen tehdy, když ho znáš nazpaměť a umíš ho aplikovat automaticky. Toho se dosáhne jen opakovaným řešením desítek variací téhož typu úlohy.</p>' + CTA_CS
},
{
  slug: 'verbalna-vs-analyticka-cast-kde-ziskat-viac-bodov',
  title: 'Verbálna vs. analytická časť VŠP: kde sa dá získať viac bodov rýchlejšie',
  excerpt: 'Obe časti VŠP majú rovnakú váhu, no nie rovnaký potenciál na rýchle zlepšenie. Ukazujeme, kde má tréning väčší efekt.',
  tag: 'Príprava', read_time: '5 min čítania',
  content: '<p>Verbálna a analytická časť VŠP majú väčšinou rovnakú váhu v celkovom hodnotení, no ich potenciál na rýchle zlepšenie sa líši. Vedieť, kam smerovať čas na začiatku prípravy, môže výrazne skrátiť cestu k percentilu 85.</p><h2>Verbálna časť: rýchlejší efekt na začiatku</h2><p>Verbálne úlohy (doplňovanie, analógie, koherencia) sa väčšinou zlepšujú rýchlo po prvých desiatkach precvičených úloh — stačí si osvojiť typ uvažovania, ktorý testy vyžadujú, a chyby výrazne klesnú.</p><h2>Analytická časť: pomalší, ale hlbší efekt</h2><p>Analytické úlohy (grafy, zebry, slovné úlohy) vyžadujú viac rôznych techník naraz, takže zlepšenie prichádza postupnejšie, no je zvyčajne stabilnejšie a prenáša sa aj do rýchlosti pri iných typoch logických úloh.</p><h2>Praktické odporúčanie</h2><p>Ak máš málo času do testu, začni verbálnou časťou — rýchlejšie uvidíš výsledky a získaš motiváciu pokračovať. Ak máš času viac, investuj rovnomerne do oboch, keďže analytická časť má z dlhodobého hľadiska väčší priestor na zlepšenie.</p>' + CTA_SK,
  title_cs: 'Verbální vs. analytická část VŠP/OSP: kde se dá získat víc bodů rychleji',
  excerpt_cs: 'Obě části VŠP/OSP mají stejnou váhu, ale ne stejný potenciál na rychlé zlepšení. Ukazujeme, kde má trénink větší efekt.',
  tag_cs: 'Príprava', read_time_cs: '5 min čtení',
  content_cs: '<p>Verbální a analytická část VŠP/OSP mají většinou stejnou váhu v celkovém hodnocení, ale jejich potenciál na rychlé zlepšení se liší. Vědět, kam směřovat čas na začátku přípravy, může výrazně zkrátit cestu k vysokému percentilu.</p><h2>Verbální část: rychlejší efekt na začátku</h2><p>Verbální úlohy (doplňování, analogie, koherence) se většinou zlepšují rychle po prvních desítkách procvičených úloh — stačí si osvojit typ uvažování, který testy vyžadují, a chyby výrazně klesnou.</p><h2>Analytická část: pomalejší, ale hlubší efekt</h2><p>Analytické úlohy (grafy, zebry, slovní úlohy) vyžadují víc různých technik najednou, takže zlepšení přichází postupněji, ale je obvykle stabilnější a přenáší se i do rychlosti u jiných typů logických úloh.</p><h2>Praktické doporučení</h2><p>Pokud máš málo času do testu, začni verbální částí — rychleji uvidíš výsledky a získáš motivaci pokračovat. Pokud máš času víc, investuj rovnoměrně do obou, protože analytická část má z dlouhodobého hlediska větší prostor pro zlepšení.</p>' + CTA_CS
},
{
  slug: 'prijimacky-na-farmaciu',
  title: 'Prijímačky na farmáciu: čo očakávať a ako sa pripraviť',
  excerpt: 'Farmaceutické fakulty kombinujú VŠP s biológiou a chémiou. Vysvetľujeme, aký je typický formát a na čo sa sústrediť pri príprave.',
  tag: 'Farmácia', read_time: '6 min čítania',
  content: '<p>Farmácia patrí medzi konkurenčné zdravotnícke odbory, kde sa formát prijímačiek často podobá medicíne — kombinácia všeobecných študijných predpokladov s vedomostným testom z biológie a chémie.</p><h2>Typický formát testu</h2><ul><li>všeobecné študijné predpoklady (verbálna a analytická časť),</li><li>chémia — dôraz na anorganickú aj organickú chémiu, keďže je pre farmáciu kľúčová,</li><li>biológia — najmä bunková biológia a fyziológia človeka.</li></ul><h2>Prečo je chémia dôležitejšia než pri medicíne</h2><p>Na farmácii má chémia väčšinou väčšiu váhu než na všeobecnej medicíne, keďže priamo súvisí s neskorším štúdiom liekov, ich zloženia a účinkov. Oplatí sa preto venovať jej rovnaké alebo väčšie množstvo času ako biológii.</p><h2>Odporúčaný postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Zisti presnú váhu jednotlivých častí na konkrétnej fakulte.</li><li>Zopakuj si organickú aj anorganickú chémiu na úrovni maturity, s dôrazom na funkčné skupiny a reakcie.</li><li>Prejdi biológiu so zameraním na bunku a fyziológiu človeka.</li><li>Súbežne trénuj VŠP, ktoré tvorí často najväčšiu časť bodového hodnotenia.</li></ol>' + CTA_SK,
  title_cs: 'Přijímačky na farmacii: co očekávat a jak se připravit',
  excerpt_cs: 'Farmaceutické fakulty kombinují VŠP/OSP s biologií a chemií. Vysvětlujeme, jaký je typický formát a na co se soustředit při přípravě.',
  tag_cs: 'Farmácia', read_time_cs: '6 min čtení',
  content_cs: '<p>Farmacie patří mezi konkurenční zdravotnické obory, kde se formát přijímaček často podobá medicíně — kombinace všeobecných studijních předpokladů s vědomostním testem z biologie a chemie.</p><h2>Typický formát testu</h2><ul><li>všeobecné studijní předpoklady (verbální a analytická část),</li><li>chemie — důraz na anorganickou i organickou chemii, protože je pro farmacii klíčová,</li><li>biologie — zejména buněčná biologie a fyziologie člověka.</li></ul><h2>Proč je chemie důležitější než u medicíny</h2><p>U farmacie má chemie většinou větší váhu než u všeobecné medicíny, protože přímo souvisí s pozdějším studiem léků, jejich složení a účinků. Vyplatí se jí proto věnovat stejné nebo větší množství času jako biologii.</p><h2>Doporučený postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Zjisti přesnou váhu jednotlivých částí na konkrétní fakultě.</li><li>Zopakuj si organickou i anorganickou chemii na úrovni maturity, s důrazem na funkční skupiny a reakce.</li><li>Projdi biologii se zaměřením na buňku a fyziologii člověka.</li><li>Souběžně trénuj VŠP/OSP, které tvoří často největší část bodového hodnocení.</li></ol>' + CTA_CS
},
{
  slug: 'prijimacky-na-veterinu',
  title: 'Prijímačky na veterinárnu medicínu: ako sa pripraviť',
  excerpt: 'Veterinárne fakulty testujú VŠP aj biológiu so zameraním na anatómiu a fyziológiu zvierat. Prehľad formátu a odporúčaného postupu.',
  tag: 'Farmácia', read_time: '6 min čítania',
  content: '<p>Veterinárna medicína patrí medzi odbory s vysokým záujmom a limitovaným počtom miest, kde okrem všeobecných študijných predpokladov rozhoduje aj solídny základ z biológie.</p><h2>Čo sa najčastejšie skúša</h2><ul><li>všeobecné študijné predpoklady (verbálna a analytická časť),</li><li>biológia — bunková biológia, genetika, anatómia a fyziológia stavovcov,</li><li>na niektorých fakultách aj chémia na základnej úrovni.</li></ul><h2>Rozdiel oproti humánnej medicíne</h2><p>Zatiaľ čo humánna medicína sa sústreďuje na fyziológiu človeka, veterinárna biológia kladie väčší dôraz na porovnávaciu anatómiu a fyziológiu rôznych druhov zvierat — cicavcov, vtákov, ale aj základy o iných stavovcoch.</p><h2>Odporúčaný postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Over si presný formát testu na konkrétnej fakulte.</li><li>Zopakuj si biológiu so zameraním na anatómiu a fyziológiu, nielen na úroveň človeka.</li><li>Súbežne trénuj VŠP — verbálnu aj analytickú časť.</li><li>Posledný týždeň absolvuj plnú simuláciu za reálnych časových podmienok.</li></ol>' + CTA_SK,
  title_cs: 'Přijímačky na veterinární medicínu: jak se připravit',
  excerpt_cs: 'Veterinární fakulty testují VŠP/OSP i biologii se zaměřením na anatomii a fyziologii zvířat. Přehled formátu a doporučeného postupu.',
  tag_cs: 'Farmácia', read_time_cs: '6 min čtení',
  content_cs: '<p>Veterinární medicína patří mezi obory s vysokým zájmem a omezeným počtem míst, kde kromě všeobecných studijních předpokladů rozhoduje i solidní základ z biologie.</p><h2>Co se nejčastěji zkouší</h2><ul><li>všeobecné studijní předpoklady (verbální a analytická část),</li><li>biologie — buněčná biologie, genetika, anatomie a fyziologie obratlovců,</li><li>na některých fakultách i chemie na základní úrovni.</li></ul><h2>Rozdíl oproti humánní medicíně</h2><p>Zatímco humánní medicína se soustředí na fyziologii člověka, veterinární biologie klade větší důraz na srovnávací anatomii a fyziologii různých druhů zvířat — savců, ptáků, ale i základy o dalších obratlovcích.</p><h2>Doporučený postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Ověř si přesný formát testu na konkrétní fakultě.</li><li>Zopakuj si biologii se zaměřením na anatomii a fyziologii, ne jen na úroveň člověka.</li><li>Souběžně trénuj VŠP/OSP — verbální i analytickou část.</li><li>Poslední týden absolvuj plnou simulaci za reálných časových podmínek.</li></ol>' + CTA_CS
},
{
  slug: 'prijimacky-na-informatiku-it',
  title: 'Prijímačky na informatiku a IT: matematika a logika, na ktoré sa pripraviť',
  excerpt: 'IT fakulty najčastejšie kombinujú VŠP s matematikou a logickým myslením. Prehľad toho, čo sa oplatí naštudovať vopred.',
  tag: 'Technika', read_time: '6 min čítania',
  content: '<p>Informatika a IT odbory patria medzi tie, kde formát prijímačiek najviac závisí od konkrétnej školy — niektoré sa spoliehajú výlučne na VŠP, iné pridávajú matematiku alebo test logického myslenia.</p><h2>Typický formát</h2><ul><li>všeobecné študijné predpoklady s dôrazom na analytickú časť,</li><li>matematika na úrovni strednej školy — funkcie, rovnice, kombinatorika,</li><li>logické a informatické myslenie — číselné sústavy, algoritmické uvažovanie, výroková logika.</li></ul><h2>Prečo analytická časť VŠP tak dobre predikuje úspech</h2><p>Analytická časť VŠP trénuje presne tie zručnosti, ktoré IT vyžaduje — rozklad problému na kroky, prácu s logickými vzťahmi a rýchle rozpoznávanie vzorov. Kto je silný v tejto časti, má prirodzenú výhodu aj pri programovaní.</p><h2>Odporúčaný postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Zisti presný formát testu na konkrétnej fakulte.</li><li>Trénuj analytickú časť VŠP, najmä logické úlohy a zebry.</li><li>Zopakuj si stredoškolskú matematiku — funkcie, sústavy rovníc, kombinatoriku.</li><li>Ak je súčasťou testu, precvič si aj výrokovú logiku a číselné sústavy.</li></ol>' + CTA_SK,
  title_cs: 'Přijímačky na informatiku a IT: matematika a logika, na které se připravit',
  excerpt_cs: 'IT fakulty nejčastěji kombinují VŠP/OSP s matematikou a logickým myšlením. Přehled toho, co se vyplatí nastudovat předem.',
  tag_cs: 'Technika', read_time_cs: '6 min čtení',
  content_cs: '<p>Informatika a IT obory patří mezi ty, kde formát přijímaček nejvíc závisí na konkrétní škole — některé se spoléhají výhradně na VŠP/OSP, jiné přidávají matematiku nebo test logického myšlení.</p><h2>Typický formát</h2><ul><li>všeobecné studijní předpoklady s důrazem na analytickou část,</li><li>matematika na úrovni střední školy — funkce, rovnice, kombinatorika,</li><li>logické a informatické myšlení — číselné soustavy, algoritmické uvažování, výroková logika.</li></ul><h2>Proč analytická část VŠP tak dobře predikuje úspěch</h2><p>Analytická část VŠP/OSP trénuje přesně ty dovednosti, které IT vyžaduje — rozklad problému na kroky, práci s logickými vztahy a rychlé rozpoznávání vzorů. Kdo je silný v této části, má přirozenou výhodu i při programování.</p><h2>Doporučený postup</h2><ol style="margin-left:1.2rem;color:var(--text2)"><li>Zjisti přesný formát testu na konkrétní fakultě.</li><li>Trénuj analytickou část VŠP/OSP, zejména logické úlohy a zebry.</li><li>Zopakuj si středoškolskou matematiku — funkce, soustavy rovnic, kombinatoriku.</li><li>Pokud je součástí testu, procvič si i výrokovou logiku a číselné soustavy.</li></ol>' + CTA_CS
}
];

(async () => {
  let inserted = 0, skipped = 0;
  for (const row of ROWS) {
    const { data: existing, error: selErr } = await supabase
      .from('blog_posts')
      .select('slug')
      .eq('slug', row.slug)
      .maybeSingle();

    if (selErr) {
      console.error(`❌ Chyba pri kontrole ${row.slug}:`, selErr.message);
      continue;
    }
    if (existing) {
      console.log(`⏭  ${row.slug} už existuje, preskakujem.`);
      skipped++;
      continue;
    }

    const { error: insErr } = await supabase.from('blog_posts').insert(row);
    if (insErr) {
      console.error(`❌ Chyba pri vkladaní ${row.slug}:`, insErr.message);
      continue;
    }
    console.log(`✅ Vložené: ${row.slug}`);
    inserted++;
  }
  console.log(`\nHotovo. Vložených: ${inserted}, preskočených (už existovali): ${skipped}, spolu: ${ROWS.length}.`);
})();
