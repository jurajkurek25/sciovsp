// /go/:id affiliate redirect teraz vyberá url_sk alebo url_cs podľa
// jazyka stránky (blogLang(req)) namiesto jedného spoločného 'url'
// stĺpca -- súvisiace s rozdelením affiliate_products.url na url_sk/url_cs
// (dash-service/patches/16).
//
// VYŽADUJE: db/migrate_affiliate_products_url_cs.sql už spustený v
// Supabase (premenúva url -> url_sk, pridáva url_cs).
//
// Kotva je CELÁ /go/:id route (atomická náhrada, overená byte-presne cez
// main-app-patches/219 výstup, 351 znakov).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/220-go-redirect-sk-cs.js

const fs = require("fs");
const path = require("path");

const SERVER_PATH = path.join(process.cwd(), "server.js");
if (!fs.existsSync(SERVER_PATH)) {
  console.error("❌ Nenašiel som server.js — spusti z koreňa hlavnej appky.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".220-go-redirect-sk-cs-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(SERVER_PATH, "utf8");

const OLD = "app.get('/go/:id', async (req, res) => {\n  try {\n    const { data: product } = await supabase.from('affiliate_products').select('url,active').eq('id', req.params.id).single();\n    if (!product || !product.active) return res.redirect(302, '/odporucame');\n    res.redirect(302, product.url);\n  } catch (e) {\n    res.redirect(302, '/odporucame');\n  }\n});";
const NEW = "app.get('/go/:id', async (req, res) => {\n  try {\n    const { data: product } = await supabase.from('affiliate_products').select('url_sk,url_cs,active').eq('id', req.params.id).single();\n    if (!product || !product.active) return res.redirect(302, '/odporucame');\n    const isCz = blogLang(req) === 'cs';\n    res.redirect(302, (isCz ? product.url_cs : product.url_sk) || product.url_sk || product.url_cs);\n  } catch (e) {\n    res.redirect(302, '/odporucame');\n  }\n});";

if (src.includes("select('url_sk,url_cs,active')")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  const count = src.split(OLD).length - 1;
  if (count !== 1) {
    console.error("❌ Kotva /go/:id route nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  src = src.replace(OLD, () => NEW);
  const backup = SERVER_PATH + ".pre-220-go-redirect-sk-cs-" + Date.now();
  fs.copyFileSync(SERVER_PATH, backup);
  fs.writeFileSync(SERVER_PATH, src);
  console.log("✅ server.js prepísaný (/go/:id teraz presmeruje na odkaz podľa jazyka). Záloha:", backup);
}

console.log("");
console.log("Over: node -c server.js");
console.log("Reštart: pm2 restart sptrener");
