// AI poradca odpovede zobrazovali **hrubé** markdown značky doslovne
// (hviezdičky) namiesto tučného písma -- odpoveď sa vypisovala cez
// textContent, žiadne formátovanie sa nespracúvalo. Pridáva
// formatChatMsg(): najprv escapne < (XSS ochrana), potom prevedie
// **text** na <strong>text</strong>. Aplikované na históriu správ aj na
// živo pridávanú odpoveď (user aj assistant).
//
// Kotvy: 2 malé kotvy v public/index.html (renderAdvisor() + pridanie
// formatChatMsg helpera, sendAdvisorMsg() živé vykresľovanie).
//
// Spusti z koreňa dash-service:
//   node patches/15-advisor-bold-formatting.js

const fs = require("fs");
const path = require("path");

const HTML_PATH = path.join(process.cwd(), "public", "index.html");
if (!fs.existsSync(HTML_PATH)) {
  console.error("❌ Nenašiel som public/index.html — spusti z koreňa dash-service.");
  process.exit(1);
}

const LOCK = path.join(process.cwd(), ".15-advisor-bold-formatting-lock");
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

if (html.includes("formatChatMsg")) {
  console.log("ℹ️  Už je aplikované, preskakujem.");
} else {
  {
    const OLD = "// ─────────────────────────── ADVISOR ───────────────────────────\nasync function renderAdvisor() {\n  const { messages } = await api('/api/dash/advisor/history');\n  $('#main').innerHTML = `\n    <div class=\"pagehead\"><h2>AI poradca</h2></div>\n    <div class=\"chat\">\n      <div class=\"chat-msgs\" id=\"chatMsgs\">${messages.map(m => `<div class=\"msg ${m.role}\">${(m.content||'').replace(/</g,'&lt;')}</div>`).join('')}</div>";
    const NEW = "// ─────────────────────────── ADVISOR ───────────────────────────\nfunction formatChatMsg(text) {\n  return (text || '').replace(/</g, '&lt;').replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');\n}\n\nasync function renderAdvisor() {\n  const { messages } = await api('/api/dash/advisor/history');\n  $('#main').innerHTML = `\n    <div class=\"pagehead\"><h2>AI poradca</h2></div>\n    <div class=\"chat\">\n      <div class=\"chat-msgs\" id=\"chatMsgs\">${messages.map(m => `<div class=\"msg ${m.role}\">${formatChatMsg(m.content)}</div>`).join('')}</div>";
    html = replaceOnce(html, OLD, NEW, "RENDER");
  }
  {
    const OLD = "  msgsEl.insertAdjacentHTML('beforeend', `<div class=\"msg user\">${message.replace(/</g,'&lt;')}</div>`);\n  msgsEl.insertAdjacentHTML('beforeend', `<div class=\"msg assistant\" id=\"pendingReply\">…</div>`);\n  msgsEl.scrollTop = msgsEl.scrollHeight;\n  try {\n    if (!currentOverviewSnapshot) currentOverviewSnapshot = await api('/api/dash/overview');\n    const { reply } = await api('/api/dash/advisor/chat', { method: 'POST', body: JSON.stringify({ message, overviewSnapshot: currentOverviewSnapshot }) });\n    $('#pendingReply').textContent = reply;\n    $('#pendingReply').removeAttribute('id');\n  } catch (err) {";
    const NEW = "  msgsEl.insertAdjacentHTML('beforeend', `<div class=\"msg user\">${formatChatMsg(message)}</div>`);\n  msgsEl.insertAdjacentHTML('beforeend', `<div class=\"msg assistant\" id=\"pendingReply\">…</div>`);\n  msgsEl.scrollTop = msgsEl.scrollHeight;\n  try {\n    if (!currentOverviewSnapshot) currentOverviewSnapshot = await api('/api/dash/overview');\n    const { reply } = await api('/api/dash/advisor/chat', { method: 'POST', body: JSON.stringify({ message, overviewSnapshot: currentOverviewSnapshot }) });\n    $('#pendingReply').innerHTML = formatChatMsg(reply);\n    $('#pendingReply').removeAttribute('id');\n  } catch (err) {";
    html = replaceOnce(html, OLD, NEW, "SEND");
  }

  const backup = HTML_PATH + ".pre-15-advisor-bold-formatting-" + Date.now();
  fs.copyFileSync(HTML_PATH, backup);
  fs.writeFileSync(HTML_PATH, html);
  console.log("✅ public/index.html: **text** v AI poradcovi sa teraz zobrazuje tučne. Záloha:", backup);
}

console.log("");
console.log("Reštart: pm2 restart sptrener-dash");
