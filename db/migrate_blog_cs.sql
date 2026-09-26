-- SP Tréner — pridáva český preklad k blog_posts a dopĺňa ho pre
-- existujúce 4 články zo seed_blog.sql.
-- Idempotentné — bezpečné spúšťať opakovane (ADD COLUMN IF NOT EXISTS,
-- UPDATE prepíše _cs stĺpce na aktuálny preklad, nie je to INSERT).
-- Spustiť: psql $DATABASE_URL -f db/migrate_blog_cs.sql
--
-- DÔLEŽITÉ (Supabase): keď sa táto migrácia spúšťa priamym psql pripojením
-- (nie cez Supabase Studio/SQL Editor), PostgREST — vrstva, cez ktorú ide
-- supabase.from('blog_posts')... v server.js — má vlastnú cache schémy
-- tabuľky a o nových stĺpcoch sa nemusí dozvedieť hneď. Preto skript na
-- konci pošle "NOTIFY pgrst, 'reload schema'", aby si to Supabase API
-- ihneď všimlo. Bez tohto by /blog vedel skončiť s "0 článkov" aj keď
-- stĺpce aj dáta v Postgrese reálne existujú.

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS title_cs TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS excerpt_cs TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS content_cs TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tag_cs TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS read_time_cs TEXT;

UPDATE blog_posts SET
  title_cs = 'Jak se připravit na VŠP testy: kompletní průvodce',
  excerpt_cs = 'Verbální i analytická část, plán přípravy na 4 týdny a nejdůležitější návyky, které rozhodují o percentilu víc než talent.',
  tag_cs = 'Příprava',
  read_time_cs = '8 min čtení',
  content_cs = $html$
<p>Všeobecné studijní předpoklady (VŠP, na části fakult i pod zkratkou OSP) jsou test, který se dá — na rozdíl od toho, co si většina uchazečů myslí — natrénovat. Neměří „vrozenou inteligenci" ve smyslu, v jakém si to lidé představují. Měří, jak rychle a přesně umíš pracovat s textem, čísly a logickými vztahy pod časovým tlakem. A to je dovednost, která se zlepšuje opakováním úplně stejně jako cokoliv jiné.</p>

<h2>Co přesně test měří</h2>
<p>VŠP/OSP se většinou dělí na dvě části: <strong>verbální</strong> a <strong>analytickou</strong>. Obě mají společné jádro — nejde o vědomosti, ale o to, jak rychle umíš vyvozovat závěry ze zadaných informací. Proto se to nedá „nabiflovat" přes noc, ale dá se to výrazně zlepšit tréninkem vzorů úloh, které se v testech opakují.</p>

