// main-app-patches/254 spravilo AI Generátor úloh (/api/generate-topic)
// čisto Premium-only. Podľa rozhodnutia používateľa sa to mierne
// uvoľňuje: každý NEPLATIACI (registrovaný) účet dostane PRESNE JEDNO
// bezplatné použitie generátora (nie neobmedzene, nie nula), potom už
// vyžaduje Premium.
//
// Predpoklad: main-app-patches/254 je už aplikovaný a funkčný, a SQL
// migrácia db/migrate_ai_generator_trial.sql už je spustená v Supabase
// (JA ju spustiť neviem):
//   alter table users add column if not exists ai_generator_trial_used boolean not null default false;
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/255-ai-generator-one-free-use.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'routes', 'generate.js');
const APP_HTML_PATH = path.join(process.cwd(), 'public', 'app.html');

for (const p of [FILE, APP_HTML_PATH]) {
  if (!fs.existsSync(p)) {
    console.error('❌ Nenašiel som súbor:', p, '— spusti tento skript z koreňa hlavnej appky.');
    process.exit(1);
  }
}

const LOCK = path.join(process.cwd(), '.255-ai-generator-one-free-use-lock');
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceOnce(src, oldStr, newStr, label) {
  const count = src.split(oldStr).length - 1;
  if (count !== 1) {
    console.error('❌ ' + label + ' — kotva nie je jednoznačná (nájdených: ' + count + '). Nič som nezmenil.');
    process.exit(1);
  }
  return src.replace(oldStr, () => newStr);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('ai_generator_trial_used')) {
  console.error('❌ routes/generate.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `  // Platená Premium/Elite funkcia -- predtým bez akéhokoľvek obmedzenia.
  const authUser = await verifyToken(req);
  if (!authUser) return res.status(401).json({ error: { message: 'Musíš byť prihlásený.' } });
  const { data: dbUser } = await supabase.from('users').select('is_premium').eq('email', (authUser.email || '').toLowerCase()).maybeSingle();
  if (!dbUser?.is_premium) return res.status(403).json({ error: { message: 'AI Generátor úloh vyžaduje Premium predplatné.' } });`;

const NEW = `  // Platená Premium/Elite funkcia -- neplatiaci účet dostane presne
  // JEDNO bezplatné použitie (ai_generator_trial_used), potom Premium.
  const authUser = await verifyToken(req);
  if (!authUser) return res.status(401).json({ error: { message: 'Musíš byť prihlásený.' } });
  const genUserEmail = (authUser.email || '').toLowerCase();
  const { data: dbUser } = await supabase.from('users').select('is_premium, ai_generator_trial_used').eq('email', genUserEmail).maybeSingle();
  if (!dbUser?.is_premium) {
    if (dbUser?.ai_generator_trial_used) {
      return res.status(403).json({ error: { message: 'AI Generátor úloh vyžaduje Premium predplatné (bezplatné vyskúšanie si už použil/a).' } });
    }
    await supabase.from('users').update({ ai_generator_trial_used: true }).eq('email', genUserEmail);
  }`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (Premium gate z patchu 254). Nič som nezmenil.');
  process.exit(1);
}
src = replaceOnce(src, OLD, NEW, 'routes/generate.js: jedno bezplatné použitie generátora');

// ═══════════════════════ public/app.html ═══════════════════════
// main-app-patches/254 pridalo tvrdý klientský gate (if(!isPremium())
// showPaywall()) PRED samotným volaním -- s jedným bezplatným použitím
// na serveri by sa k nemu neplatiaci účet cez bežné UI vôbec nedostal.
// Odstraňuje ho, server teraz sám rozhodne (1x povolí, potom 403 s
// jasnou hláškou, ktorú existujúci catch blok v generateQuestions() už
// aj tak zobrazuje v errorEl).
let appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');

const APP_OLD = `async function generateQuestions(){
  if(!isPremium()){showPaywall();return;}
  const part=currentGenSubject`;
const APP_NEW = `async function generateQuestions(){
  const part=currentGenSubject`;

if (!appHtml.includes(APP_OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (klientský gate z patchu 254) v app.html. Nič som nezmenil.');
  process.exit(1);
}
appHtml = replaceOnce(appHtml, APP_OLD, APP_NEW, 'app.html: odstránenie blanket Premium gate (server teraz rieši 1 bezplatné použitie)');
fs.copyFileSync(APP_HTML_PATH, APP_HTML_PATH + '.pre-255-ai-generator-one-free-use-' + Date.now());
fs.writeFileSync(APP_HTML_PATH, appHtml);
console.log('✅ app.html: odstránený blanket klientský gate -- server teraz rozhoduje (1 bezplatné použitie).');

const backup = FILE + '.pre-255-ai-generator-one-free-use-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ AI Generátor: neplatiaci účet má teraz presne 1 bezplatné použitie, potom vyžaduje Premium.');
console.log('   Záloha:', backup);
console.log('   POZOR: predpokladá, že si už spustil SQL migráciu db/migrate_ai_generator_trial.sql v Supabase.');
console.log('   pm2 restart sptrener-main (routes/generate.js nie je statický súbor)');
