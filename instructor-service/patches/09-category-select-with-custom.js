// Mení kategóriu kurzov z voľného textu (patches/06/08) na Select + explicitná
// "Vlastná kategória" voľba (odkryje textové pole), s explicitným "Bez
// kategórie". Dôvod: pri voľnom texte by si každý inštruktor mohol
// vymyslieť mierne inú variantu tej istej kategórie ("Právo" vs "právo" vs
// "Pravo") -- Select núti vyberať z existujúcich, kým "Vlastná kategória"
// stále umožní pridať novú, keď treba.
//
// Pridáva nový endpoint GET /api/instructor/categories (kategórie naprieč
// VŠETKÝMI kurzami, nie len tohto inštruktora -- pôvodný datalist videl
// len vlastné kurzy inštruktora, čo bol presne dôvod tejto zmeny).
//
// Kotvy: malá vsuvka v routes/courses.js + 7 malých kotiev v public/index.html
// (i18n SK/CS, fetch kategórií, <select>+<input> namiesto <input list>,
// onchange prepínač, saveCourse() logika).
//
// Spusti z koreňa instructor-service:
//   node patches/09-category-select-with-custom.js

const fs = require("fs");
const path = require("path");

const ROUTES_PATH = path.join(process.cwd(), "routes", "courses.js");
const HTML_PATH = path.join(process.cwd(), "public", "index.html");

