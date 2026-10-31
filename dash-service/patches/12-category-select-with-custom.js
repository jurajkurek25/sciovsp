// Mení kategóriu kurzov z voľného textu (patches/11) na Select + explicitná
// "Vlastná kategória" voľba (odkryje textové pole), s explicitným "Bez
// kategórie". Rovnaká zmena ako instructor-service/patches/09 -- dôvod:
// aj keď dash už vidí kategórie naprieč všetkými kurzami (žiadny nový
// endpoint netreba), voľný text nenúti admina/inštruktora vybrať z
// existujúceho, takže pri viacerých prispievateľoch (admin + inštruktori)
// mohli vznikať mierne odlišné varianty tej istej kategórie.
//
// Kotvy: 3 malé kotvy v public/index.html (courseFormHtml() select+input,
// bindCourseForm() onchange prepínač + logika ukladania).
//
// Spusti z koreňa dash-service:
//   node patches/12-category-select-with-custom.js

const fs = require("fs");
const path = require("path");

const HTML_PATH = path.join(process.cwd(), "public", "index.html");
if (!fs.existsSync(HTML_PATH)) {
  console.error("❌ Nenašiel som public/index.html — spusti z koreňa dash-service.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".12-category-select-with-custom-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error("❌ " + label + " — kotva nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil.");
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let html = fs.readFileSync(HTML_PATH, "utf8");

if (html.includes("cf-category-custom")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  {
    const OLD = "    <h4 style=\"margin-top:1.2rem\">Kategória</h4>\n    <p class=\"muted\" style=\"margin-top:-.4rem;margin-bottom:.5rem\">Voľný text — môžeš zadať existujúcu kategóriu (z ponuky) alebo napísať úplne novú. Podľa nej sa kurz dá filtrovať na /kurzy. Voliteľné.</p>\n    <input class=\"cf-category\" list=\"cf-category-list\" placeholder=\"napr. Príprava na skúšku\" value=\"${(c?.category||'').replace(/\"/g,'&quot;')}\" style=\"width:100%;max-width:360px;padding:.6rem .8rem;background:var(--black3);border:1px solid var(--border2);border-radius:8px;font-size:.83rem;box-sizing:border-box\">\n    <datalist id=\"cf-category-list\">${(categories||[]).map(cat => `<option value=\"${cat.replace(/\"/g,'&quot;')}\">`).join('')}</datalist>\n    ${coverFieldHtml('cf-cover', c?.cover_image_url)}";
    const NEW = "    <h4 style=\"margin-top:1.2rem\">Kategória</h4>\n    <p class=\"muted\" style=\"margin-top:-.4rem;margin-bottom:.5rem\">Kategórie vidia a používajú všetci inštruktori aj ty — ak nenájdeš vhodnú, vyber \"Vlastná kategória\" a napíš novú. Podľa nej sa kurz dá filtrovať na /kurzy. Voliteľné.</p>\n    <select class=\"cf-category\" style=\"width:100%;max-width:360px;padding:.6rem .8rem;background:var(--black3);border:1px solid var(--border2);border-radius:8px;font-size:.83rem;appearance:none;-webkit-appearance:none;background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%238a8aa3%22><path d=%22M5.5 7.5l4.5 5 4.5-5z%22/></svg>');background-repeat:no-repeat;background-position:right .7rem center;background-size:1.1rem\">\n      <option value=\"\" ${!c?.category ? 'selected' : ''}>Bez kategórie</option>\n      ${(categories||[]).map(cat => `<option value=\"${cat.replace(/\"/g,'&quot;')}\" ${c?.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}\n      <option value=\"__custom__\" ${(c?.category && !(categories||[]).includes(c.category)) ? 'selected' : ''}>+ Vlastná kategória…</option>\n    </select>\n    <input class=\"cf-category-custom\" placeholder=\"Napíš novú kategóriu\" value=\"${(c?.category && !(categories||[]).includes(c.category)) ? c.category.replace(/\"/g,'&quot;') : ''}\" style=\"width:100%;max-width:360px;padding:.6rem .8rem;background:var(--black3);border:1px solid var(--border2);border-radius:8px;font-size:.83rem;box-sizing:border-box;margin-top:.5rem;display:${(c?.category && !(categories||[]).includes(c.category)) ? 'block' : 'none'}\">\n    ${coverFieldHtml('cf-cover', c?.cover_image_url)}";
    html = replaceOnce(html, OLD, NEW, "FIELD");
  }
  {
    const OLD = "  const accessModeEl = $('.cf-access-mode', root);\n  const tierRow = $('.cf-tier-row', root);\n  accessModeEl.onchange = () => { tierRow.style.display = accessModeEl.value === 'subscription' ? 'flex' : 'none'; };\n  $('.cf-save', root).onclick = async () => {";
    const NEW = "  const accessModeEl = $('.cf-access-mode', root);\n  const tierRow = $('.cf-tier-row', root);\n  accessModeEl.onchange = () => { tierRow.style.display = accessModeEl.value === 'subscription' ? 'flex' : 'none'; };\n  const categoryEl = $('.cf-category', root);\n  const categoryCustomEl = $('.cf-category-custom', root);\n  categoryEl.onchange = () => { categoryCustomEl.style.display = categoryEl.value === '__custom__' ? 'block' : 'none'; };\n  $('.cf-save', root).onclick = async () => {";
    html = replaceOnce(html, OLD, NEW, "BIND");
  }
  {
    const OLD = "      includedInPremium: $('.cf-tier-premium', root).checked, includedInElite: $('.cf-tier-elite', root).checked,\n      category: $('.cf-category', root).value.trim()\n    };";
    const NEW = "      includedInPremium: $('.cf-tier-premium', root).checked, includedInElite: $('.cf-tier-elite', root).checked,\n      category: categoryEl.value === '__custom__' ? categoryCustomEl.value.trim() : categoryEl.value\n    };";
    html = replaceOnce(html, OLD, NEW, "SAVEBODY");
  }

  const backup = HTML_PATH + ".pre-12-category-select-with-custom-" + Date.now();
  fs.copyFileSync(HTML_PATH, backup);
  fs.writeFileSync(HTML_PATH, html);
  console.log("✅ public/index.html: kategória je teraz Select (naprieč všetkými kurzami) + Vlastná kategória voľba. Záloha:", backup);
}

console.log("");
console.log("Reštart: pm2 restart sptrener-dash");
