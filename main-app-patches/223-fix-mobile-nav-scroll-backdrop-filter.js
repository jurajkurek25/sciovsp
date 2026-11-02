// Opravuje rozbité mobilné hamburger menu po scrollovaní dole --
// nav.scrolled{backdrop-filter:blur(12px)} aplikovaný priamo na <nav>
// vytvára nový CSS containing block pre position:fixed potomkov. Keďže
// .nav-links-wrap (mobilný vysuvný panel s odkazmi) je DOM potomok
// <nav>, po scrollovaní (keď sa pridá .scrolled) sa jeho position:fixed
// prestane viazať na celú obrazovku a začne sa viazať na malý <nav> box
// (len výška hlavičky) -- presne to vidno na nahlásenom screenshote
// (stlačený panel, viditeľný len prvý odkaz "Blog"). V hero sekcii
// (nescrollnuté, .scrolled ešte neaktívne) menu funguje správne.
//
// Oprava: presunúť blur/pozadie na ::before pseudo-element namiesto
// priamo na <nav> -- rovnaký vizuálny efekt, ale <nav> samotný už nemá
// filter/backdrop-filter, takže jeho position:fixed potomkovia sa
// správajú normálne.
//
// Kotva je presný blok nav{} + nav.scrolled{} (atomická náhrada,
// overená byte-presne cez main-app-patches/221+222 výstup).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/223-fix-mobile-nav-scroll-backdrop-filter.js

const fs = require("fs");
const path = require("path");

const HTML_PATH = path.join(process.cwd(), "public", "index.html");
if (!fs.existsSync(HTML_PATH)) {
  console.error("❌ Nenašiel som public/index.html — spusti z koreňa hlavnej appky.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".223-fix-mobile-nav-scroll-backdrop-filter-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(HTML_PATH, "utf8");

const OLD = "nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:1.25rem 2.5rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid transparent;transition:border-color .3s,background .3s}\nnav.scrolled{background:rgba(8,8,13,.9);backdrop-filter:blur(12px);border-color:var(--border)}";
const NEW = "nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:1.25rem 2.5rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid transparent;transition:border-color .3s,background .3s}\nnav.scrolled{border-color:var(--border)}\nnav.scrolled::before{content:'';position:absolute;inset:0;background:rgba(8,8,13,.9);backdrop-filter:blur(12px);z-index:-1}";

if (src.includes("nav.scrolled::before")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  const count = src.split(OLD).length - 1;
  if (count !== 1) {
    console.error("❌ Kotva nav/nav.scrolled nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  src = src.replace(OLD, () => NEW);
  const backup = HTML_PATH + ".pre-223-fix-mobile-nav-scroll-backdrop-filter-" + Date.now();
  fs.copyFileSync(HTML_PATH, backup);
  fs.writeFileSync(HTML_PATH, src);
  console.log("✅ public/index.html: mobilné hamburger menu teraz funguje správne aj po scrollovaní. Záloha:", backup);
}

console.log("");
console.log("Over: node -c server.js (statický HTML súbor, netreba reštart appky, zmena sa prejaví hneď po refreshi stránky)");
