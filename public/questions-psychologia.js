/**
 * Banka otázok — príprava na prijímacie skúšky
 * Bakalársky program Psychológia, UCM v Trnave (Filozofická fakulta)
 *
 * Okruhy podľa oficiálnych podkladov UCM FF:
 *   1. Biológia človeka
 *   2. Filozofia
 *   3. Psychológia
 *
 * Každá otázka: { id, section, topic, question, options[4], answer(index), explanation }
 */

window.PSYCH_QUESTIONS = [

  // ═══════════════════════════════════════════
  // 1. BIOLÓGIA ČLOVEKA
  // ═══════════════════════════════════════════
  { id:'b1', section:'biologia', topic:'Kostra a oporná sústava',
    question:'Koľko kostí tvorí kostru dospelého človeka?',
    options:['asi 106','asi 206','asi 306','asi 406'], answer:1,
    explanation:'Kostra dospelého človeka sa skladá z približne 206 kostí.' },

  { id:'b2', section:'biologia', topic:'Kostra a oporná sústava',
    question:'Aký typ kĺbu je ramenný a bedrový kĺb?',
    options:['Pántový','Guľový','Otočný','Plochý'], answer:1,
    explanation:'Guľový kĺb umožňuje pohyb vo všetkých smeroch — typický je pre ramenný a bedrový kĺb.' },

  { id:'b3', section:'biologia', topic:'Svalová sústava',
    question:'Približne aké percento telesnej hmotnosti tvoria svaly?',
    options:['10 %','25 %','40 %','60 %'], answer:2,
    explanation:'Svaly tvoria približne 40 % telesnej hmotnosti.' },

  { id:'b4', section:'biologia', topic:'Svalová sústava',
    question:'Ktorý typ svalu pracuje automaticky po celý život a nie je ovládaný vedome?',
    options:['Kostrový sval','Hladký sval','Srdcový sval','Mimický sval'], answer:2,
    explanation:'Srdcový sval je špeciálny typ svalu, ktorý pracuje automaticky po celý život.' },

  { id:'b5', section:'biologia', topic:'Kožná sústava',
    question:'Ktorý orgán je najväčším orgánom ľudského tela?',
    options:['Pečeň','Koža','Pľúca','Hrubé črevo'], answer:1,
    explanation:'Koža má rozlohu približne 2 m² a je najväčším orgánom ľudského tela.' },

  { id:'b6', section:'biologia', topic:'Tráviaca sústava',
    question:'Ktorá látka/enzým v žalúdku rozkladá bielkoviny?',
    options:['Amyláza','Pepsín','Lipáza','Trypsín'], answer:1,
    explanation:'V kyslom prostredí žalúdka (HCl) rozkladá bielkoviny enzým pepsín.' },

  { id:'b7', section:'biologia', topic:'Tráviaca sústava',
    question:'Kde v tráviacej sústave prebieha hlavné vstrebávanie živín?',
    options:['V žalúdku','V hrubom čreve','V tenkom čreve','V pažeráku'], answer:2,
    explanation:'Tenké črevo je hlavné miesto vstrebávania živín, kde pôsobia pankreatické enzýmy a žlč.' },

  { id:'b8', section:'biologia', topic:'Dýchacia sústava',
    question:'Kde v pľúcach prebieha výmena plynov?',
    options:['V priedušnici','V hrtane','V alveoloch (pľúcnych mechúrikoch)','V nosovej dutine'], answer:2,
    explanation:'Výmena kyslíka a oxidu uhličitého prebieha v alveoloch (pľúcnych mechúrikoch).' },

  { id:'b9', section:'biologia', topic:'Obehová sústava',
    question:'Aká je typická pokojová srdcová frekvencia dospelého človeka?',
    options:['30-50 úderov/min','60-80 úderov/min','100-120 úderov/min','140-160 úderov/min'], answer:1,
    explanation:'Srdcová frekvencia v pokoji je typicky 60-80 úderov za minútu.' },

  { id:'b10', section:'biologia', topic:'Obehová sústava',
    question:'Ktoré krvinky zabezpečujú zrážanie krvi?',
    options:['Erytrocyty (červené krvinky)','Leukocyty (biele krvinky)','Trombocyty (krvné doštičky)','Plazmatické bunky'], answer:2,
    explanation:'Krvné doštičky (trombocyty) zabezpečujú zrážanie krvi.' },

  { id:'b11', section:'biologia', topic:'Vylučovacia sústava',
    question:'Ako sa nazýva základná funkčná jednotka obličky?',
    options:['Neurón','Nefrón','Alveolus','Glomerul'], answer:1,
    explanation:'Nefrón je základná funkčná jednotka obličky; každá oblička ich obsahuje približne 1 milión.' },

  { id:'b12', section:'biologia', topic:'Nervová sústava',
    question:'V ktorej časti mozgu sa nachádza dýchacie centrum riadiace dýchanie?',
    options:['V mozočku','V talame','V predĺženej mieche (mozgovom kmeni)','V hypofýze'], answer:2,
    explanation:'Dýchanie je riadené dýchacím centrom v predĺženej mieche.' },

  { id:'b13', section:'biologia', topic:'Nervová sústava',
    question:'Ktorá časť neurónu prijíma signály od iných neurónov?',
    options:['Axón','Dendrity','Myelínová pošva','Synapsia'], answer:1,
    explanation:'Dendrity prijímajú signály, axón ich naopak posiela ďalej.' },

  { id:'b14', section:'biologia', topic:'Nervová sústava',
    question:"Ktorá zložka autonómnej nervovej sústavy mobilizuje organizmus v strese?",
    options:['Parasympatikus','Sympatikus','Somatická sústava','Periférna sústava'], answer:1,
    explanation:'Sympatikus zabezpečuje mobilizáciu organizmu (stresovú reakciu), parasympatikus naopak upokojenie a regeneráciu.' },

  { id:'b15', section:'biologia', topic:'Hormonálna sústava',
    question:'Ktorá žľaza s vnútornou sekréciou je hlavnou riadiacou žľazou endokrinného systému?',
    options:['Štítna žľaza','Nadoblička','Hypofýza','Podžalúdková žľaza'], answer:2,
    explanation:'Hypofýza je hlavná riadiaca žľaza — produkuje rastový hormón a hormóny regulujúce ostatné žľazy.' },

  { id:'b16', section:'biologia', topic:'Hormonálna sústava',
    question:'Ktorý hormón znižuje hladinu cukru v krvi?',
    options:['Glukagón','Inzulín','Adrenalín','Kortizol'], answer:1,
    explanation:'Podžalúdková žľaza reguluje hladinu cukru v krvi inzulínom (znižuje) a glukagónom (zvyšuje).' },

  { id:'b17', section:'biologia', topic:'Genetika človeka',
    question:'Koľko chromozómov obsahuje bežná ľudská somatická bunka?',
    options:['23','44','46','48'], answer:2,
    explanation:'Človek má 46 chromozómov v 23 pároch (diploidná sada); pohlavné bunky majú 23 (haploidná sada).' },

  { id:'b18', section:'biologia', topic:'Genetika človeka',
    question:'Downov syndróm je spôsobený:',
    options:['Mutáciou jedného génu','Trizómiou 21. chromozómu','Nedostatkom hormónov štítnej žľazy','Vírusovou infekciou počas tehotenstva'], answer:1,
    explanation:'Downov syndróm je chromozómová choroba spôsobená trizómiou 21. chromozómu.' },

  { id:'b19', section:'biologia', topic:'Zdravý životný štýl',
    question:'Ktorý faktor podľa učebnice ovplyvňuje zdravie človeka najviac?',
    options:['Genetika a biológia (20 %)','Životný štýl a správanie (50 %)','Životné prostredie (20 %)','Zdravotná starostlivosť (10 %)'], answer:1,
    explanation:'Životný štýl a správanie tvoria približne 50 % faktorov ovplyvňujúcich zdravie.' },

  { id:'b20', section:'biologia', topic:'Zdravý životný štýl',
    question:'Koľko minút strednej intenzity aeróbnej aktivity týždenne odporúča WHO dospelým?',
    options:['30 minút','75 minút','150 minút','300 minút'], answer:2,
    explanation:'WHO odporúča minimálne 150 minút strednej intenzity (alebo 75 minút vysokej intenzity) aeróbnej aktivity týždenne.' },

  { id:'b21', section:'biologia', topic:'Zdravý životný štýl',
    question:'Od akej hodnoty BMI hovoríme o obezite?',
    options:['BMI > 20','BMI > 25','BMI > 30','BMI > 40'], answer:2,
    explanation:'Obezita je definovaná ako nadmerné hromadenie tuku v tele pri BMI vyššom ako 30.' },

  // ═══════════════════════════════════════════
  // 2. FILOZOFIA
  // ═══════════════════════════════════════════
  { id:'f1', section:'filozofia', topic:'Filozofia ako veda',
    question:"Slovo 'filozofia' pochádza z gréčtiny a v preklade znamená:",
    options:['Náuka o prírode','Láska k múdrosti','Umenie presviedčania','Cesta k šťastiu'], answer:1,
    explanation:'Filozofia = philos (láska) + sophia (múdrosť) = láska k múdrosti.' },

  { id:'f2', section:'filozofia', topic:'Filozofia ako veda',
    question:'Ktorá filozofická disciplína sa zaoberá otázkou, čo existuje a ako to existuje?',
    options:['Etika','Estetika','Ontológia','Logika'], answer:2,
    explanation:'Ontológia je náuka o bytí — o tom, čo existuje a ako to existuje.' },

  { id:'f3', section:'filozofia', topic:'Antická filozofia — predsokratovci',
    question:'Ktorý predsokratovský filozof považoval za prapočiatok (arché) všetkých vecí vodu?',
    options:['Anaximandros','Táles z Milétu','Pytagoras','Hérakleitos'], answer:1,
    explanation:'Táles z Milétu, prvý filozof, videl arché vo vode.' },

  { id:'f4', section:'filozofia', topic:'Antická filozofia — predsokratovci',
    question:"Hérakleitov výrok 'panta rhei' znamená:",
    options:['Všetko je jedno','Všetko plynie','Nič neexistuje','Človek je mierou všetkých vecí'], answer:1,
    explanation:"Hérakleitos hlásal, že všetko plynie (panta rhei), za prapočiatok považoval oheň." },

  { id:'f5', section:'filozofia', topic:'Klasická grécka filozofia',
    question:"Ktorý filozof je autorom výroku 'Poznaj sám seba' a metódy maieutiky (pôrodnej metódy)?",
    options:['Platón','Aristoteles','Sokrates','Protagoras'], answer:2,
    explanation:'Sokrates používal dialóg a maieutiku; sám nič nenapísal a bol odsúdený na smrť pitím bolehlavu.' },

  { id:'f6', section:'filozofia', topic:'Klasická grécka filozofia',
    question:'Platónova teória ideí rozlišuje:',
    options:['Hmotu a formu','Svet ideí a svet vecí','Rozum a cit','Bytie a nebytie'], answer:1,
    explanation:'Podľa Platóna existuje svet ideí (pravá, nemenná realita) a svet vecí (nestále kópie ideí).' },

  { id:'f7', section:'filozofia', topic:'Klasická grécka filozofia',
    question:'Kto je považovaný za zakladateľa logiky a zároveň odmietol Platónovu teóriu ideí?',
    options:['Sokrates','Aristoteles','Demokritos','Epikúros'], answer:1,
    explanation:'Aristoteles, žiak Platóna, odmietol teóriu ideí — podľa neho je podstata (forma) vo veciach samých.' },

  { id:'f8', section:'filozofia', topic:'Klasická grécka filozofia',
    question:'Podľa Aristotela je cnosť (areté):',
    options:['Vrodená vlastnosť, ktorú nemožno zmeniť','Stred medzi nedostatkom a nadbytkom','Dar bohov','Výsledok logického dôkazu'], answer:1,
    explanation:'Aristotelova etika chápe cnosť ako stred medzi nedostatkom a nadbytkom (napr. odvaha medzi zbabelosťou a bezhlavosťou).' },

  { id:'f9', section:'filozofia', topic:'Helenistická filozofia',
    question:'Hlavným cieľom epikureizmu je dosiahnutie:',
    options:['Slávy a bohatstva','Ataraxie (duševného pokoja)','Politickej moci','Extázy'], answer:1,
    explanation:'Epikureizmus kladie za cieľ ataraxiu (duševný pokoj) a apóniu (neprítomnosť bolesti).' },

  { id:'f10', section:'filozofia', topic:'Helenistická filozofia',
    question:'Stoici zdôrazňovali život v súlade s:',
    options:['Vášňami a citmi','Spoločenskými konvenciami','Prírodou a rozumom (logos)','Náhodou'], answer:2,
    explanation:'Stoicizmus učil žiť v súlade s prírodou a rozumom (logos) a rozlišovať, čo od nás závisí a čo nie.' },

  { id:'f11', section:'filozofia', topic:'Stredoveká filozofia — patristika',
    question:"Kto je autorom výroku 'Verím, aby som rozumel'?",
    options:['Tomáš Akvinský','Anselm z Canterbury','Augustín z Hippa','Ockham'], answer:2,
    explanation:'Augustín z Hippa, najvýznamnejší cirkevný otec, spája neoplatonizmus s kresťanstvom.' },

  { id:'f12', section:'filozofia', topic:'Stredoveká filozofia — scholastika',
    question:'Tomáš Akvinský je predstaviteľom:',
    options:['Nominalizmu','Tomizmu — syntézy aristotelizmu s kresťanstvom','Novoplatonizmu','Skepticizmu'], answer:1,
    explanation:'Tomáš Akvinský vytvoril tomizmus, syntézu Aristotelovej filozofie s kresťanskou teológiou (Summa theologica).' },

  { id:'f13', section:'filozofia', topic:'Stredoveká filozofia — spor o univerzálie',
    question:'V stredovekom spore o univerzálie tvrdí nominalizmus (Ockham), že:',
    options:['Univerzálie existujú nezávisle od vecí (ante res)','Univerzálie existujú len v mysli (in rebus)','Iba jednotlivé veci sú reálne, univerzálie sú len mená (post res)','Univerzálie sú totožné s Bohom'], answer:2,
    explanation:'Nominalizmus (Ockham) tvrdí, že reálne sú iba jednotlivé veci, univerzálie sú len mená.' },

  { id:'f14', section:'filozofia', topic:'Klasická novoveká filozofia — racionalizmus',
    question:"Descartov výrok 'Cogito ergo sum' znamená:",
    options:['Som, teda myslím','Myslím, teda som','Pochybujem, teda existujem','Poznávam, teda som slobodný'], answer:1,
    explanation:"René Descartes dospel metodickou pochybnosťou k prvej istote: 'Myslím, teda som.'" },

  { id:'f15', section:'filozofia', topic:'Klasická novoveká filozofia — empirizmus',
    question:"Ktorý filozof zaviedol pojem 'tabula rasa' pre ľudskú myseľ pri narodení?",
    options:['René Descartes','John Locke','Gottfried Leibniz','Baruch Spinoza'], answer:1,
    explanation:'John Locke tvrdil, že myseľ je pri narodení tabula rasa (čistá tabuľka) a všetko poznanie pochádza zo skúsenosti.' },

  { id:'f16', section:'filozofia', topic:'Klasická novoveká filozofia — empirizmus',
    question:'Podľa Davida Huma je kauzalita (príčinná súvislosť):',
    options:['Vrodená idea','Nevyhnutné logické spojenie','Len zvyk vyplývajúci zo skúsenosti','Božský zákon'], answer:2,
    explanation:'Hume tvrdil, že kauzalita je len zvyk, nie nevyhnutné spojenie — je to jadro jeho skepticizmu.' },

  { id:'f17', section:'filozofia', topic:'Immanuel Kant',
    question:'Kantov kategorický imperatív požaduje konať tak, aby:',
    options:['Maxima nášho konania mohla platiť ako všeobecný zákon','Sme dosiahli čo najväčšie potešenie','Sme sa vyhli akémukoľvek riziku','Sme poslúchali autority'], answer:0,
    explanation:"Kategorický imperatív: 'Konaj tak, aby maxima tvojho konania mohla platiť ako všeobecný zákon.'" },

  { id:'f18', section:'filozofia', topic:'Moderná filozofia od 19. storočia',
    question:'Hegelova dialektika prebieha v triáde:',
    options:['Bytie – nebytie – stávanie sa','Téza – antitéza – syntéza','Id – ego – superego','Arché – logos – étos'], answer:1,
    explanation:'Hegelova dialektika (téza-antitéza-syntéza) opisuje dejiny ako sebarealizáciu absolútneho ducha.' },

  { id:'f19', section:'filozofia', topic:'Moderná filozofia od 19. storočia',
    question:"Nietzscheho výrok 'Boh je mŕtvy' súvisí s jeho kritikou:",
    options:['Vedeckého pokroku','Kresťanskej (otrockej) morálky','Gréckej mytológie','Demokracie'], answer:1,
    explanation:'Nietzsche kritizoval kresťanstvo a morálku otrokov, hlásal prehodnotenie všetkých hodnôt a myšlienku nadčloveka.' },

  { id:'f20', section:'filozofia', topic:'Filozofia od 20. storočia',
    question:"Sartrov výrok 'Existencia predchádza esenciu' je charakteristický pre:",
    options:['Fenomenológiu','Existencializmus','Pozitivizmus','Racionalizmus'], answer:1,
    explanation:'Jean-Paul Sartre je kľúčovým predstaviteľom existencializmu — človek je odsúdený byť slobodný.' },

  { id:'f21', section:'filozofia', topic:'Filozofia od 20. storočia',
    question:"Kto je zakladateľom fenomenológie a autorom hesla 'Späť k samým veciam'?",
    options:['Martin Heidegger','Edmund Husserl','Jean-Paul Sartre','Ludwig Wittgenstein'], answer:1,
    explanation:'Edmund Husserl založil fenomenológiu; kľúčové pojmy sú epoché a intencionalita vedomia.' },

  { id:'f22', section:'filozofia', topic:'Slovenská filozofia',
    question:'Ktorý slovenský mysliteľ je počas národného obrodenia (19. storočie) spájaný s myšlienkou jazyka ako nositeľa ducha národa?',
    options:['Ladislav Hanus','Milan Kusý','Ľudovít Štúr','Svätopluk Štúr'], answer:2,
    explanation:'Ľudovít Štúr rozvíjal filozofiu slovenského národa a chápal jazyk ako nositeľa ducha národa.' },

  // ═══════════════════════════════════════════
  // 3. PSYCHOLÓGIA
  // ═══════════════════════════════════════════
  { id:'p1', section:'psychologia', topic:'Psychológia ako veda',
    question:'V ktorom roku a kde založil Wilhelm Wundt prvé psychologické laboratórium?',
    options:['1879, Lipsko','1900, Viedeň','1850, Londýn','1920, New York'], answer:0,
    explanation:'Psychológia vznikla ako samostatná veda v roku 1879, keď Wilhelm Wundt založil prvé psychologické laboratórium v Lipsku.' },

  { id:'p2', section:'psychologia', topic:'Psychológia ako veda',
    question:"Slovo 'psychológia' je zložené z gréckych slov, ktoré v preklade znamenajú:",
    options:['Náuka o tele','Náuka o duši','Náuka o správaní','Náuka o mysli a hmote'], answer:1,
    explanation:'Psychológia = psyché (duša) + logos (slovo, náuka) = náuka o duši.' },

  { id:'p3', section:'psychologia', topic:'Metódy psychológie',
    question:'Ktorá výskumná metóda zámerne manipuluje nezávislú premennú za kontrolovaných podmienok?',
    options:['Pozorovanie','Dotazník','Experiment','Prípadová štúdia'], answer:2,
    explanation:'Experiment cielene ovplyvňuje nezávislú premennú a meria jej vplyv na závislú premennú.' },

  { id:'p4', section:'psychologia', topic:'Metódy psychológie',
    question:'Aká je typická nevýhoda dotazníkovej metódy?',
    options:['Vysoké finančné náklady','Sociálna žiaducosť odpovedí a nízka návratnosť','Nemožnosť anonymity','Nutnosť osobného kontaktu'], answer:1,
    explanation:'Dotazník má výhodu veľkého počtu respondentov, ale nevýhodou je nízka návratnosť a sociálna žiaducosť odpovedí.' },

  { id:'p5', section:'psychologia', topic:'Metódy psychológie',
    question:'Rorschachov test atramentových škvŕn je príkladom:',
    options:['Výkonového testu','Inteligenčného testu','Projektívneho testu','Dotazníka osobnosti'], answer:2,
    explanation:'Rorschachov test a TAT patria medzi projektívne testy.' },

  { id:'p6', section:'psychologia', topic:'Psychologické smery — behaviorizmus',
    question:"Kto je zakladateľom behaviorizmu a autorom manifestu 'Psychológia ako ju vníma behaviorista' (1913)?",
    options:['B.F. Skinner','John B. Watson','Ivan Pavlov','Wilhelm Wundt'], answer:1,
    explanation:'John B. Watson založil behaviorizmus — psychológia má skúmať iba pozorovateľné správanie.' },

  { id:'p7', section:'psychologia', topic:'Psychologické smery — behaviorizmus',
    question:'Klasické podmieňovanie (pes, zvon, sliny) skúmal:',
    options:['B.F. Skinner','Sigmund Freud','Ivan Pavlov','John B. Watson'], answer:2,
    explanation:'Ivan Pavlov opísal klasické podmieňovanie na svojom klasickom experimente s psom, zvonom a slinením.' },

  { id:'p8', section:'psychologia', topic:'Psychologické smery — behaviorizmus',
    question:'Operantné podmieňovanie a posilňovanie (odmena/trest) skúmal:',
    options:['Ivan Pavlov','B.F. Skinner','Carl Rogers','Jean Piaget'], answer:1,
    explanation:'B.F. Skinner rozpracoval operantné podmieňovanie a pozitívne/negatívne posilňovanie.' },

  { id:'p9', section:'psychologia', topic:'Psychologické smery — psychoanalýza',
    question:'Zakladateľom psychoanalýzy je:',
    options:['Carl Gustav Jung','Alfred Adler','Sigmund Freud','Erik Erikson'], answer:2,
    explanation:'Sigmund Freud vo Viedni založil psychoanalýzu, ktorá zdôrazňuje úlohu nevedomia.' },

  { id:'p10', section:'psychologia', topic:'Psychologické smery — psychoanalýza',
    question:"Vo Freudovej štruktúre osobnosti predstavuje 'id' (ono):",
    options:['Morálku a svedomie','Primárne pudové popudy riadené princípom slasti','Racionálne sprostredkovanie medzi pudmi a realitou','Ideálne self'], answer:1,
    explanation:'Id je najprimitívnejšia zložka osobnosti — pudové popudy riadené princípom slasti; ego sprostredkúva realitu, superego je svedomie.' },

  { id:'p11', section:'psychologia', topic:'Psychologické smery — psychoanalýza',
    question:'Nevedomé vytláčanie nepríjemných myšlienok a spomienok z vedomia sa v psychoanalýze nazýva:',
    options:['Projekcia','Racionalizácia','Vytesnenie','Sublimácia'], answer:2,
    explanation:'Vytesnenie je obranný mechanizmus, pri ktorom nepríjemné obsahy vytláčame z vedomia do nevedomia.' },

  { id:'p12', section:'psychologia', topic:'Psychologické smery — psychoanalýza',
    question:"Pojem 'kolektívne nevedomie' a 'archetypy' zaviedol do psychológie:",
    options:['Sigmund Freud','Carl Gustav Jung','Alfred Adler','Erik Erikson'], answer:1,
    explanation:'C.G. Jung, zakladateľ analytickej psychológie, pracoval s pojmami kolektívne nevedomie a archetypy (tieň, anima/animus, self).' },

  { id:'p13', section:'psychologia', topic:'Psychologické smery — psychoanalýza',
    question:'Alfred Adler je zakladateľom individuálnej psychológie a autorom pojmu:',
    options:['Kolektívne nevedomie','Komplex menejcennosti','Kognitívna disonancia','Operantné podmieňovanie'], answer:1,
    explanation:'Adler rozpracoval pojmy komplex menejcennosti, kompenzácia a životný štýl.' },

  { id:'p14', section:'psychologia', topic:'Psychologické smery — humanistická psychológia',
    question:'Humanistická psychológia (50.-60. roky 20. storočia) sa označuje ako:',
    options:['Prvá sila','Druhá sila','Tretia sila','Štvrtá sila'], answer:2,
    explanation:'Humanistická psychológia vznikla ako "tretia sila" po behaviorizme a psychoanalýze.' },

  { id:'p15', section:'psychologia', topic:'Psychologické smery — humanistická psychológia',
    question:'Na vrchole Maslowovej hierarchie potrieb sa nachádza:',
    options:['Potreba bezpečia','Potreba úcty','Sebarealizácia','Fyziologické potreby'], answer:2,
    explanation:'Maslowova pyramída potrieb vrcholí sebarealizáciou.' },

  { id:'p16', section:'psychologia', topic:'Psychologické smery — humanistická psychológia',
    question:'Carl Rogers je predstaviteľom:',
    options:['Psychoanalýzy','Behaviorizmu','Klientsky centrovanej terapie','Gestalt psychológie'], answer:2,
    explanation:'Carl Rogers rozvíjal klientsky centrovanú terapiu založenú na bezpodmienečnom pozitívnom prijatí, empatii a kongruencii.' },

  { id:'p17', section:'psychologia', topic:'Psychologické smery — kognitívna psychológia',
    question:"'Kognitívna revolúcia' v psychológii nastala v:",
    options:['20. rokoch 20. storočia','40. rokoch 20. storočia','60. rokoch 20. storočia','90. rokoch 20. storočia'], answer:2,
    explanation:'Kognitívna psychológia sa presadila v 60. rokoch 20. storočia ako "kognitívna revolúcia".' },

  { id:'p18', section:'psychologia', topic:'Psychologické smery — kognitívna psychológia',
    question:'Jean Piaget je známy svojím výskumom:',
    options:['Klasického podmieňovania','Kognitívneho vývinu dieťaťa','Psychosexuálnych štádií','Sociálnej percepcie'], answer:1,
    explanation:'Jean Piaget opísal štádiá kognitívneho vývinu dieťaťa: senzomotorické, predoperačné, konkrétnych operácií, formálnych operácií.' },

  { id:'p19', section:'psychologia', topic:'Psychologické smery — gestalt psychológia',
    question:'Gestalt psychológia zdôrazňuje princíp, podľa ktorého:',
    options:['Správanie je len súčtom podnetov a reakcií','Celok je viac než súčet jeho častí','Osobnosť tvoria id, ego a superego','Poznanie pochádza výlučne zo skúsenosti'], answer:1,
    explanation:'Gestalt psychológia (Wertheimer, Köhler, Koffka) hlása, že celok je viac než súčet častí, a skúma zákony organizácie vnímania.' },

  { id:'p20', section:'psychologia', topic:'Pamäť',
    question:'Podľa Atkinsonovho-Shiffrinovho modelu je kapacita krátkodobej (pracovnej) pamäti približne:',
    options:['2±1 položky','7±2 položky','15±3 položky','neobmedzená'], answer:1,
    explanation:'Krátkodobá pamäť má objem 7±2 položky a trvá približne 20 sekúnd.' },

  { id:'p21', section:'psychologia', topic:'Pamäť',
    question:'Explicitná (deklaratívna) dlhodobá pamäť sa delí na:',
    options:['Senzorickú a procedurálnu','Epizodickú a sémantickú','Krátkodobú a dlhodobú','Vizuálnu a auditívnu'], answer:1,
    explanation:'Explicitná pamäť zahŕňa epizodickú (udalosti) a sémantickú (fakty) zložku; implicitná pamäť zase automatické zručnosti.' },

  { id:'p22', section:'psychologia', topic:'Pamäť',
    question:'Krivku zabúdania, ktorá popisuje rýchlosť straty naučených informácií v čase, skúmal:',
    options:['Wilhelm Wundt','Hermann Ebbinghaus','Jean Piaget','B.F. Skinner'], answer:1,
    explanation:'Hermann Ebbinghaus je autorom klasickej krivky zabúdania.' },

  { id:'p23', section:'psychologia', topic:'Myslenie',
    question:'Rozdiel medzi algoritmom a heuristikou pri riešení problémov spočíva v tom, že:',
    options:['Algoritmus je náhodný postup, heuristika presný','Algoritmus je presný postup vedúci k riešeniu, heuristika je skratka (pravidlo palca)','Oba pojmy sú synonymá','Heuristika sa používa len v matematike'], answer:1,
    explanation:'Algoritmus je presný postup, heuristika je skratka/pravidlo palca, ktoré nemusí vždy viesť k správnemu riešeniu.' },

  { id:'p24', section:'psychologia', topic:'Inteligencia',
    question:'Priemerná hodnota IQ v štandardizovaných testoch inteligencie je nastavená na:',
    options:['85','100','115','130'], answer:1,
    explanation:'IQ skóre je štandardizované s priemerom 100 a štandardnou odchýlkou 15.' },

  { id:'p25', section:'psychologia', topic:'Inteligencia',
    question:'Ktorý autor rozpracoval teóriu viacnásobnej inteligencie (lingvistická, priestorová, hudobná atď.)?',
    options:['Charles Spearman','Louis Thurstone','Howard Gardner','Robert Sternberg'], answer:2,
    explanation:'Gardner rozlišuje viacero typov inteligencie — napr. lingvistickú, logicko-matematickú, priestorovú, hudobnú, telesno-kinestetickú.' },

  { id:'p26', section:'psychologia', topic:'Emócie',
    question:'Medzi základné, kultúrne univerzálne emócie podľa Paula Ekmana NEPATRÍ:',
    options:['Radosť','Strach','Žiarlivosť','Odpor'], answer:2,
    explanation:'Ekman uvádza šesť základných emócií: radosť, smútok, strach, hnev, odpor, prekvapenie — žiarlivosť medzi ne nepatrí.' },

  { id:'p27', section:'psychologia', topic:'Emócie',
    question:'James-Langeho teória emócií tvrdí, že:',
    options:['Emócia a fyziologická reakcia vznikajú súčasne','Najprv vzniká fyziologická reakcia, potom emócia','Emócia vzniká len na základe kognitívneho hodnotenia','Emócie sú úplne nezávislé od tela'], answer:1,
    explanation:'Podľa James-Langeho teórie najprv nastáva fyziologická reakcia a z jej vnímania potom vzniká emócia ("utekáme, preto sa bojíme").' },

  { id:'p28', section:'psychologia', topic:'Ontogenéza psychiky',
    question:'Podľa Eriksonovej teórie psychosociálneho vývinu je hlavnou úlohou obdobia adolescencie:',
    options:['Autonómia vs. hanba a pochybnosti','Iniciatíva vs. vina','Identita vs. zmätok rolí','Intimita vs. izolácia'], answer:2,
    explanation:'V adolescencii rieši jedinec podľa Eriksona konflikt identita vs. zmätok rolí.' },

  { id:'p29', section:'psychologia', topic:'Ontogenéza psychiky',
    question:'Výskum citovej väzby (attachment) medzi dieťaťom a opatrovateľom je spojený s menami:',
    options:['Piaget a Vygotskij','Bowlby a Ainsworth','Freud a Jung','Maslow a Rogers'], answer:1,
    explanation:'Bowlby a Ainsworth skúmali citovú väzbu (attachment) a jej typy — secure, insecure-avoidant, insecure-resistant, disorganized.' },

  { id:'p30', section:'psychologia', topic:'Psychológia osobnosti',
    question:'Podľa antickej humorálnej typológie (Hippokrates, Galén) je cholerik typ osobnosti spájaný s:',
    options:['Krvou — živý typ','Žlčou — výbušný typ','Hlienom — pomalý typ','Čiernou žlčou — smutný typ'], answer:1,
    explanation:'Hippokratova-Galénova typológia: sangvinik (krv), cholerik (žlč), flegmatik (hlien), melancholik (čierna žlč).' },

  { id:'p31', section:'psychologia', topic:'Psychológia osobnosti',
    question:"Model 'Big Five' (päťfaktorový model osobnosti) zahŕňa okrem iného:",
    options:['Temperament, charakter, vôľu, city, schopnosti','Otvorenosť, svedomitosť, extraverziu, prívetivosť, neurotizmus','Id, ego, superego, libido, archetypy','Sangvinik, cholerik, flegmatik, melancholik'], answer:1,
    explanation:'Big Five tvorí päť dimenzií: otvorenosť voči skúsenostiam, svedomitosť, extraverzia, prívetivosť, neurotizmus.' },

  { id:'p32', section:'psychologia', topic:'Duševné zdravie a stres',
    question:'Selyeho syndróm všeobecnej adaptácie (GAS) na stres má fázy:',
    options:['Popretie – hnev – prijatie','Alarm – rezistencia – vyčerpanie','Vzrušenie – plató – uvoľnenie','Iniciácia – adaptácia – regresia'], answer:1,
    explanation:'Selyeho GAS má tri fázy: alarm, rezistencia a vyčerpanie.' },

  { id:'p33', section:'psychologia', topic:'Bio-psycho-sociálny model',
    question:'Bio-psycho-sociálny model chápania človeka zdôrazňuje, že napríklad depresia môže mať:',
    options:['Výlučne biologické príčiny','Len sociálne príčiny','Biologické, psychologické aj sociálne príčiny súčasne','Iba genetické príčiny'], answer:2,
    explanation:'Bio-psycho-sociálny model zdôrazňuje interakciu biologických (napr. nízky serotonín), psychologických (negatívne myslenie) a sociálnych (strata práce, samota) faktorov.' },

];
