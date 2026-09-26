// Pridáva "PR článok" ako tretiu možnosť na landing.html: nová karta v
// cenníku (249€ jednorazovo), nová "why" karta vysvetľujúca AI-driven
// proces, a nová FAQ otázka.
//
// Presný textový match proti overenému živému súboru public/landing.html.
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/05-landing-pr-article.js

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'public', 'landing.html');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('PR článok')) {
  console.error('❌ Vyzerá to, že PR článok už je na landing.html. Nič som nezmenil.');
  process.exit(1);
}

const OLD_WHY_LAST = `    <div class="why-card">
      <div class="why-icon">🛡️</div>
      <h3>Brand-safe prostredie</h3>
      <p>Každá kreatíva aj jej cieľová stránka prejde automatickou AI kontrolou (podvody, nelegálny či pre maloletých nevhodný obsah) ešte pred zverejnením — v priebehu sekúnd, žiadne čakanie na schválenie. Tvoja značka sa nikdy neocitne vedľa niečoho trápneho ani vedľa konkurenčného podvodu.</p>
    </div>
  </div>
</section>`;

const NEW_WHY_LAST = `    <div class="why-card">
      <div class="why-icon">🛡️</div>
      <h3>Brand-safe prostredie</h3>
      <p>Každá kreatíva aj jej cieľová stránka prejde automatickou AI kontrolou (podvody, nelegálny či pre maloletých nevhodný obsah) ešte pred zverejnením — v priebehu sekúnd, žiadne čakanie na schválenie. Tvoja značka sa nikdy neocitne vedľa niečoho trápneho ani vedľa konkurenčného podvodu.</p>
    </div>
    <div class="why-card">
      <div class="why-icon">✍️</div>
      <h3>PR článok, ktorý za teba napíše AI</h3>
      <p>Napíšeš pár viet o produkte, AI sa doopýta na detaily a po zaplatení sám vygeneruje, skontroluje a vypublikuje bilingválny (SK+CZ) článok na blog — trvalý SEO odkaz, nie rotujúci slot.</p>
    </div>
  </div>
</section>`;

const OLD_PRICING = `    <div class="price-card highlight">
      <h3>Video reklama</h3>
      <div class="price-tag">149€</div>
      <span class="price-period">/ mesiac / video</span>
      <div class="price-feats">
        <span>MP4 so zvukom, 5–180 sekúnd, max 25 MB</span>
        <span>Max. 3 aktívne video reklamy naraz</span>
        <span>Odmeňovaný formát — garantované celé dopozretie</span>
        <span>Zruš kedykoľvek</span>
      </div>
      <a href="/dashboard" class="btn-primary">Nahrať video →</a>
    </div>
  </div>
</section>`;

const NEW_PRICING = `    <div class="price-card highlight">
      <h3>Video reklama</h3>
      <div class="price-tag">149€</div>
      <span class="price-period">/ mesiac / video</span>
      <div class="price-feats">
        <span>MP4 so zvukom, 5–180 sekúnd, max 25 MB</span>
        <span>Max. 3 aktívne video reklamy naraz</span>
        <span>Odmeňovaný formát — garantované celé dopozretie</span>
        <span>Zruš kedykoľvek</span>
      </div>
      <a href="/dashboard" class="btn-primary">Nahrať video →</a>
    </div>
    <div class="price-card">
      <h3>PR článok</h3>
      <div class="price-tag" style="color:var(--purple2)">249€</div>
      <span class="price-period">jednorazovo, natrvalo na blogu</span>
      <div class="price-feats">
        <span>AI sa ťa opýta na produkt a napíše bilingválny (SK+CZ) článok</span>
        <span>Automatická kontrola obsahu pred publikovaním</span>
        <span>Trvalý SEO odkaz na blog.sptrener.online — nie rotujúci slot</span>
        <span>Jednorazová platba, žiadne predplatné</span>
      </div>
      <a href="/dashboard" class="btn-primary">Vytvoriť PR článok →</a>
    </div>
  </div>
</section>`;

const OLD_FAQ_LAST = `    <details>
      <summary>Platím za účet, alebo za každý banner/video zvlášť?</summary>
      <p>Za každú kreatívu samostatne. Účet je zdarma a môžeš mať neobmedzene bannerov/videí — platíš len za tie, ktoré chceš mať aktívne v rotácii.</p>
    </details>
  </div>
</section>`;

const NEW_FAQ_LAST = `    <details>
      <summary>Platím za účet, alebo za každý banner/video zvlášť?</summary>
      <p>Za každú kreatívu samostatne. Účet je zdarma a môžeš mať neobmedzene bannerov/videí — platíš len za tie, ktoré chceš mať aktívne v rotácii.</p>
    </details>
    <details>
      <summary>Ako presne funguje PR článok?</summary>
      <p>Napíšeš pár viet o produkte a o tom, prečo sa hodí našim čitateľom. AI sa ťa opýta 5 doplňujúcich otázok, na ktoré odpovieš. Po zaplatení (249€ jednorazovo) AI sama vygeneruje kompletný bilingválny článok, skontroluje ho a rovno vypublikuje na blog.sptrener.online — bez čakania na manuálne schválenie.</p>
    </details>
  </div>
</section>`;

for (const [name, needle] of [['why-grid koniec', OLD_WHY_LAST], ['pricing-grid', OLD_PRICING], ['faq koniec', OLD_FAQ_LAST]]) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v landing.html. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-pr-article-landing-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_WHY_LAST, NEW_WHY_LAST);
out = out.replace(OLD_PRICING, NEW_PRICING);
out = out.replace(OLD_FAQ_LAST, NEW_FAQ_LAST);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ PR článok pridaný na landing.html (why karta, cenník, FAQ).');
console.log('   Záloha pôvodného landing.html:', backupPath);
