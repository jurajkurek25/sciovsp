// Opravuje rozhádzaný layout kariet vo 'Vlastné reklamy' na mobile --
// houseAdItemHtml() mal všetko (náhľad, text, 2 tlačidlá) v jednom
// display:flex riadku BEZ flex-wrap, na rozdiel od zvyšku appky (napr.
// karty kurzov), kde sú tlačidlá v samostatnom, zabalenom riadku pod
// obsahom. Na úzkom mobile displeji sa to nezmestilo a video/img náhľad
// (predtým len width:160px, bez height) sa mohol správať nepredvídateľne,
// keď sa nenačítal. Teraz: náhľad má pevné rozmery (120x80, object-fit:cover,
// flex-shrink:0, takže sa nedá rozťahovať), text sa balí do vlastného
// riadku s náhľadom, tlačidlá sú v samostatnom zabalenom riadku dole --
// rovnaký vzor ako card-item pre kurzy.
//
// Kotva je CELÁ funkcia houseAdItemHtml() (atomická náhrada).
//
// Spusti z koreňa dash-service:
//   node patches/13-houseads-mobile-layout-fix.js

const fs = require("fs");
const path = require("path");

const HTML_PATH = path.join(process.cwd(), "public", "index.html");
if (!fs.existsSync(HTML_PATH)) {
  console.error("❌ Nenašiel som public/index.html — spusti z koreňa dash-service.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".13-houseads-mobile-layout-fix-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let html = fs.readFileSync(HTML_PATH, "utf8");

if (html.includes("previewStyle")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  const OLD = "function houseAdItemHtml(type, item) {\n  const preview = type === 'banner'\n    ? (item.mime_type === 'video/mp4'\n        ? `<video src=\"${item.public_url}\" style=\"width:160px;border-radius:8px\" muted></video>`\n        : `<img src=\"${item.public_url}\" style=\"width:160px;border-radius:8px\">`)\n    : `<video src=\"${item.public_url}\" style=\"width:160px;border-radius:8px\" muted></video>`;\n  return `<div class=\"card-item\" data-id=\"${item.id}\" data-type=\"${type}\" style=\"display:flex;gap:1rem;align-items:center\">\n    ${preview}\n    <div style=\"flex:1\">\n      <p class=\"muted\">${item.link_url}</p>\n      <p class=\"muted\">${item.target_lang}${type === 'video' ? ' · ' + item.duration_s + 's' : ''} · <span class=\"pill ${item.active ? 'resolved' : 'pending'}\">${item.active ? 'aktívne' : 'vypnuté'}</span></p>\n    </div>\n    <button class=\"btn secondary ha-toggle-btn\" data-active=\"${item.active}\">${item.active ? 'Vypnúť' : 'Zapnúť'}</button>\n    <button class=\"btn danger ha-delete-btn\">Zmazať</button>\n  </div>`;\n}";
  const NEW = "function houseAdItemHtml(type, item) {\n  const previewStyle = 'width:120px;height:80px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--black3)';\n  const preview = type === 'banner'\n    ? (item.mime_type === 'video/mp4'\n        ? `<video src=\"${item.public_url}\" style=\"${previewStyle}\" muted></video>`\n        : `<img src=\"${item.public_url}\" style=\"${previewStyle}\">`)\n    : `<video src=\"${item.public_url}\" style=\"${previewStyle}\" muted></video>`;\n  return `<div class=\"card-item\" data-id=\"${item.id}\" data-type=\"${type}\">\n    <div style=\"display:flex;gap:1rem;align-items:center;flex-wrap:wrap\">\n      ${preview}\n      <div style=\"flex:1;min-width:180px\">\n        <p class=\"muted\" style=\"word-break:break-all\">${item.link_url}</p>\n        <p class=\"muted\">${item.target_lang}${type === 'video' ? ' · ' + item.duration_s + 's' : ''} · <span class=\"pill ${item.active ? 'resolved' : 'pending'}\">${item.active ? 'aktívne' : 'vypnuté'}</span></p>\n      </div>\n    </div>\n    <div style=\"display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.8rem\">\n      <button class=\"btn secondary ha-toggle-btn\" data-active=\"${item.active}\">${item.active ? 'Vypnúť' : 'Zapnúť'}</button>\n      <button class=\"btn danger ha-delete-btn\">Zmazať</button>\n    </div>\n  </div>`;\n}";
  const count = html.split(OLD).length - 1;
  if (count !== 1) {
    console.error("❌ Kotva houseAdItemHtml() nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  html = html.replace(OLD, () => NEW);
  const backup = HTML_PATH + ".pre-13-houseads-mobile-layout-fix-" + Date.now();
  fs.copyFileSync(HTML_PATH, backup);
  fs.writeFileSync(HTML_PATH, html);
  console.log("✅ public/index.html: karty vo Vlastné reklamy majú opravený mobile layout. Záloha:", backup);
}

console.log("");
console.log("Reštart: pm2 restart sptrener-dash");
