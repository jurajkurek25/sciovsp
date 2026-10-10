// Konfigurácia súťaže "/sutaz" — JEDINÝ zdroj pravdy pre termíny, ceny,
// odkazy a stav. Zdroj: "Statut-sutaze-SP-TRENER.md" (pracovný návrh,
// 10. 10. 2026) -- dokument sám seba označuje ako návrh a má veľa polí
// v [HRANATÝCH ZÁTVORKÁCH], ktoré treba doplniť pred zverejnením.
// Polia nižšie, ktoré boli v návrhu PLNE vypísané (nie v zátvorkách) sú
// vyplnené reálnym textom. Polia, ktoré boli v zátvorkách (organizátor,
// dátumy, počet/hodnota výhier, odkazy) ostávajú null -- podľa zadania
// sa pri chýbajúcich zásadných údajoch zobrazí pracovný stav a
// NEUMOŽNÍ sa odoslanie prihlášky, kým ich niekto nedoplní.
//
// Juraj: vyplň nižšie uvedené polia podľa reálneho štatútu súťaže. Keď
// budú vyplnené všetky polia v "required" zozname (pozri isConfigComplete
// nižšie), stránka automaticky:
//   - zobrazí skutočné termíny/ceny namiesto "pripravujeme"
//   - povolí odoslanie prihlášky (ak je status 'open')
//   - prepne CTA tlačidlá z disabled na aktívne
//
// status: 'coming_soon' | 'open' | 'closed' | 'results'
//   coming_soon -- súťaž sa ešte nespustila / konfigurácia nie je kompletná
//   open        -- prihlasovanie otvorené, formulár aktívny
//   closed      -- uzávierka prebehla, žrebovanie sa ešte nekonalo
//   results     -- výsledky žrebovania sú známe (resultsUrl/resultsText)

