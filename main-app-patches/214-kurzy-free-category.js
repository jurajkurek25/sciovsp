// Kategórie kurzov na /kurzy prestávajú byť obmedzené na 3 pevné hodnoty --
// pills sa teraz počítajú dynamicky z toho, čo naozaj existuje v courses.category
// (rovnaká konvencia ako /blog a /odporucame), nie z pevného zoznamu. Predtým
// kurz s inou kategóriou (napr. novo pridanou cez dash/instructor admin) by
// v pills vôbec nedostal vlastnú kategóriu -- ostal by len v "Všetko".
// Ikonky (🎯 ✍️ 🧠) zostávajú ako pekná dekorácia pre 3 pôvodné kategórie,
// akákoľvek nová kategória sa zobrazí ako čistý text bez ikonky.
//
// Kotva je CELÁ /kurzy route (atomická náhrada, overená byte-presne cez
// main-app-patches/209/212 výstup).
//
// VYŽADUJE: main-app-patches/db/migrate_courses_category_freetext.sql už
// spustený v Supabase (mení existujúce 3 slugy na čitateľný text -- inak by
// staré kurzy zrazu nemali žiadnu kategóriu na pills).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/214-kurzy-free-category.js

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.join(process.cwd(), "server.js");
if (!fs.existsSync(SERVER_PATH)) {
  console.error("❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".214-kurzy-free-category-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(SERVER_PATH, "utf8");

const OLD = "app.get('/kurzy', async (req, res) => {\n  try {\n    const lang = blogLang(req);\n    const T = lang === 'cs' ? {\n      pageTitle: 'Video kurzy — SP Tréner', description: 'Video kurzy na přípravu k přijímacím testům — lekce s videem, materiály ke stažení a kvízem po každé lekci.',\n      heading: 'Video kurzy', sub: 'Teoretický doplněk k praktickým testům — video lekce, materiály ke stažení a kvíz v každé lekci.',\n      empty: 'Zatím tu nejsou žádné kurzy.', breadcrumb: 'Kurzy',\n      filterAll: 'Vše', searchPlaceholder: 'Hledat…', noResults: 'Nic jsme nenašli. Zkus jiné hledání nebo kategorii.'\n    } : {\n      pageTitle: 'Video kurzy — SP Tréner', description: 'Video kurzy na prípravu k prijímacím testom — lekcie s videom, materiálmi na stiahnutie a kvízom po každej lekcii.',\n      heading: 'Video kurzy', sub: 'Teoretický doplnok k praktickým testom — video lekcie, materiály na stiahnutie a kvíz v každej lekcii.',\n      empty: 'Zatiaľ tu nie sú žiadne kurzy.', breadcrumb: 'Kurzy',\n      filterAll: 'Všetko', searchPlaceholder: 'Hľadať…', noResults: 'Nič sme nenašli. Skús iné hľadanie alebo kategóriu.'\n    };\n    const COURSE_CATEGORIES = {\n      'priprava-na-skusku': { sk: '🎯 Príprava na skúšku', cs: '🎯 Příprava na zkoušku' },\n      'prihlaska': { sk: '✍️ Prihláška', cs: '✍️ Přihláška' },\n      'osobny-rozvoj': { sk: '🧠 Osobný rozvoj', cs: '🧠 Osobní rozvoj' }\n    };\n    const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents,cover_image_url,category').eq('published', true).order('created_at', { ascending: false });\n    const list = courses || [];\n    const catList = [];\n    const catSeen = {};\n    list.forEach(c => { if (c.category && COURSE_CATEGORIES[c.category] && !catSeen[c.category]) { catSeen[c.category] = true; catList.push(c.category); } });\n    const filterBar = catList.length ? `\n      <div class=\"filter-bar\">\n        <input type=\"text\" class=\"filter-search\" id=\"kurzySearch\" placeholder=\"${escapeHtml(T.searchPlaceholder)}\" oninput=\"kurzyFilter()\">\n        <div class=\"filter-pills\" id=\"kurzyPills\">\n          <span class=\"filter-pill active\" data-cat=\"\" onclick=\"kurzySetCat(this)\">${escapeHtml(T.filterAll)}</span>\n          ${catList.map(cat => `<span class=\"filter-pill\" data-cat=\"${escapeHtml(cat)}\" onclick=\"kurzySetCat(this)\">${escapeHtml(COURSE_CATEGORIES[cat][lang] || COURSE_CATEGORIES[cat].sk)}</span>`).join('')}\n        </div>\n      </div>` : '';\n    const filterScript = catList.length ? `\n      <script>\n      var kurzyActiveCat = '';\n      function kurzySetCat(el){\n        document.querySelectorAll('#kurzyPills .filter-pill').forEach(function(p){ p.classList.remove('active'); });\n        el.classList.add('active');\n        kurzyActiveCat = el.getAttribute('data-cat') || '';\n        kurzyFilter();\n      }\n      function kurzyFilter(){\n        var q = (document.getElementById('kurzySearch').value || '').trim().toLowerCase();\n        var anyVisible = false;\n        document.querySelectorAll('.course-card').forEach(function(card){\n          var matchesCat = !kurzyActiveCat || card.getAttribute('data-cat') === kurzyActiveCat;\n          var matchesSearch = !q || (card.getAttribute('data-search') || '').indexOf(q) !== -1;\n          var visible = matchesCat && matchesSearch;\n          card.style.display = visible ? '' : 'none';\n          if (visible) anyVisible = true;\n        });\n        document.getElementById('kurzyEmpty').style.display = anyVisible ? 'none' : 'block';\n      }\n      </script>` : '';\n    const grid = list.length\n      ? `${KURZY_STYLE}${filterBar}<div class=\"course-grid\">${list.map(c => courseCardHtml(c, lang)).join('')}</div><p class=\"filter-empty\" id=\"kurzyEmpty\">${escapeHtml(T.noResults)}</p>${filterScript}`\n      : `${KURZY_STYLE}<div class=\"empty-state\">${T.empty}</div>`;\n    const body = `<main class=\"page\">\n      <nav class=\"breadcrumb\"><a href=\"/${lang === 'cs' ? '?lang=cs' : ''}\">SP Tréner</a><span>/</span><span>${T.breadcrumb}</span></nav>\n      <h1 class=\"hero-title\">${T.heading}</h1>\n      <p class=\"hero-sub\">${T.sub}</p>\n      ${grid}\n    </main>`;\n    const jsonLd = {\n      '@context': 'https://schema.org', '@type': 'ItemList',\n      itemListElement: list.map((c, i) => ({ '@type': 'Course', position: i + 1, name: c.title, url: BASE_URL_BLOG + '/kurzy/' + c.slug }))\n    };\n    res.send(blogLayout({\n      title: T.pageTitle,\n      description: T.description,\n      body, canonicalPath: '/kurzy', jsonLd: [jsonLd], lang\n    }));\n  } catch (e) {\n    res.status(500).send('Chyba servera.');\n  }\n});\n";
const NEW = "app.get('/kurzy', async (req, res) => {\n  try {\n    const lang = blogLang(req);\n    const T = lang === 'cs' ? {\n      pageTitle: 'Video kurzy — SP Tréner', description: 'Video kurzy na přípravu k přijímacím testům — lekce s videem, materiály ke stažení a kvízem po každé lekci.',\n      heading: 'Video kurzy', sub: 'Teoretický doplněk k praktickým testům — video lekce, materiály ke stažení a kvíz v každé lekci.',\n      empty: 'Zatím tu nejsou žádné kurzy.', breadcrumb: 'Kurzy',\n      filterAll: 'Vše', searchPlaceholder: 'Hledat…', noResults: 'Nic jsme nenašli. Zkus jiné hledání nebo kategorii.'\n    } : {\n      pageTitle: 'Video kurzy — SP Tréner', description: 'Video kurzy na prípravu k prijímacím testom — lekcie s videom, materiálmi na stiahnutie a kvízom po každej lekcii.',\n      heading: 'Video kurzy', sub: 'Teoretický doplnok k praktickým testom — video lekcie, materiály na stiahnutie a kvíz v každej lekcii.',\n      empty: 'Zatiaľ tu nie sú žiadne kurzy.', breadcrumb: 'Kurzy',\n      filterAll: 'Všetko', searchPlaceholder: 'Hľadať…', noResults: 'Nič sme nenašli. Skús iné hľadanie alebo kategóriu.'\n    };\n    const CATEGORY_ICONS = { 'Príprava na skúšku': '🎯', 'Příprava na zkoušku': '🎯', 'Prihláška': '✍️', 'Přihláška': '✍️', 'Osobný rozvoj': '🧠', 'Osobní rozvoj': '🧠' };\n    const categoryLabel = (cat) => (CATEGORY_ICONS[cat] ? CATEGORY_ICONS[cat] + ' ' : '') + cat;\n    const { data: courses } = await supabase.from('courses').select('slug,title,description,price_cents,cover_image_url,category').eq('published', true).order('created_at', { ascending: false });\n    const list = courses || [];\n    const catList = [];\n    const catSeen = {};\n    list.forEach(c => { if (c.category && !catSeen[c.category]) { catSeen[c.category] = true; catList.push(c.category); } });\n    const filterBar = catList.length ? `\n      <div class=\"filter-bar\">\n        <input type=\"text\" class=\"filter-search\" id=\"kurzySearch\" placeholder=\"${escapeHtml(T.searchPlaceholder)}\" oninput=\"kurzyFilter()\">\n        <div class=\"filter-pills\" id=\"kurzyPills\">\n          <span class=\"filter-pill active\" data-cat=\"\" onclick=\"kurzySetCat(this)\">${escapeHtml(T.filterAll)}</span>\n          ${catList.map(cat => `<span class=\"filter-pill\" data-cat=\"${escapeHtml(cat)}\" onclick=\"kurzySetCat(this)\">${escapeHtml(categoryLabel(cat))}</span>`).join('')}\n        </div>\n      </div>` : '';\n    const filterScript = catList.length ? `\n      <script>\n      var kurzyActiveCat = '';\n      function kurzySetCat(el){\n        document.querySelectorAll('#kurzyPills .filter-pill').forEach(function(p){ p.classList.remove('active'); });\n        el.classList.add('active');\n        kurzyActiveCat = el.getAttribute('data-cat') || '';\n        kurzyFilter();\n      }\n      function kurzyFilter(){\n        var q = (document.getElementById('kurzySearch').value || '').trim().toLowerCase();\n        var anyVisible = false;\n        document.querySelectorAll('.course-card').forEach(function(card){\n          var matchesCat = !kurzyActiveCat || card.getAttribute('data-cat') === kurzyActiveCat;\n          var matchesSearch = !q || (card.getAttribute('data-search') || '').indexOf(q) !== -1;\n          var visible = matchesCat && matchesSearch;\n          card.style.display = visible ? '' : 'none';\n          if (visible) anyVisible = true;\n        });\n        document.getElementById('kurzyEmpty').style.display = anyVisible ? 'none' : 'block';\n      }\n      </script>` : '';\n    const grid = list.length\n      ? `${KURZY_STYLE}${filterBar}<div class=\"course-grid\">${list.map(c => courseCardHtml(c, lang)).join('')}</div><p class=\"filter-empty\" id=\"kurzyEmpty\">${escapeHtml(T.noResults)}</p>${filterScript}`\n      : `${KURZY_STYLE}<div class=\"empty-state\">${T.empty}</div>`;\n    const body = `<main class=\"page\">\n      <nav class=\"breadcrumb\"><a href=\"/${lang === 'cs' ? '?lang=cs' : ''}\">SP Tréner</a><span>/</span><span>${T.breadcrumb}</span></nav>\n      <h1 class=\"hero-title\">${T.heading}</h1>\n      <p class=\"hero-sub\">${T.sub}</p>\n      ${grid}\n    </main>`;\n    const jsonLd = {\n      '@context': 'https://schema.org', '@type': 'ItemList',\n      itemListElement: list.map((c, i) => ({ '@type': 'Course', position: i + 1, name: c.title, url: BASE_URL_BLOG + '/kurzy/' + c.slug }))\n    };\n    res.send(blogLayout({\n      title: T.pageTitle,\n      description: T.description,\n      body, canonicalPath: '/kurzy', jsonLd: [jsonLd], lang\n    }));\n  } catch (e) {\n    res.status(500).send('Chyba servera.');\n  }\n});\n";

if (src.includes("const categoryLabel = (cat) =>")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  const count = src.split(OLD).length - 1;
  if (count !== 1) {
    console.error("❌ Kotva /kurzy route nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  src = src.replace(OLD, () => NEW);
  const backup = SERVER_PATH + ".pre-214-kurzy-free-category-" + Date.now();
  fs.copyFileSync(SERVER_PATH, backup);
  fs.writeFileSync(SERVER_PATH, src);
  console.log("✅ server.js prepísaný (/kurzy pills teraz fungujú pre akúkoľvek kategóriu). Záloha:", backup);
}

console.log("");
console.log("Over: node -c server.js");
console.log("Reštart: pm2 restart <meno procesu hlavnej appky> (over cez pm2 list).");
