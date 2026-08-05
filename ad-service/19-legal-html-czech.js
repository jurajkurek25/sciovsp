// Pridáva plný český preklad VOP + ochrany osobných údajov do legal.html a
// mení jazykový prepínač (SK/CZ) z presmerovania na homepage na skutočné
// prepnutie jazyka priamo na tejto stránke (obsah, nadpis stránky, meta
// description aj html lang atribút). Technika: každý preložiteľný textový
// uzol je zdvojený do dvoch <span class="i18n-sk">/<span class="i18n-cs">
// vedľa seba (nie duplikácia celých sekcií) — štruktúra HTML aj kotvy
// (#vop, #privacy) ostávajú jednoduché a jedinečné, prepína sa len
// viditeľnosť cez CSS triedu na <body>. Voľba jazyka sa ukladá do
// localStorage pod tým istým kľúčom ("vsp-lang"), aký už používa index.html,
// takže prechod medzi hlavnou stránkou a /legal.html je jazykovo konzistentný.
//
// Predpoklad: 16-unify-nav-footer-full.js už bol aplikovaný (očakáva
// aktuálny nav s .lang-switcher, ktorý zatiaľ len presmerúva na homepage).
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online/public:
//   node /root/ad-service/19-legal-html-czech.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'legal.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

function sp(sk, cs) {
  return `<span class="i18n-sk">${sk}</span><span class="i18n-cs">${cs}</span>`;
}

// ─── <head> ─────────────────────────────────────────────────────
const OLD_HEAD = `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Podmienky a ochrana osobných údajov — SP Tréner</title>
  <meta name="description" content="Všeobecné obchodné podmienky a zásady ochrany osobných údajov pre SP Tréner.">`;

const NEW_HEAD = `<!DOCTYPE html>
<html lang="sk" id="htmlRoot">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title id="pageTitle">Podmienky a ochrana osobných údajov — SP Tréner</title>
  <meta name="description" id="pageDesc" content="Všeobecné obchodné podmienky a zásady ochrany osobných údajov pre SP Tréner.">`;

// ─── CSS (pridáva i18n toggling + malý lang-switcher, ak ešte nie je) ──
const OLD_CSS_ANCHOR = `.nav-cta:hover {`;
const NEW_CSS_BLOCK = `.i18n-cs{display:none}
    body.lang-cs .i18n-sk{display:none}
    body.lang-cs .i18n-cs{display:inline}
    .nav-cta:hover {`;

// ─── NAV: lang-switcher prestane presmerovávať a prepne jazyk in-place ──
const OLD_NAV = `      <div class="lang-switcher">
        <button class="lang-btn" onclick="location.href='/?lang=sk'">SK</button>
        <button class="lang-btn" onclick="location.href='/?lang=cs'">CZ</button>
      </div>`;

const NEW_NAV = `      <div class="lang-switcher">
        <button class="lang-btn" onclick="setLanguage('sk')">SK</button>
        <button class="lang-btn" onclick="setLanguage('cs')">CZ</button>
      </div>`;