const SUTAZ_CONFIG = {
  status: 'open',

  // Martinus musí byť explicitne potvrdený ako partner, inak appka
  // vždy zobrazuje "Martinus nie je organizátorom ani partnerom súťaže."
  // a nikde nesmie byť logo/spojenie "SP TRENER × Martinus".
  martinusPartnershipConfirmed: false,

  // Súťaž rozšírená na SR + ČR so SPOLOČNÝM žrebovaním (jeden zoznam
  // účastníkov, ktorákoľvek cena môže ísť účastníkovi z ktorejkoľvek
  // krajiny) -- rozhodnuté 2026 na základe konzultácie: zdieľané
  // žrebovanie je pri propagačných súťažiach bežne možné, nie je to
  // osobitná zákonná výnimka, podmienky musia vyhovovať právu OBOCH
  // krajín súčasne. Pred reálnym spustením MUSIA byť doplnené:
  //   - voucherUsableInBothCountries: overiť u Martinus, že SK poukážka
  //     funguje aj na CZ webe (alebo zabezpečiť CZ variant)
  //   - czTaxFreeThresholdEur: slovenská hranica 350 € (§9 ods.2 písm. m)
  //     zák. č. 595/2003 Z.z.) sa NEPRENÁŠA na českého výhercu -- zistiť
  //     a doplniť český ekvivalent
  //   - cena služby (bežná appka, mimo tohto configu) sa kvôli súťaži
  //     nesmie umelo navýšiť -- v ČR by rozdiel medzi účtovanou a
  //     obvyklou cenou mohol byť posúdený ako "stávka"
  prizes: {
    // Počet poukážok a ich hodnota -- zobrazené len keď OBOJE vyplnené.
    // Štatút (čl. V) odporúča hodnotu JEDNEJ poukážky do 350 EUR -- nad
    // tým sa už zdaňuje presah (§9 ods.2 písm. m) zákona č. 595/2003 Z.z.,
    // platí len pre SK výhercu, pozri czTaxFreeThresholdEur nižšie).
    count: 1,
    valueEachEur: 100,
    currency: 'EUR',
    deliveryMethod: 'elektronicky e-mailom na kontaktný e-mail uvedený v prihláške',
    validityNote: null,   // platnosť poukážky (čl. V ods. 2) -- ešte nepotvrdené
    taxFreeThresholdEur: 350,   // SK hranica, §9 ods. 2 písm. m) zák. č. 595/2003 Z.z. -- platí len pre výhercu s bydliskom v SR
    // Český ekvivalent: §4 odst. 1 písm. f) zákona č. 586/1992 Sb. (ZDP),
    // výhry z reklamných/verejných súťaží osvobodené do 10 000 Kč. Prepočet
    // na EUR je približný (kurz sa mení) -- pri hodnote výhry 100 € je to
    // jedno, presah pod oboma hranicami je rádovo väčší než výhra.
    czTaxFreeThresholdEur: 400,
    // Nie je to jedna univerzálna poukážka pre obe krajiny -- SK výherca
    // dostane poukážku na martinus.sk, ČR výherca na martinus.cz (dva
    // samostatné varianty podľa bydliska, potvrdené). Bez partnerstva s
    // Martinus (martinusPartnershipConfirmed) ide o bežný retailový nákup
    // poukážky na oboch weboch, nie o špeciálnu dohodu.
    voucherUsableInBothCountries: false
  },

  dates: {
    // Všetky dátumy ako ISO stringy ("YYYY-MM-DD") alebo null.
    serviceUsageFrom: '2026-10-10',     // od kedy musí byť SP TRENER aktívne používaný
    serviceUsageTo: '2027-08-31',
    admissionPeriodFrom: '2026-10-10',  // obdobie, kedy musí byť doručené rozhodnutie o prijatí
    admissionPeriodTo: '2027-08-31',
    applicationDeadline: '2027-09-09',  // uzávierka prihlášok do súťaže
    drawDate: '2027-09-14'              // dátum žrebovania -- 5 dní po uzávierke na kontrolu prihlášok
  },

  // Mechanika žrebovania (čl. VI) -- pravidlá sú hotové, len počet
  // náhradníkov ostáva v návrhu ako [POČET NÁHRADNÍKOV].
  draw: {
    alternatesCount: null, // čl. VI ods. 1
    applicationReviewDays: 14, // potvrdenie prijatia prihlášky do žrebovania (čl. IV ods. 5)
    clarificationResponseDays: 7, // lehota na doplnenie pri nejasnosti (čl. IV ods. 4)
    winnerContactDays: 5, // kontaktovanie výhercu po žrebovaní (čl. VI ods. 4)
    winnerConfirmDays: 14, // lehota výhercu na potvrdenie + doručovacie údaje (čl. VI ods. 4)
    prizeDeliveryDays: 30, // odoslanie výhry od potvrdenia (čl. VI ods. 6)
    winnerCodesPublishedDays: 7 // zverejnenie súťažných kódov výhercov (čl. VI ods. 7) -- LEN kódy, nie mená
  },

  eligibility: {
    minAge: 18, // dovŕšené v deň podania prihlášky (čl. III ods. 1)
    // Rozšírené z pôvodného návrhu (len SR) na SR + ČR, spoločné
    // žrebovanie. Krajina účastníka = bydlisko DEKLAROVANÉ PRI
    // PRIHLÁSENÍ (nie občianstvo, nie krajina vysokej školy) -- jedna
    // osoba patrí vždy len do jednej skupiny.
    residencyCountries: ['Slovenská republika', 'Česká republika'],
    residency: 'Slovenská republika alebo Česká republika',
    requiresPaidAccess: true,
    requiresCompletedTest: true,
    minCompletedTests: 1, // musí byť dokončený PRED doručením rozhodnutia o prijatí (čl. III ods. 1) -- appka vie overiť len aktuálny počet, nie časovú súvislosť s dátumom prijatia (žiadne dáta o časovaní jednotlivých testov), pozri POZNÁMKA nižšie
    // "Aspoň mesiac používania" -- appka nemá log aktívneho používania,
    // najbližšia overiteľná vec je vek účtu (users.created_at, rovnaký
    // vzor ako min_account_age_days pri affiliate kampaniach). Vynucuje sa
    // v momente podania prihlášky: účet musí existovať aspoň toľkoto dní.
    minAccountAgeDays: 30,
    admissionScope: 'bakalárske alebo spojené vysokoškolské štúdium na vysokej škole v Slovenskej republike alebo Českej republike', // čl. III ods. 1
    admissionViaAppealRecognized: true, // prijatie po odvolaní sa uznáva, ak doručené v stanovenom období (čl. III ods. 2)
    enrollmentRequired: false, // zápis na štúdium sa nevyžaduje (čl. III ods. 2)
    oneEntryPerPerson: true, // jeden vstup bez ohľadu na počet účtov/testov/prijatí; max. jedna výhra na osobu (čl. III ods. 5)
    activeSubscriptionRequiredAtDraw: false, // predplatné nemusí byť aktívne pri prijatí, prihláške ani žrebovaní (čl. III ods. 3)
    thirdPartyCanPayAccess: true, // nákup môže uhradiť aj iná osoba, ak je prístup pridelený účtu účastníka (čl. III ods. 4)
    freeTrialSufficient: false, // bezplatný skúšobný prístup sám osebe podmienku nespĺňa (čl. III ods. 4)
    excludedPersonsNote: 'Vylúčený je organizátor, osoby zabezpečujúce kontrolu prihlášok alebo žrebovanie a ich manželia, partneri, rodičia, deti a súrodenci.' // čl. III ods. 6
  },

  links: {
    fullStatuteUrl: 'https://sptrener.online/sutaz/statut.pdf', // POZOR: súbor ešte nie je na serveri -- Juraj ho nahrá manuálne, over pred spustením že link reálne vráti dokument, inak 404 na verejnej stránke
    privacyPolicyUrl: '/legal#ochrana-udajov',
    organizerContactEmail: 'sutaz@sptrener.online',
    organizerName: 'Ngroup, s.r.o.', // sídlo: Dunajská 8, Bratislava -- Staré Mesto; IČO ešte nedoplnené (potrebné pre text štatútu, nie pre tento gate)
    organizerAddress: 'Dunajská 8, 811 08 Bratislava - Staré Mesto'
  },

  results: {
    // Vyplní sa len v stave 'results'
    announcementText: null,
    announcementUrl: null
  }
};