<h2>Verbální část</h2>
<p>Zde se nejčastěji objevují:</p>
<ul>
  <li>doplňování do vět (výběr dvojice/trojice slov, které do textu sedí významově i stylisticky),</li>
  <li>analogie („X : Y = ? : ?"),</li>
  <li>koherence textu — najít jednu větu, která do celku nezapadá,</li>
  <li>vyvozování z krátkých textů a porozumění delším textům.</li>
</ul>
<p>Nejčastější chyba: uchazeči se snaží text „pochopit do hloubky", místo aby si všímali <em>přesně toho, co v textu je a co není napsáno</em>. Při vyvozování platí přísné pravidlo — tvrzení musí vyplývat z textu, ne z toho, co si o tématu myslíš ty sám.</p>

<h2>Analytická část</h2>
<p>Zde jde spíš o práci s čísly a logikou:</p>
<ul>
  <li>čtení grafů a tabulek,</li>
  <li>porovnávání číselných výrazů,</li>
  <li>slovní úlohy (procenta, rychlost, práce, pravděpodobnost),</li>
  <li>postačující podmínky,</li>
  <li>logické úlohy typu „zebra".</li>
</ul>
<p>Tato část se nejvíc zlepšuje objemem natrénovaných úloh — čím víc typů jsi viděl, tím rychleji rozpoznáš vzor a nemusíš počítat od nuly.</p>

<h2>Plán přípravy na 4 týdny</h2>
<h3>1. – 2. týden</h3>
<p>Průměrně 30–45 minut denně. Cílem není rychlost, ale přesnost — ověř si, které typy úloh ti dělají problém, a tam soustřeď většinu času. Po každém testu si projdi vysvětlení i u úloh, které jsi měl správně — často se ukáže, že jsi se trefil náhodou.</p>
<h3>3. týden</h3>
<p>Přechod na cvičení na čas. Zkus řešit bloky úloh přesně v limitu, jaký bude platit na ostré zkoušce. Většina uchazečů neztrácí body na vědomostech, ale na špatně rozvrženém čase — příliš dlouho se zaseknou na jedné těžké úloze a ztratí body na jednodušších, které přijdou později.</p>
<h3>4. týden</h3>
<p>Alespoň dvě plné simulace testu za reálných podmínek (jedno posezení, bez přestávky, s časovým limitem). Cílem je zvyknout si na délku soustředění, kterou bude potřeba udržet na ostré zkoušce.</p>

<h2>Den D</h2>
<p>Den před testem už netrénuj nové typy úloh — jen si zopakuj vysvětlení k těm, kde jsi nejčastěji chyboval. Na samotném testu si nejdřív projdi celý blok a vyřeš to, co umíš rychle — těžší úlohy nech na konec, ať ti neseberou čas, který potřebuješ jinde.</p>

<p>V SP Tréner najdeš neomezené cvičné testy pro verbální i analytickou část, AI generátor nových úloh na konkrétní téma a analýzu toho, kde přesně ztrácíš body — přesně to, co potřebuješ k tomu, aby ses čtyři týdny připravoval efektivně, ne jen dlouho.</p>
$html$
WHERE slug = 'ako-sa-pripravit-na-vsp-testy';

UPDATE blog_posts SET
  title_cs = 'Přijímačky na psychologii (UCM Trnava): co očekávat a jak se připravit',
  excerpt_cs = 'Struktura přijímacího testu na psychologii, nejčastěji zkoušené okruhy a doporučený postup přípravy pro uchazeče.',
  tag_cs = 'Psychologie',
  read_time_cs = '7 min čtení',
  content_cs = $html$
<p>Psychologie patří mezi obory s vysokým zájmem a omezeným počtem míst, proto přijímací test rozhoduje. Na rozdíl od čistě vědomostních testů kombinuje všeobecné studijní předpoklady s okruhem psychologicko-pedagogického základu — tedy věcné znalosti z oboru, který ses (zatím) formálně neučil.</p>

<h2>Z čeho se test obvykle skládá</h2>
<p>Uchazeči o psychologii (např. na UCM v Trnavě) se nejčastěji setkávají s kombinací:</p>
<ul>
  <li>všeobecných studijních předpokladů (verbální a analytická část, stejně jako u jiných oborů),</li>
  <li>vědomostního okruhu psychologie a pedagogika — základy oboru, které se dají nastudovat předem.</li>
</ul>

<h2>Okruhy, které se vyplatí nastudovat</h2>
<ul>
  <li><strong>Psychologie jako věda</strong> — její metody, historie, hlavní disciplíny.</li>
  <li><strong>Psychologické směry</strong> — behaviorismus, psychoanalýza, humanistická psychologie, kognitivní psychologie, gestalt.</li>
  <li><strong>Psychické procesy</strong> — vnímání, paměť, myšlení, emoce, motivace.</li>
  <li><strong>Psychologie osobnosti</strong> — typologie, teorie osobnosti.</li>
  <li><strong>Ontogeneze psychiky</strong> — vývojová stádia podle Piageta, Eriksona, Vygotského.</li>
  <li><strong>Duševní zdraví a stres</strong> — základní pojmy, obranné mechanismy, zvládání zátěže.</li>
</ul>
<p>Nejde o to znát obor do hloubky jako po prvním ročníku — testy ověřují základní orientaci a schopnost logicky uvažovat o psychologických konceptech, ne encyklopedické detaily.</p>

<h2>Jak se nejčastěji chybuje</h2>
<p>Uchazeči většinou podcení právě vědomostní část — spoléhají na to, že „psychologii rozumí" z běžného života, a nevěnují čas terminologii jednotlivých směrů. Přitom rozdíl mezi odpovědí „behaviorismus" a „kognitivní psychologie" v konkrétní testové otázce je často jen v jednom klíčovém pojmu, který je třeba znát přesně.</p>

<h2>Doporučený postup</h2>
<ol style="margin-left:1.2rem;color:var(--text2)">
  <li>Ověř si aktuální strukturu přijímacího řízení přímo na stránce fakulty — kritéria se mohou rok od roku měnit.</li>
  <li>Projdi si systematicky okruhy výše — stačí přehledový, ne učebnicový rozsah.</li>
  <li>Kombinuj to s tréninkem verbální a analytické části, která tvoří druhou polovinu testu.</li>
  <li>Poslední týden absolvuj alespoň jednu plnou simulaci na čas.</li>
</ol>

<p>V SP Tréner najdeš samostatný okruh <em>Pedagogicko-psychologický základ</em> s cvičnými otázkami přesně na tato témata, i AI generátor, který ti na požádání vytvoří nové úlohy na konkrétní podokruh, kde si ještě nejsi jistý.</p>
$html$
WHERE slug = 'prijimacky-na-psychologiu-ucm-trnava';

UPDATE blog_posts SET
  title_cs = '7 nejčastějších chyb při přípravě na přijímací testy',
  excerpt_cs = 'Od špatného rozvržení času až po ignorování vysvětlení u správných odpovědí — chyby, které stojí nejvíc percentilů a dají se snadno opravit.',
  tag_cs = 'Příprava',
  read_time_cs = '6 min čtení',
  content_cs = $html$
<p>Při přípravě na VŠP/OSP a oborové přijímací testy se většina bodů neztrácí na chybějících vědomostech, ale na opakovaných chybách v přístupu. Tady je sedm nejčastějších — a co s nimi.</p>

<h2>1. Příprava bez časového limitu</h2>
<p>Řešit úlohy bez stopek je jiná dovednost než je řešit pod tlakem. Pokud trénuješ jen „nanečisto", na ostré zkoušce tě překvapí, kolik úloh musíš vyřešit za minutu.</p>

<h2>2. Ignorování vysvětlení u správných odpovědí</h2>
<p>Pokud jsi úlohu vyřešil správně, ale nejistě nebo hádáním, a vysvětlení sis nepřečetl, za týden uděláš stejnou chybu na jiné verzi téže úlohy. Vysvětlení se vyplatí přečíst vždy, nejen u chyb.</p>

<h2>3. Trénování jen oblíbené části</h2>
<p>Je přirozené věnovat víc času tomu, co jde dobře — je to příjemnější. Body se ale získávají právě ve slabší části, kde je prostor pro největší posun.</p>

<h2>4. Příliš dlouhé zasekávání se na jedné úloze</h2>
<p>Jedna těžká úloha může „sníst" čas na tři jednoduché. Pokud úloha nejde do 60–90 sekund, označ si ji a vrať se k ní na konci.</p>

<h2>5. Příprava „narychlo" těsně před testem</h2>
<p>Jeden maraton cvičení den před zkouškou nenahradí rozložený trénink. Krátká, pravidelná sezení (30–45 minut denně) budují rychlost rozpoznávání vzorů lépe než nárazová příprava.</p>

<h2>6. Podcenění vědomostních okruhů (tam, kde jsou součástí testu)</h2>
<p>U oborů jako právo, psychologie či pedagogika je součástí testu i věcný vědomostní okruh. Spoléhat se jen na „logické myšlení" a vynechat nastudování základních pojmů je zbytečná ztráta bodů, které se dají získat jednoduše.</p>

<h2>7. Žádná simulace ostrých podmínek</h2>
<p>Sedět celý test najednou, bez přerušení, s reálným časovým limitem, je jiná zátěž než řešit deset úloh mezi přestávkami. Alespoň jedna až dvě plné simulace před zkouškou tě připraví i psychicky, nejen věcně.</p>

<p>Každá z těchto chyb se dá opravit jednoduše — potřebuješ jen nástroj, který ti dá dostatek cvičných testů na čas a ukáže přesně, kde ztrácíš body. Přesně na to slouží SP Tréner.</p>
$html$
WHERE slug = '7-najcastejsich-chyb-pri-priprave-na-prijimacky';

UPDATE blog_posts SET
  title_cs = 'Analytická část VŠP: jak zvládnout grafy, tabulky a slovní úlohy pod tlakem času',
  excerpt_cs = 'Postup pro nejčastější typy analytických úloh — od čtení grafů po zebry — a triky, které šetří čas na ostré zkoušce.',
  tag_cs = 'Analytická část',
  read_time_cs = '7 min čtení',
  content_cs = $html$
<p>Analytická část VŠP/OSP testů je pro většinu uchazečů náročnější než verbální — ne proto, že by byla matematicky složitější, ale protože kombinuje víc typů úloh, které vyžadují jiný způsob uvažování, a to všechno pod tvrdým časovým limitem.</p>

<h2>Grafy a tabulky</h2>
<p>Nejčastější chyba je snažit se přečíst celý graf předtím, než víš, na co se vlastně ptá otázka. Postup, který šetří čas:</p>
<ol style="margin-left:1.2rem;color:var(--text2)">
  <li>nejdřív si přečti otázku,</li>
  <li>až poté se v grafu dívej přesně na ty hodnoty, které k odpovědi potřebuješ,</li>
  <li>počítej jen to, co je nezbytné — není třeba přepočítávat celou tabulku.</li>
</ol>

<h2>Porovnávání hodnot</h2>
<p>U úloh typu „porovnej výraz vlevo a vpravo" se většinou není nutné dopočítat k přesnému výsledku. Stačí zjednodušit oba výrazy natolik, aby bylo jasné, který je větší — přesné číslo často ani nepotřebuješ.</p>

<h2>Slovní úlohy</h2>
<p>Procenta, rychlost, práce, pravděpodobnost — tyto typy se opakují v podobných variacích. Vyplatí se mít zažitý „šablonovitý" postup pro každý typ (např. u úloh na společnou práci vždy pracovat s převrácenými hodnotami časů), abys na ostré zkoušce nemusel odvozovat vzorec od začátku.</p>

<h2>Postačující podmínky</h2>
<p>Zde se nejčastěji chybuje unáhlením — uchazeč vidí, že podmínka „vypadá" dostatečně, a nevšimne si okrajový případ, ve kterém neplatí. Vždy si ověř i hraniční hodnoty (nula, záporná čísla, rovnost), nejen typický případ.</p>

<h2>Logické úlohy (zebry)</h2>
<p>Nejefektivnější postup je vypsat si podmínky do jednoduché tabulky místo toho, abys si je držel v hlavě. Začni od nejkonkrétnější podmínky (té, která přímo přiřazuje hodnotu) a postupně vylučuj možnosti — ne od nejobecnější.</p>

<h2>Jak trénovat rychlost</h2>
<p>Rychlost v analytické části není o tom, že počítáš rychleji — je o tom, že rychleji <em>rozpoznáš</em>, jakým postupem se má úloha řešit. To se buduje jen opakováním velkého množství úloh podobného typu, ideálně s okamžitou zpětnou vazbou a vysvětlením postupu.</p>

<p>Analytickou část najdeš v SP Tréner jako samostatný okruh cvičných testů i s AI generátorem nových úloh na konkrétní typ (grafy, postačující podmínky, zebry a další), takže si dokážeš doslova „domakat" přesně ten typ úlohy, který ti dělá nejvíc problémů.</p>
$html$
WHERE slug = 'analyticka-cast-vsp-grafy-tabulky-slovne-ulohy';

-- Prinúti Supabase API (PostgREST) hneď si všimnúť nové stĺpce —
-- bez tohto vie /blog cez supabase-js skončiť s prázdnym zoznamom
-- článkov aj keď dáta v Postgrese reálne existujú.
NOTIFY pgrst, 'reload schema';