// ─── BODY: ticker + celý obsah stránky + footer, so zdvojenými textami ──
const OLD_BODY = `  <div class="ticker-wrap">
    <div class="ticker-track">
      <div class="ticker-item">Digitálna služba <span>SaaS</span></div>
      <div class="ticker-item">Premium <span>9,90 € / mesiac</span></div>
      <div class="ticker-item">Elite <span>19,90 € / mesiac</span></div>
      <div class="ticker-item">Platby <span>Stripe</span></div>
      <div class="ticker-item">AI spracovanie <span>Claude · Anthropic</span></div>
      <div class="ticker-item">Právo <span>SR / CZ štandard</span></div>

      <div class="ticker-item">Digitálna služba <span>SaaS</span></div>
      <div class="ticker-item">Premium <span>9,90 € / mesiac</span></div>
      <div class="ticker-item">Elite <span>19,90 € / mesiac</span></div>
      <div class="ticker-item">Platby <span>Stripe</span></div>
      <div class="ticker-item">AI spracovanie <span>Claude · Anthropic</span></div>
      <div class="ticker-item">Právo <span>SR / CZ štandard</span></div>
    </div>
  </div>

  <main class="page">
    <section class="section">
      <div class="section-header">
        <div class="section-label">Prehľad</div>
        <h2 class="section-title">Kto službu <em>prevádzkuje</em></h2>
        <p class="section-intro">
          Tieto dokumenty sa vzťahujú na online službu SP Tréner, ktorú prevádzkuje spoločnosť Ngroup, s. r. o.
        </p>
      </div>

      <div class="grid">
        <div class="card highlight">
          <div class="meta-list">
            <div class="meta-item">
              <span class="meta-label">Prevádzkovateľ</span>
              <div class="meta-value">Ngroup, s. r. o.</div>
            </div>
            <div class="meta-item">
              <span class="meta-label">Sídlo</span>
              <div class="meta-value">Dunajská 8, 811 08 Bratislava, Slovenská republika</div>
            </div>
            <div class="meta-item">
              <span class="meta-label">Služba</span>
              <div class="meta-value">SP Tréner</div>
            </div>
            <div class="meta-item">
              <span class="meta-label">Typ služby</span>
              <div class="meta-value">Digitálny obsah a online SaaS aplikácia</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="meta-list">
            <div class="meta-item">
              <span class="meta-label">AI poskytovateľ</span>
              <div class="meta-value">Claude · Anthropic</div>
            </div>
            <div class="meta-item">
              <span class="meta-label">Platobná brána</span>
              <div class="meta-value">Stripe</div>
            </div>
            <div class="meta-item">
              <span class="meta-label">IČO</span>
              <div class="meta-value">53813189</div>
            </div>
            <div class="meta-item">
              <span class="meta-label">Kontaktný email</span>
              <div class="meta-value">juraj@jurajkurek.com</div>
            </div>
          </div>

        </div>
      </div>

      <div class="anchor-nav">
        <a class="anchor-link" href="#vop">Prejsť na VOP →</a>
        <a class="anchor-link" href="#privacy">Prejsť na ochranu údajov →</a>
      </div>
    </section>

    <section class="legal-section" id="vop">
      <div class="section-header">
        <div class="section-label">Dokument 01</div>
        <h2 class="section-title">Všeobecné obchodné <em>podmienky</em></h2>
        <p class="section-intro">
          Tieto VOP upravujú podmienky používania služby SP Tréner, podmienky predplatného, reklamácie,
          zodpovednosť a základné pravidlá využívania digitálneho obsahu.
        </p>
      </div>

      <div class="legal-block">
        <div class="legal-item">
          <h3>1. Základné ustanovenia</h3>
          <p>
            Tieto Všeobecné obchodné podmienky upravujú právne vzťahy medzi prevádzkovateľom služby a používateľom,
            ktorý využíva online službu „SP Tréner".
          </p>
          <p>
            Prevádzkovateľom služby je <strong>Ngroup, s. r. o.</strong>, so sídlom <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>,
            IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.
          </p>
        </div>

        <div class="legal-item">
          <h3>2. Charakter služby</h3>
          <p>
            SP Tréner je digitálny produkt poskytovaný online formou SaaS, určený na prípravu na testy všeobecných študijných predpokladov (VŠP).
          </p>
          <ul>
            <li>simulácie VŠP testov,</li>
            <li>AI generovanie úloh,</li>
            <li>analýzu výsledkov testov,</li>
            <li>personalizované odporúčania a sledovanie progresu,</li>
            <li>súkromné skupiny (SP Klany) a referral program medzi používateľmi.</li>
          </ul>
          <p>
            Služba nie je oficiálnym produktom žiadneho konkrétneho poskytovateľa testov všeobecných študijných predpokladov
            a nezaručuje konkrétny výsledok, percentil ani prijatie na vysokú školu.
          </p>
        </div>

        <div class="legal-item">
          <h3>3. Uzavretie zmluvy</h3>
          <p>
            Zmluvný vzťah medzi prevádzkovateľom a používateľom vzniká začatím používania služby alebo zakúpením plateného predplatného.
            Používateľ používaním služby potvrdzuje, že sa oboznámil s týmito VOP a súhlasí s nimi.
          </p>
        </div>

        <div class="legal-item">
          <h3>4. Bezplatná verzia</h3>
          <p>
            Prevádzkovateľ sprístupňuje používateľovi bezplatnú verziu služby, ktorá zahŕňa najmä 3 plné testové simulácie
            a základnú analýzu výsledkov, bez potreby zadania platobnej karty.
          </p>
          <p>
            Prevádzkovateľ si vyhradzuje právo rozsah bezplatnej verzie meniť, obmedziť alebo ukončiť bez predchádzajúceho upozornenia.
          </p>
        </div>

        <div class="legal-item">
          <h3>5. Predplatné a cena</h3>
          <p>
            Platený prístup je poskytovaný formou mesačného predplatného v dvoch úrovniach, podľa aktuálnej ponuky uvedenej na webovej stránke:
          </p>
          <div class="pricing-table">
            <div class="pricing-tier">
              <div class="pricing-tier-name">Free</div>
              <div class="pricing-tier-price">0 €</div>
              <div class="pricing-tier-note">3 testy, bez karty</div>
            </div>
            <div class="pricing-tier premium">
              <div class="pricing-tier-name">Premium</div>
              <div class="pricing-tier-price">9,90 € / mes.</div>
              <div class="pricing-tier-note">neobmedzené testy, AI generátor, SP Klany</div>
            </div>
            <div class="pricing-tier elite">
              <div class="pricing-tier-name">Elite</div>
              <div class="pricing-tier-price">19,90 € / mes.</div>
              <div class="pricing-tier-note">Premium + AI Mentor a ďalšie funkcie</div>
            </div>
          </div>
          <ul>
            <li>predplatné sa platí vopred za fakturačné obdobie,</li>
            <li>platby sú spracované prostredníctvom Stripe,</li>
            <li>prechod medzi úrovňami Premium a Elite je možný kedykoľvek v aplikácii,</li>
            <li>ceny môžu byť v budúcnosti zmenené, pričom zmena sa nedotkne už zaplateného obdobia.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>6. Automatické obnovenie predplatného</h3>
          <p>
            Zakúpením Premium alebo Elite prístupu používateľ berie na vedomie, že predplatné sa automaticky obnovuje
            na ďalšie fakturačné obdobie, pokiaľ nie je včas zrušené pred jeho obnovením.
          </p>
        </div>

        <div class="legal-item">
          <h3>7. Zrušenie predplatného</h3>
          <p>
            Používateľ môže predplatné zrušiť kedykoľvek cez používateľský účet, zákaznícky portál Stripe alebo kontaktovaním podpory.
          </p>
          <p>
            Po zrušení zostáva prístup k plateným funkciám aktívny do konca už zaplateného obdobia. Po jeho uplynutí sa účet prepne na bezplatný režim,
            ak je dostupný. Za nevyužité obdobie sa pomerná časť ceny nevracia, ak právny predpis neustanovuje inak.
          </p>
        </div>

        <div class="legal-item">
          <h3>8. Referral program a bonusové dni</h3>
          <p>
            Používateľ s aktívnym Premium alebo Elite prístupom môže získať a zdieľať referral kód. Ak nový používateľ tento kód
            použije pri kúpe predplatného, obom stranám môže byť pripísaný bonus vo forme dodatočných dní predplatného navyše
            k zaplatenému obdobiu, podľa aktuálnych podmienok programu uvedených na webovej stránke.
          </p>
          <p>
            Prevádzkovateľ si vyhradzuje právo podmienky referral programu, výšku bonusu aj jeho dostupnosť kedykoľvek zmeniť alebo ukončiť.
            Bonusové dni nemajú peňažnú hodnotu a nie je možné ich vyplatiť ani zameniť za hotovosť.
          </p>
        </div>

        <div class="legal-item">
          <h3>9. Digitálny obsah a odstúpenie od zmluvy</h3>
          <p>
            Služba predstavuje digitálny obsah dodávaný online bez fyzického nosiča. Používateľ výslovne súhlasí
            so začatím poskytovania digitálneho obsahu pred uplynutím lehoty na odstúpenie od zmluvy a berie na vedomie,
            že tým môže v rozsahu dovolenom právnymi predpismi stratiť právo na odstúpenie od zmluvy.
          </p>
        </div>

        <div class="legal-item">
          <h3>10. Reklamácie a dostupnosť služby</h3>
          <p>
            Používateľ je oprávnený reklamovať technické vady služby, najmä dlhodobú nedostupnosť, nefunkčnosť alebo nesprávne účtovanie.
          </p>
          <p>
            Reklamáciu je možné uplatniť na emailovej adrese <strong>juraj@jurajkurek.com</strong>.
            Prevádzkovateľ vybaví reklamáciu v primeranej lehote a v súlade s platnými právnymi predpismi.
          </p>
        </div>

        <div class="legal-item">
          <h3>11. AI služby a obmedzenie výstupov</h3>
          <p>
            Služba využíva AI technológie poskytované spoločnosťou Anthropic, najmä model Claude,
            na generovanie úloh a vytváranie odporúčaní po ukončení testu.
          </p>
          <p>
            Používateľ berie na vedomie, že AI výstupy môžu byť nepresné, neúplné alebo nevhodné
            a slúžia výlučne ako pomocný tréningový nástroj, nie ako odborné, právne, pedagogické alebo garančné stanovisko.
          </p>
        </div>

        <div class="legal-item">
          <h3>12. Zodpovednosť</h3>
          <p>
            Prevádzkovateľ nezodpovedá za individuálne výsledky používateľa v testoch, za jeho prijatie na školu,
            za rozhodnutia vykonané na základe AI odporúčaní ani za výpadky externých služieb tretích strán.
          </p>
          <p>
            Prevádzkovateľ zodpovedá len v rozsahu, ktorý výslovne vyžadujú kogentné právne predpisy.
          </p>
        </div>

        <div class="legal-item">
          <h3>13. Duševné vlastníctvo</h3>
          <p>
            Všetok obsah sprístupnený v rámci služby, vrátane testov, textov, štruktúr úloh, dizajnu, analytických výstupov a softvéru,
            je chránený právami duševného vlastníctva.
          </p>
          <ul>
            <li>je zakázané obsah kopírovať, šíriť alebo komerčne využívať bez súhlasu,</li>
            <li>je zakázané sprístupňovať účet tretím osobám, ak to služba výslovne nepovoľuje.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>14. Ukončenie účtu alebo služby</h3>
          <p>
            Prevádzkovateľ si vyhradzuje právo obmedziť alebo ukončiť účet používateľa, ak porušuje tieto VOP,
            používa službu zneužívajúcim spôsobom alebo zasahuje do jej bezpečnosti či funkčnosti.
          </p>
          <p>
            Prevádzkovateľ si zároveň vyhradzuje právo službu meniť, rozširovať, obmedziť alebo ukončiť.
          </p>
        </div>

        <div class="legal-item">
          <h3>15. Riešenie sporov</h3>
          <p>
            Na právne vzťahy sa vzťahuje právny poriadok Slovenskej republiky. Spotrebiteľ má právo obrátiť sa aj na
            Slovenskú obchodnú inšpekciu alebo využiť alternatívne riešenie spotrebiteľských sporov, ak sú na to splnené zákonné podmienky.
          </p>
        </div>

        <div class="legal-item">
          <h3>16. Záverečné ustanovenia</h3>
          <p>
            Prevádzkovateľ si vyhradzuje právo tieto VOP meniť. Nové znenie je účinné dňom zverejnenia, ak nie je uvedené inak.
          </p>
          <p>
            Posledná aktualizácia: <strong>30.7.2026</strong>.
          </p>
        </div>
      </div>
    </section>

    <section class="legal-section" id="privacy">
      <div class="section-header">
        <div class="section-label">Dokument 02</div>
        <h2 class="section-title">Zásady ochrany <em>osobných údajov</em></h2>
        <p class="section-intro">
          Tento dokument vysvetľuje, aké údaje spracúvaš, na aký účel, na akom právnom základe
          a aké práva majú používatelia služby SP Tréner.
        </p>
      </div>

      <div class="legal-block">
        <div class="legal-item">
          <h3>1. Prevádzkovateľ osobných údajov</h3>
          <p>
            Prevádzkovateľom osobných údajov je <strong>Ngroup, s. r. o.</strong>, Dunajská 8, 811 08 Bratislava,
            Slovenská republika, IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.
          </p>
        </div>

        <div class="legal-item">
          <h3>2. Aké údaje spracúvame</h3>
          <p>V závislosti od spôsobu používania služby môžeme spracúvať najmä:</p>
          <ul>
            <li>identifikačné a kontaktné údaje, napríklad email,</li>
            <li>prihlasovacie a účtové údaje,</li>
            <li>odpovede používateľa v testoch a výsledky testov,</li>
            <li>údaje o používaní služby, histórii aktivít a progres tracking,</li>
            <li>údaje o referral kóde a jeho použití, ak sa používateľ zapojí do referral programu,</li>
            <li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>3. Účely spracúvania</h3>
          <p>Osobné údaje spracúvame najmä na tieto účely:</p>
          <ul>
            <li>poskytovanie a prevádzka služby,</li>
            <li>vyhodnocovanie testov a zobrazovanie výsledkov,</li>
            <li>tvorba personalizovaných odporúčaní a AI Coach správ,</li>
            <li>správa účtu, predplatného a zákazníckej podpory,</li>
            <li>prevádzka referral programu a SP Klanov,</li>
            <li>zlepšovanie funkčnosti, bezpečnosti a kvality služby,</li>
            <li>plnenie zákonných povinností.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>4. Právny základ spracúvania</h3>
          <p>Osobné údaje spracúvame na základe:</p>
          <ul>
            <li>plnenia zmluvy alebo vykonania opatrení pred uzavretím zmluvy,</li>
            <li>oprávneného záujmu, najmä pri zabezpečení prevádzky, ochrany služby a základnej analytiky,</li>
            <li>súhlasu, ak ide o marketingové alebo nepovinné cookies.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>5. AI spracovanie údajov</h3>
          <p>
            Na generovanie úloh a vytváranie odporúčaní po ukončení testu využívame služby spoločnosti <strong>Anthropic</strong> (Claude).
          </p>
          <p>
            Do AI systémov odosielame len údaje nevyhnutné na vytvorenie výstupu, najmä odpovede v teste,
            výsledkové dáta a tematické zhrnutie slabých miest. Identifikačné údaje, ako meno alebo email,
            sa do AI spracovania neodosielajú, pokiaľ to nie je nevyhnutné pre konkrétnu funkcionalitu.
          </p>
        </div>

        <div class="legal-item">
          <h3>6. Platobní a technickí sprostredkovatelia</h3>
          <p>
            Pri prevádzke služby využívame externých poskytovateľov, ktorí môžu spracúvať osobné údaje v postavení sprostredkovateľov alebo samostatných prevádzkovateľov podľa povahy služby.
          </p>
          <ul>
            <li><strong>Stripe</strong> – spracovanie platieb a súvisiace fakturačné údaje,</li>
            <li><strong>Anthropic</strong> – AI spracovanie odpovedí a výsledkov na účel generovania výstupov.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>7. Prenos do tretích krajín</h3>
          <p>
            Niektorí poskytovatelia môžu spracúvať údaje mimo Európskeho hospodárskeho priestoru.
            V takom prípade sa prenos uskutočňuje na základe primeraných ochranných mechanizmov,
            najmä štandardných zmluvných doložiek alebo iného právne uznaného nástroja.
          </p>
        </div>

        <div class="legal-item">
          <h3>8. Doba uchovávania údajov</h3>
          <p>
            Údaje uchovávame po dobu trvania používateľského účtu a následne po dobu nevyhnutnú na ochranu právnych nárokov,
            splnenie zákonných povinností alebo interných legitímnych potrieb prevádzkovateľa.
          </p>
          <p>
            Ak nie je potrebná dlhšia lehota, údaje môžu byť uchovávané najviac <strong>12 mesiacov po zrušení účtu</strong>,
            ak právne predpisy nevyžadujú dlhšie uchovanie.
          </p>
        </div>

        <div class="legal-item">
          <h3>9. Práva dotknutých osôb</h3>
          <p>Používateľ má právo:</p>
          <ul>
            <li>požadovať prístup k osobným údajom,</li>
            <li>požadovať opravu nepresných alebo neaktuálnych údajov,</li>
            <li>požadovať vymazanie údajov, ak sú splnené zákonné podmienky,</li>
            <li>požadovať obmedzenie spracúvania,</li>
            <li>namietať proti spracúvaniu v prípadoch ustanovených právnymi predpismi,</li>
            <li>požadovať prenositeľnosť údajov,</li>
            <li>podať sťažnosť na Úrad na ochranu osobných údajov Slovenskej republiky.</li>
          </ul>
        </div>

        <div class="legal-item">
          <h3>10. Cookies</h3>
          <p>
            Web môže používať nevyhnutné cookies, analytické cookies a prípadne marketingové cookies.
            Nepovinné cookies by mali byť používané len na základe platného súhlasu používateľa.
          </p>
          <p>
            Ak používaš analytiku alebo remarketing, samotný text nestačí. Musíš mať aj reálne implementovaný cookie banner a evidenciu súhlasov.
          </p>
        </div>

        <div class="legal-item">
          <h3>11. Bezpečnosť</h3>
          <p>
            Prevádzkovateľ prijíma primerané technické a organizačné opatrenia na ochranu osobných údajov,
            najmä obmedzenie prístupu, minimalizáciu údajov, bezpečnostné aktualizácie a ochranu dát pri prenose.
          </p>
        </div>

        <div class="legal-item">
          <h3>12. Kontakt</h3>
          <p>
            Ak si používateľ želá uplatniť svoje práva alebo má otázky k spracúvaniu osobných údajov,
            môže kontaktovať prevádzkovateľa na adrese <strong>juraj@jurajkurek.com</strong>.
          </p>
        </div>
      </div>
    </section>

    <section class="footer-cta">
      <h3>Právny základ má byť<br><em>jasný, nie ukrytý.</em></h3>

      <a href="/" class="btn-primary">Späť na landing page →</a>
    </section>
  </main>

  <footer>
    <div class="footer-logo">SP TRÉNER © 2026</div>
    <div class="footer-links">
      <a href="/app">Aplikácia</a>
      <a href="/blog">Blog</a>
      <a href="mailto:juraj@jurajkurek.com">Kontakt</a>
      <a href="#vop">Podmienky</a>
      <a href="#privacy">Súkromie</a>
    </div>
  </footer>`;