// Polia, ktoré MUSIA byť vyplnené, aby sa súťaž dala reálne spustiť
// (status 'open' + povolené odoslanie prihlášky). Ak čokoľvek z tohto
// chýba, frontend i backend sa správajú, ako by bol status 'coming_soon'
// bez ohľadu na to, čo je v poli `status` -- nedá sa to obísť zmenou
// jedného poľa.
function isConfigComplete(cfg) {
  const d = cfg.dates;
  const p = cfg.prizes;
  const l = cfg.links;
  return (
    p.count != null && p.valueEachEur != null && !!p.deliveryMethod &&
    // true AJ false sú platné, rozhodnuté stavy (SK/CZ môžu mať oddelené
    // poukážky) -- len null (nerozhodnuté) blokuje spustenie.
    p.voucherUsableInBothCountries !== null && p.czTaxFreeThresholdEur != null &&
    !!d.serviceUsageFrom && !!d.admissionPeriodFrom && !!d.admissionPeriodTo &&
    !!d.applicationDeadline && !!d.drawDate &&
    !!cfg.eligibility.admissionScope &&
    !!l.fullStatuteUrl && !!l.organizerContactEmail && !!l.organizerName
  );
}

// Efektívny stav, ktorý appka reálne použije (frontend aj backend musia
// použiť TOTO, nikdy priamo cfg.status).
function effectiveStatus(cfg) {
  if (!isConfigComplete(cfg)) return 'coming_soon';
  return cfg.status;
}

module.exports = { SUTAZ_CONFIG, isConfigComplete, effectiveStatus };
