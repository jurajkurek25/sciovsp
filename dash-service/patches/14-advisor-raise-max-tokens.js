// AI poradca odpovede sa orezávali (default max_tokens=1500 v
// lib/claude.js callClaude()) -- pre podrobnejšiu biznis analýzu to
// nestačilo, odpoveď sa niekedy zoťala uprostred vety. Zdvíha strop na
// 8192 tokenov (aiops.js má vlastný explicitný 2400 strop s odôvodnením
// nákladov v komentári, ten sa nemení -- len advisor chat).
//
// Kotva je presný blok volania callClaude() v /api/dash/advisor/chat.
//
// Spusti z koreňa dash-service:
//   node patches/14-advisor-raise-max-tokens.js

const fs = require("fs");
const path = require("path");

const ADVISOR_PATH = path.join(process.cwd(), "routes", "advisor.js");
if (!fs.existsSync(ADVISOR_PATH)) {
  console.error("❌ Nenašiel som routes/advisor.js — spusti z koreňa dash-service.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".14-advisor-raise-max-tokens-lock");
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: "wx" });
} catch (e) {
  console.error("Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (" + LOCK + "). Nič som nezmenil.");
  process.exit(1);
}
process.on("exit", () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

let src = fs.readFileSync(ADVISOR_PATH, "utf8");

if (src.includes("maxTokens: 8192")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  const OLD = "    const reply = await callClaude({\n      system: buildSystemPrompt(overviewSnapshot || {}),\n      messages: history.map(m => ({ role: m.role, content: m.content }))\n    });";
  const NEW = "    const reply = await callClaude({\n      system: buildSystemPrompt(overviewSnapshot || {}),\n      messages: history.map(m => ({ role: m.role, content: m.content })),\n      maxTokens: 8192\n    });";
  const count = src.split(OLD).length - 1;
  if (count !== 1) {
    console.error("❌ Kotva nie je jednoznačná (nájdených: " + count + "). Nič som nezmenil. Pošli mi aktuálny obsah, over.");
    process.exit(1);
  }
  src = src.replace(OLD, () => NEW);
  const backup = ADVISOR_PATH + ".pre-14-advisor-raise-max-tokens-" + Date.now();
  fs.copyFileSync(ADVISOR_PATH, backup);
  fs.writeFileSync(ADVISOR_PATH, src);
  console.log("✅ routes/advisor.js: max_tokens zdvihnutý na 8192. Záloha:", backup);
}

console.log("");
console.log("Over: node -c routes/advisor.js");
console.log("Reštart: pm2 restart sptrener-dash");