// ─── NEW_BODY: OLD_BODY s vloženými českými prekladmi vedľa slovenských ──
// Reťazec náhrad (SK text -> dual-span SK+CZ). Aplikuje sa postupne na
// OLD_BODY, takže výsledná štruktúra HTML je zaručene identická s
// originálom — mení sa len obsah textových uzlov.
const REPLACEMENTS = [
  // ticker (2x rovnaký text, replaceAll)
  ['Digitálna služba <span>SaaS</span>', sp('Digitálna služba <span>SaaS</span>', 'Digitální služba <span>SaaS</span>')],
  ['Premium <span>9,90 € / mesiac</span>', sp('Premium <span>9,90 € / mesiac</span>', 'Premium <span>9,90 € / měsíc</span>')],
  ['Elite <span>19,90 € / mesiac</span>', sp('Elite <span>19,90 € / mesiac</span>', 'Elite <span>19,90 € / měsíc</span>')],
  ['Platby <span>Stripe</span>', sp('Platby <span>Stripe</span>', 'Platby <span>Stripe</span>')],
  ['AI spracovanie <span>Claude · Anthropic</span>', sp('AI spracovanie <span>Claude · Anthropic</span>', 'AI zpracování <span>Claude · Anthropic</span>')],
  ['Právo <span>SR / CZ štandard</span>', sp('Právo <span>SR / CZ štandard</span>', 'Právo <span>SR / ČR standard</span>')],

  // intro / "Kto službu prevádzkuje"
  ['<div class="section-label">Prehľad</div>', `<div class="section-label">${sp('Prehľad', 'Přehled')}</div>`],
  ['<h2 class="section-title">Kto službu <em>prevádzkuje</em></h2>', `<h2 class="section-title">${sp('Kto službu <em>prevádzkuje</em>', 'Kdo službu <em>provozuje</em>')}</h2>`],
  [
    'Tieto dokumenty sa vzťahujú na online službu SP Tréner, ktorú prevádzkuje spoločnosť Ngroup, s. r. o.',
    sp('Tieto dokumenty sa vzťahujú na online službu SP Tréner, ktorú prevádzkuje spoločnosť Ngroup, s. r. o.', 'Tyto dokumenty se vztahují na online službu SP Tréner, kterou provozuje společnost Ngroup, s. r. o.')
  ],
  ['<span class="meta-label">Prevádzkovateľ</span>', `<span class="meta-label">${sp('Prevádzkovateľ', 'Provozovatel')}</span>`],
  ['<span class="meta-label">Sídlo</span>', `<span class="meta-label">${sp('Sídlo', 'Sídlo')}</span>`],
  ['<span class="meta-label">Služba</span>', `<span class="meta-label">${sp('Služba', 'Služba')}</span>`],
  ['<span class="meta-label">Typ služby</span>', `<span class="meta-label">${sp('Typ služby', 'Typ služby')}</span>`],
  ['<div class="meta-value">Digitálny obsah a online SaaS aplikácia</div>', `<div class="meta-value">${sp('Digitálny obsah a online SaaS aplikácia', 'Digitální obsah a online SaaS aplikace')}</div>`],
  ['<span class="meta-label">AI poskytovateľ</span>', `<span class="meta-label">${sp('AI poskytovateľ', 'AI poskytovatel')}</span>`],
  ['<span class="meta-label">Platobná brána</span>', `<span class="meta-label">${sp('Platobná brána', 'Platební brána')}</span>`],
  ['<span class="meta-label">Kontaktný email</span>', `<span class="meta-label">${sp('Kontaktný email', 'Kontaktní e-mail')}</span>`],
  ['<a class="anchor-link" href="#vop">Prejsť na VOP →</a>', `<a class="anchor-link" href="#vop">${sp('Prejsť na VOP →', 'Přejít na VOP →')}</a>`],
  ['<a class="anchor-link" href="#privacy">Prejsť na ochranu údajov →</a>', `<a class="anchor-link" href="#privacy">${sp('Prejsť na ochranu údajov →', 'Přejít na ochranu údajů →')}</a>`],

  // VOP header
  ['<div class="section-label">Dokument 01</div>', `<div class="section-label">${sp('Dokument 01', 'Dokument 01')}</div>`],
  ['<h2 class="section-title">Všeobecné obchodné <em>podmienky</em></h2>', `<h2 class="section-title">${sp('Všeobecné obchodné <em>podmienky</em>', 'Všeobecné obchodní <em>podmínky</em>')}</h2>`],
  [
    'Tieto VOP upravujú podmienky používania služby SP Tréner, podmienky predplatného, reklamácie,\n          zodpovednosť a základné pravidlá využívania digitálneho obsahu.',
    sp('Tieto VOP upravujú podmienky používania služby SP Tréner, podmienky predplatného, reklamácie, zodpovednosť a základné pravidlá využívania digitálneho obsahu.', 'Tyto VOP upravují podmínky používání služby SP Tréner, podmínky předplatného, reklamace, odpovědnost a základní pravidla využívání digitálního obsahu.')
  ],

  // VOP 1
  ['<h3>1. Základné ustanovenia</h3>', `<h3>${sp('1. Základné ustanovenia', '1. Základní ustanovení')}</h3>`],
  [
    'Tieto Všeobecné obchodné podmienky upravujú právne vzťahy medzi prevádzkovateľom služby a používateľom,\n            ktorý využíva online službu „SP Tréner".',
    sp('Tieto Všeobecné obchodné podmienky upravujú právne vzťahy medzi prevádzkovateľom služby a používateľom, ktorý využíva online službu „SP Tréner".', 'Tyto Všeobecné obchodní podmínky upravují právní vztahy mezi provozovatelem služby a uživatelem, který využívá online službu „SP Tréner".')
  ],
  [
    'Prevádzkovateľom služby je <strong>Ngroup, s. r. o.</strong>, so sídlom <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>,\n            IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.',
    sp('Prevádzkovateľom služby je <strong>Ngroup, s. r. o.</strong>, so sídlom <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>, IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.', 'Provozovatelem služby je <strong>Ngroup, s. r. o.</strong>, se sídlem <strong>Dunajská 8, 811 08 Bratislava, Slovenská republika</strong>, IČO: <strong>53813189</strong>, e-mail: <strong>juraj@jurajkurek.com</strong>.')
  ],

  // VOP 2
  ['<h3>2. Charakter služby</h3>', `<h3>${sp('2. Charakter služby', '2. Charakter služby')}</h3>`],
  [
    'SP Tréner je digitálny produkt poskytovaný online formou SaaS, určený na prípravu na testy všeobecných študijných predpokladov (VŠP).',
    sp('SP Tréner je digitálny produkt poskytovaný online formou SaaS, určený na prípravu na testy všeobecných študijných predpokladov (VŠP).', 'SP Tréner je digitální produkt poskytovaný online formou SaaS, určený k přípravě na testy všeobecných studijních předpokladů (VŠP).')
  ],
  ['<li>simulácie VŠP testov,</li>', `<li>${sp('simulácie VŠP testov,', 'simulace VŠP testů,')}</li>`],
  ['<li>AI generovanie úloh,</li>', `<li>${sp('AI generovanie úloh,', 'AI generování úloh,')}</li>`],
  ['<li>analýzu výsledkov testov,</li>', `<li>${sp('analýzu výsledkov testov,', 'analýzu výsledků testů,')}</li>`],
  ['<li>personalizované odporúčania a sledovanie progresu,</li>', `<li>${sp('personalizované odporúčania a sledovanie progresu,', 'personalizovaná doporučení a sledování progresu,')}</li>`],
  ['<li>súkromné skupiny (SP Klany) a referral program medzi používateľmi.</li>', `<li>${sp('súkromné skupiny (SP Klany) a referral program medzi používateľmi.', 'soukromé skupiny (SP Klany) a referral program mezi uživateli.')}</li>`],
  [
    'Služba nie je oficiálnym produktom žiadneho konkrétneho poskytovateľa testov všeobecných študijných predpokladov\n            a nezaručuje konkrétny výsledok, percentil ani prijatie na vysokú školu.',
    sp('Služba nie je oficiálnym produktom žiadneho konkrétneho poskytovateľa testov všeobecných študijných predpokladov a nezaručuje konkrétny výsledok, percentil ani prijatie na vysokú školu.', 'Služba není oficiálním produktem žádného konkrétního poskytovatele testů všeobecných studijních předpokladů a nezaručuje konkrétní výsledek, percentil ani přijetí na vysokou školu.')
  ],

  // VOP 3
  ['<h3>3. Uzavretie zmluvy</h3>', `<h3>${sp('3. Uzavretie zmluvy', '3. Uzavření smlouvy')}</h3>`],
  [
    'Zmluvný vzťah medzi prevádzkovateľom a používateľom vzniká začatím používania služby alebo zakúpením plateného predplatného.\n            Používateľ používaním služby potvrdzuje, že sa oboznámil s týmito VOP a súhlasí s nimi.',
    sp('Zmluvný vzťah medzi prevádzkovateľom a používateľom vzniká začatím používania služby alebo zakúpením plateného predplatného. Používateľ používaním služby potvrdzuje, že sa oboznámil s týmito VOP a súhlasí s nimi.', 'Smluvní vztah mezi provozovatelem a uživatelem vzniká zahájením používání služby nebo zakoupením placeného předplatného. Uživatel používáním služby potvrzuje, že se seznámil s těmito VOP a souhlasí s nimi.')
  ],

  // VOP 4
  ['<h3>4. Bezplatná verzia</h3>', `<h3>${sp('4. Bezplatná verzia', '4. Bezplatná verze')}</h3>`],
  [
    'Prevádzkovateľ sprístupňuje používateľovi bezplatnú verziu služby, ktorá zahŕňa najmä 3 plné testové simulácie\n            a základnú analýzu výsledkov, bez potreby zadania platobnej karty.',
    sp('Prevádzkovateľ sprístupňuje používateľovi bezplatnú verziu služby, ktorá zahŕňa najmä 3 plné testové simulácie a základnú analýzu výsledkov, bez potreby zadania platobnej karty.', 'Provozovatel zpřístupňuje uživateli bezplatnou verzi služby, která zahrnuje zejména 3 plné testové simulace a základní analýzu výsledků, bez nutnosti zadání platební karty.')
  ],
  [
    'Prevádzkovateľ si vyhradzuje právo rozsah bezplatnej verzie meniť, obmedziť alebo ukončiť bez predchádzajúceho upozornenia.',
    sp('Prevádzkovateľ si vyhradzuje právo rozsah bezplatnej verzie meniť, obmedziť alebo ukončiť bez predchádzajúceho upozornenia.', 'Provozovatel si vyhrazuje právo rozsah bezplatné verze měnit, omezit nebo ukončit bez předchozího upozornění.')
  ],

  // VOP 5
  ['<h3>5. Predplatné a cena</h3>', `<h3>${sp('5. Predplatné a cena', '5. Předplatné a cena')}</h3>`],
  [
    'Platený prístup je poskytovaný formou mesačného predplatného v dvoch úrovniach, podľa aktuálnej ponuky uvedenej na webovej stránke:',
    sp('Platený prístup je poskytovaný formou mesačného predplatného v dvoch úrovniach, podľa aktuálnej ponuky uvedenej na webovej stránke:', 'Placený přístup je poskytován formou měsíčního předplatného ve dvou úrovních, podle aktuální nabídky uvedené na webové stránce:')
  ],
  ['<div class="pricing-tier-note">3 testy, bez karty</div>', `<div class="pricing-tier-note">${sp('3 testy, bez karty', '3 testy, bez karty')}</div>`],
  ['<div class="pricing-tier-price">9,90 € / mes.</div>', `<div class="pricing-tier-price">${sp('9,90 € / mes.', '9,90 € / měs.')}</div>`],
  ['<div class="pricing-tier-note">neobmedzené testy, AI generátor, SP Klany</div>', `<div class="pricing-tier-note">${sp('neobmedzené testy, AI generátor, SP Klany', 'neomezené testy, AI generátor, SP Klany')}</div>`],
  ['<div class="pricing-tier-price">19,90 € / mes.</div>', `<div class="pricing-tier-price">${sp('19,90 € / mes.', '19,90 € / měs.')}</div>`],
  ['<div class="pricing-tier-note">Premium + AI Mentor a ďalšie funkcie</div>', `<div class="pricing-tier-note">${sp('Premium + AI Mentor a ďalšie funkcie', 'Premium + AI Mentor a další funkce')}</div>`],
  ['<li>predplatné sa platí vopred za fakturačné obdobie,</li>', `<li>${sp('predplatné sa platí vopred za fakturačné obdobie,', 'předplatné se platí předem za fakturační období,')}</li>`],
  ['<li>platby sú spracované prostredníctvom Stripe,</li>', `<li>${sp('platby sú spracované prostredníctvom Stripe,', 'platby jsou zpracovány prostřednictvím Stripe,')}</li>`],
  ['<li>prechod medzi úrovňami Premium a Elite je možný kedykoľvek v aplikácii,</li>', `<li>${sp('prechod medzi úrovňami Premium a Elite je možný kedykoľvek v aplikácii,', 'přechod mezi úrovněmi Premium a Elite je možný kdykoliv v aplikaci,')}</li>`],
  [
    '<li>ceny môžu byť v budúcnosti zmenené, pričom zmena sa nedotkne už zaplateného obdobia.</li>',
    `<li>${sp('ceny môžu byť v budúcnosti zmenené, pričom zmena sa nedotkne už zaplateného obdobia.', 'ceny mohou být v budoucnu změněny, přičemž změna se nedotkne již zaplaceného období.')}</li>`
  ],

  // VOP 6
  ['<h3>6. Automatické obnovenie predplatného</h3>', `<h3>${sp('6. Automatické obnovenie predplatného', '6. Automatické obnovení předplatného')}</h3>`],
  [
    'Zakúpením Premium alebo Elite prístupu používateľ berie na vedomie, že predplatné sa automaticky obnovuje\n            na ďalšie fakturačné obdobie, pokiaľ nie je včas zrušené pred jeho obnovením.',
    sp('Zakúpením Premium alebo Elite prístupu používateľ berie na vedomie, že predplatné sa automaticky obnovuje na ďalšie fakturačné obdobie, pokiaľ nie je včas zrušené pred jeho obnovením.', 'Zakoupením přístupu Premium nebo Elite uživatel bere na vědomí, že předplatné se automaticky obnovuje na další fakturační období, pokud není včas zrušeno před jeho obnovením.')
  ],

  // VOP 7
  ['<h3>7. Zrušenie predplatného</h3>', `<h3>${sp('7. Zrušenie predplatného', '7. Zrušení předplatného')}</h3>`],
  [
    'Používateľ môže predplatné zrušiť kedykoľvek cez používateľský účet, zákaznícky portál Stripe alebo kontaktovaním podpory.',
    sp('Používateľ môže predplatné zrušiť kedykoľvek cez používateľský účet, zákaznícky portál Stripe alebo kontaktovaním podpory.', 'Uživatel může předplatné zrušit kdykoliv přes uživatelský účet, zákaznický portál Stripe nebo kontaktováním podpory.')
  ],
  [
    'Po zrušení zostáva prístup k plateným funkciám aktívny do konca už zaplateného obdobia. Po jeho uplynutí sa účet prepne na bezplatný režim,\n            ak je dostupný. Za nevyužité obdobie sa pomerná časť ceny nevracia, ak právny predpis neustanovuje inak.',
    sp('Po zrušení zostáva prístup k plateným funkciám aktívny do konca už zaplateného obdobia. Po jeho uplynutí sa účet prepne na bezplatný režim, ak je dostupný. Za nevyužité obdobie sa pomerná časť ceny nevracia, ak právny predpis neustanovuje inak.', 'Po zrušení zůstává přístup k placeným funkcím aktivní do konce již zaplaceného období. Po jeho uplynutí se účet přepne do bezplatného režimu, pokud je dostupný. Za nevyužité období se poměrná část ceny nevrací, pokud právní předpis nestanoví jinak.')
  ],

  // VOP 8
  ['<h3>8. Referral program a bonusové dni</h3>', `<h3>${sp('8. Referral program a bonusové dni', '8. Referral program a bonusové dny')}</h3>`],
  [
    'Používateľ s aktívnym Premium alebo Elite prístupom môže získať a zdieľať referral kód. Ak nový používateľ tento kód\n            použije pri kúpe predplatného, obom stranám môže byť pripísaný bonus vo forme dodatočných dní predplatného navyše\n            k zaplatenému obdobiu, podľa aktuálnych podmienok programu uvedených na webovej stránke.',
    sp('Používateľ s aktívnym Premium alebo Elite prístupom môže získať a zdieľať referral kód. Ak nový používateľ tento kód použije pri kúpe predplatného, obom stranám môže byť pripísaný bonus vo forme dodatočných dní predplatného navyše k zaplatenému obdobiu, podľa aktuálnych podmienok programu uvedených na webovej stránke.', 'Uživatel s aktivním přístupem Premium nebo Elite může získat a sdílet referral kód. Pokud nový uživatel tento kód použije při koupi předplatného, oběma stranám může být připsán bonus ve formě dodatečných dnů předplatného navíc k zaplacenému období, podle aktuálních podmínek programu uvedených na webové stránce.')
  ],
  [
    'Prevádzkovateľ si vyhradzuje právo podmienky referral programu, výšku bonusu aj jeho dostupnosť kedykoľvek zmeniť alebo ukončiť.\n            Bonusové dni nemajú peňažnú hodnotu a nie je možné ich vyplatiť ani zameniť za hotovosť.',
    sp('Prevádzkovateľ si vyhradzuje právo podmienky referral programu, výšku bonusu aj jeho dostupnosť kedykoľvek zmeniť alebo ukončiť. Bonusové dni nemajú peňažnú hodnotu a nie je možné ich vyplatiť ani zameniť za hotovosť.', 'Provozovatel si vyhrazuje právo podmínky referral programu, výši bonusu i jeho dostupnost kdykoliv změnit nebo ukončit. Bonusové dny nemají peněžní hodnotu a nelze je vyplatit ani směnit za hotovost.')
  ],

  // VOP 9
  ['<h3>9. Digitálny obsah a odstúpenie od zmluvy</h3>', `<h3>${sp('9. Digitálny obsah a odstúpenie od zmluvy', '9. Digitální obsah a odstoupení od smlouvy')}</h3>`],
  [
    'Služba predstavuje digitálny obsah dodávaný online bez fyzického nosiča. Používateľ výslovne súhlasí\n            so začatím poskytovania digitálneho obsahu pred uplynutím lehoty na odstúpenie od zmluvy a berie na vedomie,\n            že tým môže v rozsahu dovolenom právnymi predpismi stratiť právo na odstúpenie od zmluvy.',
    sp('Služba predstavuje digitálny obsah dodávaný online bez fyzického nosiča. Používateľ výslovne súhlasí so začatím poskytovania digitálneho obsahu pred uplynutím lehoty na odstúpenie od zmluvy a berie na vedomie, že tým môže v rozsahu dovolenom právnymi predpismi stratiť právo na odstúpenie od zmluvy.', 'Služba představuje digitální obsah dodávaný online bez fyzického nosiče. Uživatel výslovně souhlasí se zahájením poskytování digitálního obsahu před uplynutím lhůty pro odstoupení od smlouvy a bere na vědomí, že tím může v rozsahu dovoleném právními předpisy ztratit právo na odstoupení od smlouvy.')
  ],

  // VOP 10
  ['<h3>10. Reklamácie a dostupnosť služby</h3>', `<h3>${sp('10. Reklamácie a dostupnosť služby', '10. Reklamace a dostupnost služby')}</h3>`],
  [
    'Používateľ je oprávnený reklamovať technické vady služby, najmä dlhodobú nedostupnosť, nefunkčnosť alebo nesprávne účtovanie.',
    sp('Používateľ je oprávnený reklamovať technické vady služby, najmä dlhodobú nedostupnosť, nefunkčnosť alebo nesprávne účtovanie.', 'Uživatel je oprávněn reklamovat technické vady služby, zejména dlouhodobou nedostupnost, nefunkčnost nebo nesprávné účtování.')
  ],
  [
    'Reklamáciu je možné uplatniť na emailovej adrese <strong>juraj@jurajkurek.com</strong>.\n            Prevádzkovateľ vybaví reklamáciu v primeranej lehote a v súlade s platnými právnymi predpismi.',
    sp('Reklamáciu je možné uplatniť na emailovej adrese <strong>juraj@jurajkurek.com</strong>. Prevádzkovateľ vybaví reklamáciu v primeranej lehote a v súlade s platnými právnymi predpismi.', 'Reklamaci lze uplatnit na e-mailové adrese <strong>juraj@jurajkurek.com</strong>. Provozovatel vyřídí reklamaci v přiměřené lhůtě a v souladu s platnými právními předpisy.')
  ],

  // VOP 11
  ['<h3>11. AI služby a obmedzenie výstupov</h3>', `<h3>${sp('11. AI služby a obmedzenie výstupov', '11. AI služby a omezení výstupů')}</h3>`],
  [
    'Služba využíva AI technológie poskytované spoločnosťou Anthropic, najmä model Claude,\n            na generovanie úloh a vytváranie odporúčaní po ukončení testu.',
    sp('Služba využíva AI technológie poskytované spoločnosťou Anthropic, najmä model Claude, na generovanie úloh a vytváranie odporúčaní po ukončení testu.', 'Služba využívá AI technologie poskytované společností Anthropic, zejména model Claude, ke generování úloh a vytváření doporučení po ukončení testu.')
  ],
  [
    'Používateľ berie na vedomie, že AI výstupy môžu byť nepresné, neúplné alebo nevhodné\n            a slúžia výlučne ako pomocný tréningový nástroj, nie ako odborné, právne, pedagogické alebo garančné stanovisko.',
    sp('Používateľ berie na vedomie, že AI výstupy môžu byť nepresné, neúplné alebo nevhodné a slúžia výlučne ako pomocný tréningový nástroj, nie ako odborné, právne, pedagogické alebo garančné stanovisko.', 'Uživatel bere na vědomí, že AI výstupy mohou být nepřesné, neúplné nebo nevhodné a slouží výhradně jako pomocný tréninkový nástroj, nikoliv jako odborné, právní, pedagogické nebo garanční stanovisko.')
  ],

  // VOP 12
  ['<h3>12. Zodpovednosť</h3>', `<h3>${sp('12. Zodpovednosť', '12. Odpovědnost')}</h3>`],
  [
    'Prevádzkovateľ nezodpovedá za individuálne výsledky používateľa v testoch, za jeho prijatie na školu,\n            za rozhodnutia vykonané na základe AI odporúčaní ani za výpadky externých služieb tretích strán.',
    sp('Prevádzkovateľ nezodpovedá za individuálne výsledky používateľa v testoch, za jeho prijatie na školu, za rozhodnutia vykonané na základe AI odporúčaní ani za výpadky externých služieb tretích strán.', 'Provozovatel neodpovídá za individuální výsledky uživatele v testech, za jeho přijetí na školu, za rozhodnutí učiněná na základě AI doporučení ani za výpadky externích služeb třetích stran.')
  ],
  [
    'Prevádzkovateľ zodpovedá len v rozsahu, ktorý výslovne vyžadujú kogentné právne predpisy.',
    sp('Prevádzkovateľ zodpovedá len v rozsahu, ktorý výslovne vyžadujú kogentné právne predpisy.', 'Provozovatel odpovídá pouze v rozsahu, který výslovně vyžadují kogentní právní předpisy.')
  ],

  // VOP 13
  ['<h3>13. Duševné vlastníctvo</h3>', `<h3>${sp('13. Duševné vlastníctvo', '13. Duševní vlastnictví')}</h3>`],
  [
    'Všetok obsah sprístupnený v rámci služby, vrátane testov, textov, štruktúr úloh, dizajnu, analytických výstupov a softvéru,\n            je chránený právami duševného vlastníctva.',
    sp('Všetok obsah sprístupnený v rámci služby, vrátane testov, textov, štruktúr úloh, dizajnu, analytických výstupov a softvéru, je chránený právami duševného vlastníctva.', 'Veškerý obsah zpřístupněný v rámci služby, včetně testů, textů, struktur úloh, designu, analytických výstupů a softwaru, je chráněn právy duševního vlastnictví.')
  ],
  ['<li>je zakázané obsah kopírovať, šíriť alebo komerčne využívať bez súhlasu,</li>', `<li>${sp('je zakázané obsah kopírovať, šíriť alebo komerčne využívať bez súhlasu,', 'je zakázáno obsah kopírovat, šířit nebo komerčně využívat bez souhlasu,')}</li>`],
  [
    '<li>je zakázané sprístupňovať účet tretím osobám, ak to služba výslovne nepovoľuje.</li>',
    `<li>${sp('je zakázané sprístupňovať účet tretím osobám, ak to služba výslovne nepovoľuje.', 'je zakázáno zpřístupňovat účet třetím osobám, pokud to služba výslovně nepovoluje.')}</li>`
  ],

  // VOP 14
  ['<h3>14. Ukončenie účtu alebo služby</h3>', `<h3>${sp('14. Ukončenie účtu alebo služby', '14. Ukončení účtu nebo služby')}</h3>`],
  [
    'Prevádzkovateľ si vyhradzuje právo obmedziť alebo ukončiť účet používateľa, ak porušuje tieto VOP,\n            používa službu zneužívajúcim spôsobom alebo zasahuje do jej bezpečnosti či funkčnosti.',
    sp('Prevádzkovateľ si vyhradzuje právo obmedziť alebo ukončiť účet používateľa, ak porušuje tieto VOP, používa službu zneužívajúcim spôsobom alebo zasahuje do jej bezpečnosti či funkčnosti.', 'Provozovatel si vyhrazuje právo omezit nebo ukončit účet uživatele, pokud porušuje tyto VOP, používá službu zneužívajícím způsobem nebo zasahuje do její bezpečnosti či funkčnosti.')
  ],
  [
    'Prevádzkovateľ si zároveň vyhradzuje právo službu meniť, rozširovať, obmedziť alebo ukončiť.',
    sp('Prevádzkovateľ si zároveň vyhradzuje právo službu meniť, rozširovať, obmedziť alebo ukončiť.', 'Provozovatel si zároveň vyhrazuje právo službu měnit, rozšiřovat, omezit nebo ukončit.')
  ],

  // VOP 15
  ['<h3>15. Riešenie sporov</h3>', `<h3>${sp('15. Riešenie sporov', '15. Řešení sporů')}</h3>`],
  [
    'Na právne vzťahy sa vzťahuje právny poriadok Slovenskej republiky. Spotrebiteľ má právo obrátiť sa aj na\n            Slovenskú obchodnú inšpekciu alebo využiť alternatívne riešenie spotrebiteľských sporov, ak sú na to splnené zákonné podmienky.',
    sp('Na právne vzťahy sa vzťahuje právny poriadok Slovenskej republiky. Spotrebiteľ má právo obrátiť sa aj na Slovenskú obchodnú inšpekciu alebo využiť alternatívne riešenie spotrebiteľských sporov, ak sú na to splnené zákonné podmienky.', 'Na právní vztahy se vztahuje právní řád Slovenské republiky. Spotřebitel má právo obrátit se i na Slovenskou obchodní inspekci nebo využít alternativní řešení spotřebitelských sporů, pokud jsou pro to splněny zákonné podmínky.')
  ],

  // VOP 16
  ['<h3>16. Záverečné ustanovenia</h3>', `<h3>${sp('16. Záverečné ustanovenia', '16. Závěrečná ustanovení')}</h3>`],
  [
    'Prevádzkovateľ si vyhradzuje právo tieto VOP meniť. Nové znenie je účinné dňom zverejnenia, ak nie je uvedené inak.',
    sp('Prevádzkovateľ si vyhradzuje právo tieto VOP meniť. Nové znenie je účinné dňom zverejnenia, ak nie je uvedené inak.', 'Provozovatel si vyhrazuje právo tyto VOP měnit. Nové znění je účinné dnem zveřejnění, pokud není uvedeno jinak.')
  ],
  [
    'Posledná aktualizácia: <strong>30.7.2026</strong>.',
    sp('Posledná aktualizácia: <strong>30.7.2026</strong>.', 'Poslední aktualizace: <strong>30. 7. 2026</strong>.')
  ],

  // Privacy header
  ['<div class="section-label">Dokument 02</div>', `<div class="section-label">${sp('Dokument 02', 'Dokument 02')}</div>`],
  ['<h2 class="section-title">Zásady ochrany <em>osobných údajov</em></h2>', `<h2 class="section-title">${sp('Zásady ochrany <em>osobných údajov</em>', 'Zásady ochrany <em>osobních údajů</em>')}</h2>`],
  [
    'Tento dokument vysvetľuje, aké údaje spracúvaš, na aký účel, na akom právnom základe\n          a aké práva majú používatelia služby SP Tréner.',
    sp('Tento dokument vysvetľuje, aké údaje spracúvaš, na aký účel, na akom právnom základe a aké práva majú používatelia služby SP Tréner.', 'Tento dokument vysvětluje, jaké údaje zpracováváme, za jakým účelem, na jakém právním základě a jaká práva mají uživatelé služby SP Tréner.')
  ],

  // Privacy 1
  ['<h3>1. Prevádzkovateľ osobných údajov</h3>', `<h3>${sp('1. Prevádzkovateľ osobných údajov', '1. Správce osobních údajů')}</h3>`],
  [
    'Prevádzkovateľom osobných údajov je <strong>Ngroup, s. r. o.</strong>, Dunajská 8, 811 08 Bratislava,\n            Slovenská republika, IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.',
    sp('Prevádzkovateľom osobných údajov je <strong>Ngroup, s. r. o.</strong>, Dunajská 8, 811 08 Bratislava, Slovenská republika, IČO: <strong>53813189</strong>, email: <strong>juraj@jurajkurek.com</strong>.', 'Správcem osobních údajů je <strong>Ngroup, s. r. o.</strong>, Dunajská 8, 811 08 Bratislava, Slovenská republika, IČO: <strong>53813189</strong>, e-mail: <strong>juraj@jurajkurek.com</strong>.')
  ],

  // Privacy 2
  ['<h3>2. Aké údaje spracúvame</h3>', `<h3>${sp('2. Aké údaje spracúvame', '2. Jaké údaje zpracováváme')}</h3>`],
  ['<p>V závislosti od spôsobu používania služby môžeme spracúvať najmä:</p>', `<p>${sp('V závislosti od spôsobu používania služby môžeme spracúvať najmä:', 'V závislosti na způsobu používání služby můžeme zpracovávat zejména:')}</p>`],
  ['<li>identifikačné a kontaktné údaje, napríklad email,</li>', `<li>${sp('identifikačné a kontaktné údaje, napríklad email,', 'identifikační a kontaktní údaje, například e-mail,')}</li>`],
  ['<li>prihlasovacie a účtové údaje,</li>', `<li>${sp('prihlasovacie a účtové údaje,', 'přihlašovací a účtové údaje,')}</li>`],
  ['<li>odpovede používateľa v testoch a výsledky testov,</li>', `<li>${sp('odpovede používateľa v testoch a výsledky testov,', 'odpovědi uživatele v testech a výsledky testů,')}</li>`],
  ['<li>údaje o používaní služby, histórii aktivít a progres tracking,</li>', `<li>${sp('údaje o používaní služby, histórii aktivít a progres tracking,', 'údaje o používání služby, historii aktivit a sledování progresu,')}</li>`],
  [
    '<li>údaje o referral kóde a jeho použití, ak sa používateľ zapojí do referral programu,</li>',
    `<li>${sp('údaje o referral kóde a jeho použití, ak sa používateľ zapojí do referral programu,', 'údaje o referral kódu a jeho použití, pokud se uživatel zapojí do referral programu,')}</li>`
  ],
  [
    '<li>technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.</li>',
    `<li>${sp('technické údaje, napríklad IP adresu, cookies a základné údaje o zariadení.', 'technické údaje, například IP adresu, cookies a základní údaje o zařízení.')}</li>`
  ],

  // Privacy 3
  ['<h3>3. Účely spracúvania</h3>', `<h3>${sp('3. Účely spracúvania', '3. Účely zpracování')}</h3>`],
  ['<p>Osobné údaje spracúvame najmä na tieto účely:</p>', `<p>${sp('Osobné údaje spracúvame najmä na tieto účely:', 'Osobní údaje zpracováváme zejména za těmito účely:')}</p>`],
  ['<li>poskytovanie a prevádzka služby,</li>', `<li>${sp('poskytovanie a prevádzka služby,', 'poskytování a provoz služby,')}</li>`],
  ['<li>vyhodnocovanie testov a zobrazovanie výsledkov,</li>', `<li>${sp('vyhodnocovanie testov a zobrazovanie výsledkov,', 'vyhodnocování testů a zobrazování výsledků,')}</li>`],
  ['<li>tvorba personalizovaných odporúčaní a AI Coach správ,</li>', `<li>${sp('tvorba personalizovaných odporúčaní a AI Coach správ,', 'tvorba personalizovaných doporučení a AI Coach zpráv,')}</li>`],
  ['<li>správa účtu, predplatného a zákazníckej podpory,</li>', `<li>${sp('správa účtu, predplatného a zákazníckej podpory,', 'správa účtu, předplatného a zákaznické podpory,')}</li>`],
  ['<li>prevádzka referral programu a SP Klanov,</li>', `<li>${sp('prevádzka referral programu a SP Klanov,', 'provoz referral programu a SP Klanů,')}</li>`],
  ['<li>zlepšovanie funkčnosti, bezpečnosti a kvality služby,</li>', `<li>${sp('zlepšovanie funkčnosti, bezpečnosti a kvality služby,', 'zlepšování funkčnosti, bezpečnosti a kvality služby,')}</li>`],
  ['<li>plnenie zákonných povinností.</li>', `<li>${sp('plnenie zákonných povinností.', 'plnění zákonných povinností.')}</li>`],

  // Privacy 4
  ['<h3>4. Právny základ spracúvania</h3>', `<h3>${sp('4. Právny základ spracúvania', '4. Právní základ zpracování')}</h3>`],
  ['<p>Osobné údaje spracúvame na základe:</p>', `<p>${sp('Osobné údaje spracúvame na základe:', 'Osobní údaje zpracováváme na základě:')}</p>`],
  ['<li>plnenia zmluvy alebo vykonania opatrení pred uzavretím zmluvy,</li>', `<li>${sp('plnenia zmluvy alebo vykonania opatrení pred uzavretím zmluvy,', 'plnění smlouvy nebo provedení opatření před uzavřením smlouvy,')}</li>`],
  [
    '<li>oprávneného záujmu, najmä pri zabezpečení prevádzky, ochrany služby a základnej analytiky,</li>',
    `<li>${sp('oprávneného záujmu, najmä pri zabezpečení prevádzky, ochrany služby a základnej analytiky,', 'oprávněného zájmu, zejména při zajištění provozu, ochrany služby a základní analytiky,')}</li>`
  ],
  ['<li>súhlasu, ak ide o marketingové alebo nepovinné cookies.</li>', `<li>${sp('súhlasu, ak ide o marketingové alebo nepovinné cookies.', 'souhlasu, jde-li o marketingové nebo nepovinné cookies.')}</li>`],

  // Privacy 5
  ['<h3>5. AI spracovanie údajov</h3>', `<h3>${sp('5. AI spracovanie údajov', '5. AI zpracování údajů')}</h3>`],
  [
    'Na generovanie úloh a vytváranie odporúčaní po ukončení testu využívame služby spoločnosti <strong>Anthropic</strong> (Claude).',
    sp('Na generovanie úloh a vytváranie odporúčaní po ukončení testu využívame služby spoločnosti <strong>Anthropic</strong> (Claude).', 'Ke generování úloh a vytváření doporučení po ukončení testu využíváme služby společnosti <strong>Anthropic</strong> (Claude).')
  ],
  [
    'Do AI systémov odosielame len údaje nevyhnutné na vytvorenie výstupu, najmä odpovede v teste,\n            výsledkové dáta a tematické zhrnutie slabých miest. Identifikačné údaje, ako meno alebo email,\n            sa do AI spracovania neodosielajú, pokiaľ to nie je nevyhnutné pre konkrétnu funkcionalitu.',
    sp('Do AI systémov odosielame len údaje nevyhnutné na vytvorenie výstupu, najmä odpovede v teste, výsledkové dáta a tematické zhrnutie slabých miest. Identifikačné údaje, ako meno alebo email, sa do AI spracovania neodosielajú, pokiaľ to nie je nevyhnutné pre konkrétnu funkcionalitu.', 'Do AI systémů odesíláme pouze údaje nezbytné k vytvoření výstupu, zejména odpovědi v testu, výsledková data a tematické shrnutí slabých míst. Identifikační údaje, jako jméno nebo e-mail, se do AI zpracování neodesílají, pokud to není nezbytné pro konkrétní funkcionalitu.')
  ],

  // Privacy 6
  ['<h3>6. Platobní a technickí sprostredkovatelia</h3>', `<h3>${sp('6. Platobní a technickí sprostredkovatelia', '6. Platební a techničtí zprostředkovatelé')}</h3>`],
  [
    'Pri prevádzke služby využívame externých poskytovateľov, ktorí môžu spracúvať osobné údaje v postavení sprostredkovateľov alebo samostatných prevádzkovateľov podľa povahy služby.',
    sp('Pri prevádzke služby využívame externých poskytovateľov, ktorí môžu spracúvať osobné údaje v postavení sprostredkovateľov alebo samostatných prevádzkovateľov podľa povahy služby.', 'Při provozu služby využíváme externí poskytovatele, kteří mohou zpracovávat osobní údaje v postavení zprostředkovatelů nebo samostatných správců podle povahy služby.')
  ],
  [
    '<li><strong>Stripe</strong> – spracovanie platieb a súvisiace fakturačné údaje,</li>',
    `<li><strong>Stripe</strong> – ${sp('spracovanie platieb a súvisiace fakturačné údaje,', 'zpracování plateb a související fakturační údaje,')}</li>`
  ],
  [
    '<li><strong>Anthropic</strong> – AI spracovanie odpovedí a výsledkov na účel generovania výstupov.</li>',
    `<li><strong>Anthropic</strong> – ${sp('AI spracovanie odpovedí a výsledkov na účel generovania výstupov.', 'AI zpracování odpovědí a výsledků za účelem generování výstupů.')}</li>`
  ],

  // Privacy 7
  ['<h3>7. Prenos do tretích krajín</h3>', `<h3>${sp('7. Prenos do tretích krajín', '7. Přenos do třetích zemí')}</h3>`],
  [
    'Niektorí poskytovatelia môžu spracúvať údaje mimo Európskeho hospodárskeho priestoru.\n            V takom prípade sa prenos uskutočňuje na základe primeraných ochranných mechanizmov,\n            najmä štandardných zmluvných doložiek alebo iného právne uznaného nástroja.',
    sp('Niektorí poskytovatelia môžu spracúvať údaje mimo Európskeho hospodárskeho priestoru. V takom prípade sa prenos uskutočňuje na základe primeraných ochranných mechanizmov, najmä štandardných zmluvných doložiek alebo iného právne uznaného nástroja.', 'Někteří poskytovatelé mohou zpracovávat údaje mimo Evropský hospodářský prostor. V takovém případě se přenos uskutečňuje na základě přiměřených ochranných mechanismů, zejména standardních smluvních doložek nebo jiného právně uznaného nástroje.')
  ],

  // Privacy 8
  ['<h3>8. Doba uchovávania údajov</h3>', `<h3>${sp('8. Doba uchovávania údajov', '8. Doba uchovávání údajů')}</h3>`],
  [
    'Údaje uchovávame po dobu trvania používateľského účtu a následne po dobu nevyhnutnú na ochranu právnych nárokov,\n            splnenie zákonných povinností alebo interných legitímnych potrieb prevádzkovateľa.',
    sp('Údaje uchovávame po dobu trvania používateľského účtu a následne po dobu nevyhnutnú na ochranu právnych nárokov, splnenie zákonných povinností alebo interných legitímnych potrieb prevádzkovateľa.', 'Údaje uchováváme po dobu trvání uživatelského účtu a následně po dobu nezbytnou k ochraně právních nároků, splnění zákonných povinností nebo interních legitimních potřeb provozovatele.')
  ],
  [
    'Ak nie je potrebná dlhšia lehota, údaje môžu byť uchovávané najviac <strong>12 mesiacov po zrušení účtu</strong>,\n            ak právne predpisy nevyžadujú dlhšie uchovanie.',
    sp('Ak nie je potrebná dlhšia lehota, údaje môžu byť uchovávané najviac <strong>12 mesiacov po zrušení účtu</strong>, ak právne predpisy nevyžadujú dlhšie uchovanie.', 'Není-li potřebná delší lhůta, údaje mohou být uchovávány nejdéle <strong>12 měsíců po zrušení účtu</strong>, pokud právní předpisy nevyžadují delší uchování.')
  ],

  // Privacy 9
  ['<h3>9. Práva dotknutých osôb</h3>', `<h3>${sp('9. Práva dotknutých osôb', '9. Práva subjektů údajů')}</h3>`],
  ['<p>Používateľ má právo:</p>', `<p>${sp('Používateľ má právo:', 'Uživatel má právo:')}</p>`],
  ['<li>požadovať prístup k osobným údajom,</li>', `<li>${sp('požadovať prístup k osobným údajom,', 'požadovat přístup k osobním údajům,')}</li>`],
  ['<li>požadovať opravu nepresných alebo neaktuálnych údajov,</li>', `<li>${sp('požadovať opravu nepresných alebo neaktuálnych údajov,', 'požadovat opravu nepřesných nebo neaktuálních údajů,')}</li>`],
  ['<li>požadovať vymazanie údajov, ak sú splnené zákonné podmienky,</li>', `<li>${sp('požadovať vymazanie údajov, ak sú splnené zákonné podmienky,', 'požadovat výmaz údajů, jsou-li splněny zákonné podmínky,')}</li>`],
  ['<li>požadovať obmedzenie spracúvania,</li>', `<li>${sp('požadovať obmedzenie spracúvania,', 'požadovat omezení zpracování,')}</li>`],
  [
    '<li>namietať proti spracúvaniu v prípadoch ustanovených právnymi predpismi,</li>',
    `<li>${sp('namietať proti spracúvaniu v prípadoch ustanovených právnymi predpismi,', 'vznést námitku proti zpracování v případech stanovených právními předpisy,')}</li>`
  ],
  ['<li>požadovať prenositeľnosť údajov,</li>', `<li>${sp('požadovať prenositeľnosť údajov,', 'požadovat přenositelnost údajů,')}</li>`],
  [
    '<li>podať sťažnosť na Úrad na ochranu osobných údajov Slovenskej republiky.</li>',
    `<li>${sp('podať sťažnosť na Úrad na ochranu osobných údajov Slovenskej republiky.', 'podat stížnost u Úřadu na ochranu osobních údajů Slovenské republiky.')}</li>`
  ],

  // Privacy 10
  ['<h3>10. Cookies</h3>', `<h3>${sp('10. Cookies', '10. Cookies')}</h3>`],
  [
    'Web môže používať nevyhnutné cookies, analytické cookies a prípadne marketingové cookies.\n            Nepovinné cookies by mali byť používané len na základe platného súhlasu používateľa.',
    sp('Web môže používať nevyhnutné cookies, analytické cookies a prípadne marketingové cookies. Nepovinné cookies by mali byť používané len na základe platného súhlasu používateľa.', 'Web může používat nezbytné cookies, analytické cookies a případně marketingové cookies. Nepovinné cookies by měly být používány pouze na základě platného souhlasu uživatele.')
  ],
  [
    'Ak používaš analytiku alebo remarketing, samotný text nestačí. Musíš mať aj reálne implementovaný cookie banner a evidenciu súhlasov.',
    sp('Ak používaš analytiku alebo remarketing, samotný text nestačí. Musíš mať aj reálne implementovaný cookie banner a evidenciu súhlasov.', 'Pokud používáme analytiku nebo remarketing, samotný text nestačí. Je nutné mít i reálně implementovaný cookie banner a evidenci souhlasů.')
  ],

  // Privacy 11
  ['<h3>11. Bezpečnosť</h3>', `<h3>${sp('11. Bezpečnosť', '11. Bezpečnost')}</h3>`],
  [
    'Prevádzkovateľ prijíma primerané technické a organizačné opatrenia na ochranu osobných údajov,\n            najmä obmedzenie prístupu, minimalizáciu údajov, bezpečnostné aktualizácie a ochranu dát pri prenose.',
    sp('Prevádzkovateľ prijíma primerané technické a organizačné opatrenia na ochranu osobných údajov, najmä obmedzenie prístupu, minimalizáciu údajov, bezpečnostné aktualizácie a ochranu dát pri prenose.', 'Provozovatel přijímá přiměřená technická a organizační opatření k ochraně osobních údajů, zejména omezení přístupu, minimalizaci údajů, bezpečnostní aktualizace a ochranu dat při přenosu.')
  ],

  // Privacy 12
  ['<h3>12. Kontakt</h3>', `<h3>${sp('12. Kontakt', '12. Kontakt')}</h3>`],
  [
    'Ak si používateľ želá uplatniť svoje práva alebo má otázky k spracúvaniu osobných údajov,\n            môže kontaktovať prevádzkovateľa na adrese <strong>juraj@jurajkurek.com</strong>.',
    sp('Ak si používateľ želá uplatniť svoje práva alebo má otázky k spracúvaniu osobných údajov, môže kontaktovať prevádzkovateľa na adrese <strong>juraj@jurajkurek.com</strong>.', 'Pokud si uživatel přeje uplatnit svá práva nebo má otázky ke zpracování osobních údajů, může kontaktovat provozovatele na adrese <strong>juraj@jurajkurek.com</strong>.')
  ],

  // footer-cta
  ['<h3>Právny základ má byť<br><em>jasný, nie ukrytý.</em></h3>', `<h3>${sp('Právny základ má byť<br><em>jasný, nie ukrytý.</em>', 'Právní základ má být<br><em>jasný, ne skrytý.</em>')}</h3>`],
  ['<a href="/" class="btn-primary">Späť na landing page →</a>', `<a href="/" class="btn-primary">${sp('Späť na landing page →', 'Zpět na landing page →')}</a>`],

  // footer links
  ['<a href="/app">Aplikácia</a>', `<a href="/app">${sp('Aplikácia', 'Aplikace')}</a>`],
  ['<a href="mailto:juraj@jurajkurek.com">Kontakt</a>', `<a href="mailto:juraj@jurajkurek.com">${sp('Kontakt', 'Kontakt')}</a>`],
  ['<a href="#vop">Podmienky</a>', `<a href="#vop">${sp('Podmienky', 'Podmínky')}</a>`],
  ['<a href="#privacy">Súkromie</a>', `<a href="#privacy">${sp('Súkromie', 'Soukromí')}</a>`]
];

