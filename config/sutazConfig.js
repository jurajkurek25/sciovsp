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
  status: 'coming_soon',

  // Martinus musí byť explicitne potvrdený ako partner, inak appka
  // vždy zobrazuje "Martinus nie je organizátorom ani partnerom súťaže."
  // a nikde nesmie byť logo/spojenie "SP TRENER × Martinus".
  martinusPartnershipConfirmed: false,

  prizes: {
    // Počet poukážok a ich hodnota -- zobrazené len keď OBOJE vyplnené.
    // Štatút (čl. V) odporúča hodnotu JEDNEJ poukážky do 350 EUR -- nad
    // tým sa už zdaňuje presah (§9 ods.2 písm. m) zákona č. 595/2003 Z.z.).
    count: null,          // napr. 3
    valueEachEur: null,   // napr. 50
    currency: 'EUR',
    deliveryMethod: null, // elektronické/fyzické + spôsob uplatnenia (čl. V ods. 2)
    validityNote: null,   // platnosť poukážky (čl. V ods. 2)
    taxFreeThresholdEur: 350 // §9 ods. 2 písm. m) zákona č. 595/2003 Z.z. -- fakt zo zákona, nezávislý od zvolenej hodnoty
  },

  dates: {
    // Všetky dátumy ako ISO stringy ("YYYY-MM-DD") alebo null.
    serviceUsageFrom: null,     // od kedy musí byť SP TRENER aktívne používaný
    serviceUsageTo: null,
    admissionPeriodFrom: null,  // obdobie, kedy musí byť doručené rozhodnutie o prijatí
    admissionPeriodTo: null,
    applicationDeadline: null,  // uzávierka prihlášok do súťaže
    drawDate: null              // dátum žrebovania
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
    residency: 'Slovenská republika',
    requiresPaidAccess: true,
    requiresCompletedTest: true,
    minCompletedTests: 1, // musí byť dokončený PRED doručením rozhodnutia o prijatí (čl. III ods. 1) -- appka vie overiť len aktuálny počet, nie časovú súvislosť s dátumom prijatia (žiadne dáta o časovaní jednotlivých testov), pozri POZNÁMKA nižšie
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
    fullStatuteUrl: null,     // odkaz na úplné znenie štatútu (PDF/stránka)
    privacyPolicyUrl: '/legal#ochrana-udajov',
    organizerContactEmail: null,
    organizerName: null       // presný obchodný názov organizátora podľa štatútu
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
