// Konfigurácia súťaže "/sutaz" — JEDINÝ zdroj pravdy pre termíny, ceny,
// odkazy a stav. VŠETKY údaje nižšie sú zatiaľ NEVYPLNENÉ (štatút súťaže
// nebol k implementácii priložený) -- podľa zadania sa pri chýbajúcich
// zásadných údajoch má zobraziť pracovný stav a NEUMOŽNIŤ odoslanie
// prihlášky. Toto je presne ten stav, v akom je appka teraz.
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
    count: null,          // napr. 3
    valueEachEur: null,   // napr. 50
    currency: 'EUR',
    deliveryMethod: null, // napr. "elektronicky na e-mail výhercu do 30 dní od žrebovania"
    validityNote: null    // napr. "platnosť poukážky 12 mesiacov od vystavenia"
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

  eligibility: {
    minAge: 18,
    residency: 'Slovenská republika',
    requiresPaidAccess: true,
    requiresCompletedTest: true,
    minCompletedTests: 1,
    admissionScope: null, // napr. "denné bakalárske štúdium na verejnej/štátnej VŠ v SR alebo ČR"
    oneEntryPerPerson: true,
    activeSubscriptionRequiredAtDraw: false
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