let NEW_BODY = OLD_BODY;
for (const [oldStr, newStr] of REPLACEMENTS) {
  if (!NEW_BODY.includes(oldStr)) {
    console.error(`❌ Nenašiel som v tele stránky očakávaný text: "${oldStr.slice(0, 60)}...". Nič som nezmenil.`);
    process.exit(1);
  }
  NEW_BODY = NEW_BODY.split(oldStr).join(newStr);
}

// ─── JS: setLanguage() pre legal.html (samostatná, ale rovnaký localStorage kľúč ako index.html) ──
const OLD_FOOTER_SCRIPT_ANCHOR = `</body>
</html>`;

const NEW_SCRIPT = `<script>
(function(){
  var TITLES = {
    sk: 'Podmienky a ochrana osobných údajov — SP Tréner',
    cs: 'Podmínky a ochrana osobních údajů — SP Tréner'
  };
  var DESCS = {
    sk: 'Všeobecné obchodné podmienky a zásady ochrany osobných údajov pre SP Tréner.',
    cs: 'Všeobecné obchodní podmínky a zásady ochrany osobních údajů pro SP Tréner.'
  };
  window.setLanguage = function(lang){
    var l = lang === 'cs' ? 'cs' : 'sk';
    document.body.classList.toggle('lang-cs', l === 'cs');
    document.getElementById('htmlRoot').setAttribute('lang', l);
    document.getElementById('pageTitle').textContent = TITLES[l];
    document.getElementById('pageDesc').setAttribute('content', DESCS[l]);
    try { localStorage.setItem('vsp-lang', l); } catch(e){}
  };
  var saved = 'sk';
  try { saved = localStorage.getItem('vsp-lang') === 'cs' ? 'cs' : 'sk'; } catch(e){}
  setLanguage(saved);
})();
</script>
</body>
</html>`;