if (!fs.existsSync(ROUTES_PATH) || !fs.existsSync(HTML_PATH)) {
  console.error("❌ Nenašiel som routes/courses.js alebo public/index.html — spusti z koreňa instructor-service.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".09-category-select-with-custom-lock");
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

// ── 1) routes/courses.js -- nový endpoint /api/instructor/categories ──
let routesSrc = fs.readFileSync(ROUTES_PATH, "utf8");
if (routesSrc.includes("/api/instructor/categories")) {
  console.log("ℹ️  routes/courses.js: už je aplikované, preskakujem.");
} else {
  const ROUTES_OLD = "router.get('/api/instructor/courses', requireInstructorAuth, async (req, res) => {\n  const { data: courses, error } = await mainDb.from('courses').select('*').eq('instructor_id', req.instructor.id).order('created_at', { ascending: false });\n  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }\n  const withCounts = await Promise.all((courses || []).map(async c => {\n    const { count: lessonCount } = await mainDb.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', c.id);\n    const { count: purchaseCount } = await mainDb.from('course_purchases').select('*', { count: 'exact', head: true }).eq('course_id', c.id);\n    return { ...c, lessonCount: lessonCount || 0, purchaseCount: purchaseCount || 0 };\n  }));\n  res.json({ courses: withCounts });\n});\n\nfunction cleanCategory(category) {";
  const ROUTES_NEW = "router.get('/api/instructor/courses', requireInstructorAuth, async (req, res) => {\n  const { data: courses, error } = await mainDb.from('courses').select('*').eq('instructor_id', req.instructor.id).order('created_at', { ascending: false });\n  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }\n  const withCounts = await Promise.all((courses || []).map(async c => {\n    const { count: lessonCount } = await mainDb.from('course_lessons').select('*', { count: 'exact', head: true }).eq('course_id', c.id);\n    const { count: purchaseCount } = await mainDb.from('course_purchases').select('*', { count: 'exact', head: true }).eq('course_id', c.id);\n    return { ...c, lessonCount: lessonCount || 0, purchaseCount: purchaseCount || 0 };\n  }));\n  res.json({ courses: withCounts });\n});\n\n// Kategórie naprieč VŠETKÝMI kurzami (nielen tohto inštruktora) -- aby si\n// inštruktori navzájom nevymýšľali odlišné varianty tej istej kategórie.\n// Vracia len samotné texty kategórií (žiadne iné údaje o cudzích kurzoch).\nrouter.get('/api/instructor/categories', requireInstructorAuth, async (req, res) => {\n  const { data: courses, error } = await mainDb.from('courses').select('category');\n  if (error) { console.error(error); return res.status(500).json({ error: error.message }); }\n  const categories = [...new Set((courses || []).map(c => c.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'sk'));\n  res.json({ categories });\n});\n\nfunction cleanCategory(category) {";
  routesSrc = replaceOnce(routesSrc, ROUTES_OLD, ROUTES_NEW, "routes.js: pridanie /api/instructor/categories");
  const routesBackup = ROUTES_PATH + ".pre-09-category-select-with-custom-" + Date.now();
  fs.copyFileSync(ROUTES_PATH, routesBackup);
  fs.writeFileSync(ROUTES_PATH, routesSrc);
  console.log("✅ routes/courses.js: pridaný endpoint /api/instructor/categories. Záloha:", routesBackup);
}

// ── 2) public/index.html -- 7 malých kotiev ──
let html = fs.readFileSync(HTML_PATH, "utf8");

if (html.includes("f-category-custom")) {
  console.log("ℹ️  public/index.html: už je aplikované, preskakujem.");
} else {
  {
    const OLD = "categoryLabel: 'Kategória', categoryHint: 'Voľný text — zadaj existujúcu kategóriu z ponuky alebo napíš úplne novú.', categoryPrep: 'Príprava na skúšku', categoryApp: 'Prihláška', categoryGrowth: 'Osobný rozvoj',";
    const NEW = "categoryLabel: 'Kategória', categoryNone: 'Bez kategórie', categoryCustom: '+ Vlastná kategória…', categoryCustomPlaceholder: 'Napíš novú kategóriu', categoryHint: 'Kategórie vidia a používajú všetci inštruktori — ak nenájdeš vhodnú, vyber \"Vlastná kategória\" a napíš novú.',";
    html = replaceOnce(html, OLD, NEW, "SK");
  }
  {
    const OLD = "categoryLabel: 'Kategorie', categoryHint: 'Volný text — zadej existující kategorii z nabídky nebo napiš úplně novou.', categoryPrep: 'Příprava na zkoušku', categoryApp: 'Přihláška', categoryGrowth: 'Osobní rozvoj',";
    const NEW = "categoryLabel: 'Kategorie', categoryNone: 'Bez kategorie', categoryCustom: '+ Vlastní kategorie…', categoryCustomPlaceholder: 'Napiš novou kategorii', categoryHint: 'Kategorie vidí a používají všichni instruktoři — pokud nenajdeš vhodnou, vyber \"Vlastní kategorie\" a napiš novou.',";
    html = replaceOnce(html, OLD, NEW, "CS");
  }
  {
    const OLD = "  let coursesData, lessonsData;\n  try {\n    [coursesData, lessonsData] = await Promise.all([\n      api('/api/instructor/courses'), api(`/api/instructor/courses/${id}/lessons`)\n    ]);\n  } catch (e) { tabRoot.innerHTML = `<p class=\"feedback err\">${escapeHtml(e.message)}</p>`; return; }";
    const NEW = "  let coursesData, lessonsData, categoriesData;\n  try {\n    [coursesData, lessonsData, categoriesData] = await Promise.all([\n      api('/api/instructor/courses'), api(`/api/instructor/courses/${id}/lessons`), api('/api/instructor/categories')\n    ]);\n  } catch (e) { tabRoot.innerHTML = `<p class=\"feedback err\">${escapeHtml(e.message)}</p>`; return; }";
    html = replaceOnce(html, OLD, NEW, "FETCH");
  }
  {
    const OLD = "      <div class=\"field\">\n        <label>${t('categoryLabel')}</label>\n        <input id=\"f-category\" list=\"f-category-list\" value=\"${escapeHtml(course.category || '')}\">\n        <datalist id=\"f-category-list\">${[...new Set([t('categoryPrep'), t('categoryApp'), t('categoryGrowth'), ...(coursesData.courses || []).map(c => c.category).filter(Boolean)])].map(cat => `<option value=\"${escapeHtml(cat)}\">`).join('')}</datalist>\n        <p class=\"muted\" style=\"margin-top:.3rem\">${t('categoryHint')}</p>\n      </div>";
    const NEW = "      <div class=\"field\">\n        <label>${t('categoryLabel')}</label>\n        <select id=\"f-category\">\n          <option value=\"\" ${!course.category ? 'selected' : ''}>${t('categoryNone')}</option>\n          ${(categoriesData.categories || []).map(cat => `<option value=\"${escapeHtml(cat)}\" ${course.category === cat ? 'selected' : ''}>${escapeHtml(cat)}</option>`).join('')}\n          <option value=\"__custom__\" ${(course.category && !(categoriesData.categories || []).includes(course.category)) ? 'selected' : ''}>${t('categoryCustom')}</option>\n        </select>\n        <input id=\"f-category-custom\" placeholder=\"${escapeHtml(t('categoryCustomPlaceholder'))}\" value=\"${escapeHtml((course.category && !(categoriesData.categories || []).includes(course.category)) ? course.category : '')}\" style=\"margin-top:.5rem;display:${(course.category && !(categoriesData.categories || []).includes(course.category)) ? 'block' : 'none'}\">\n        <p class=\"muted\" style=\"margin-top:.3rem\">${t('categoryHint')}</p>\n      </div>";
    html = replaceOnce(html, OLD, NEW, "FIELD");
  }
  {
    const OLD = "  document.getElementById('f-access-mode').onchange = (e) => {\n    document.getElementById('f-tier-row').style.display = e.target.value === 'subscription' ? 'flex' : 'none';\n  };\n  bindFileUpload('f-cover', 'image');";
    const NEW = "  document.getElementById('f-access-mode').onchange = (e) => {\n    document.getElementById('f-tier-row').style.display = e.target.value === 'subscription' ? 'flex' : 'none';\n  };\n  document.getElementById('f-category').onchange = (e) => {\n    document.getElementById('f-category-custom').style.display = e.target.value === '__custom__' ? 'block' : 'none';\n  };\n  bindFileUpload('f-cover', 'image');";
    html = replaceOnce(html, OLD, NEW, "ONCHANGE");
  }
  {
    const OLD = "async function saveCourse(id) {\n  const feedback = document.getElementById('courseFeedback');\n  try {";
    const NEW = "async function saveCourse(id) {\n  const feedback = document.getElementById('courseFeedback');\n  const categorySelect = document.getElementById('f-category').value;\n  const category = categorySelect === '__custom__' ? document.getElementById('f-category-custom').value.trim() : categorySelect;\n  try {";
    html = replaceOnce(html, OLD, NEW, "SAVE");
  }
  {
    const OLD = "        category: document.getElementById('f-category').value.trim()\n      })";
    const NEW = "        category: category\n      })";
    html = replaceOnce(html, OLD, NEW, "SAVEBODY");
  }

  const htmlBackup = HTML_PATH + ".pre-09-category-select-with-custom-" + Date.now();
  fs.copyFileSync(HTML_PATH, htmlBackup);
  fs.writeFileSync(HTML_PATH, html);
  console.log("✅ public/index.html: kategória je teraz Select (naprieč všetkými inštruktormi) + Vlastná kategória voľba. Záloha:", htmlBackup);
}

console.log("");
console.log("Reštart: pm2 restart sptrener-instructor");