// ─── Aplikovanie ────────────────────────────────────────────────
if (src.includes('i18n-sk')) {
  console.error('❌ Vyzerá to, že český preklad je už aplikovaný. Nič som nezmenil.');
  process.exit(1);
}
for (const [name, str] of [
  ['<head>', OLD_HEAD],
  ['CSS kotva pre .nav-cta:hover', OLD_CSS_ANCHOR],
  ['nav lang-switcher', OLD_NAV],
  ['telo stránky (ticker/VOP/privacy/footer)', OLD_BODY],
  ['koniec </body></html>', OLD_FOOTER_SCRIPT_ANCHOR]
]) {
  if (!src.includes(str)) {
    console.error(`❌ Nenašiel som očakávaný blok "${name}" presne. Nič som nezmenil.`);
    if (name === 'nav lang-switcher') {
      console.error('   (Očakával som nav už upravenú skriptom 16-unify-nav-footer-full.js. Ak je nav iná, pošli mi jej aktuálny obsah.)');
    }
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-cz-translation-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_HEAD, NEW_HEAD);
out = out.replace(OLD_CSS_ANCHOR, NEW_CSS_BLOCK);
out = out.replace(OLD_NAV, NEW_NAV);
out = out.replace(OLD_BODY, NEW_BODY);
out = out.replace(OLD_FOOTER_SCRIPT_ANCHOR, NEW_SCRIPT);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ legal.html má teraz plný český preklad a funkčný prepínač jazyka (SK/CZ) priamo na stránke.');
console.log('   Záloha pôvodného legal.html:', backupPath);
