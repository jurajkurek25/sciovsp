// main-app-patches/255 dalo kazdemu neplatiacemu uctu presne JEDNO
// bezplatne pouzitie AI Generatora (ai_generator_trial_used boolean).
// Podla rozhodnutia pouzivatela sa to zvysuje na 3 (konzistentne s "3
// testy zdarma" vsade inde v appke) -- naklad navyse je zanedbatelny
// (~$0,02/pouzitie, 3x menej nez jeden cely test).
//
// Predpoklad: main-app-patches/255 je uz aplikovany a funkcny, a SQL
// migracia db/migrate_ai_generator_trial_count.sql uz je spustena v
// Supabase (JA ju spustit neviem):
//   alter table users add column if not exists ai_generator_trial_count integer not null default 0;
//   update users set ai_generator_trial_count = 3 where ai_generator_trial_used = true;
//
// Spusti z korena hlavnej appky:
//   node main-app-patches/256-ai-generator-three-free-uses.js

const fs = require('fs');
const path = require('path');

const FILE = path.join(process.cwd(), 'routes', 'generate.js');

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}

const LOCK = path.join(process.cwd(), '.256-ai-generator-three-free-uses-lock');
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

if (src.includes('ai_generator_trial_count')) {
  console.error('❌ routes/generate.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

const OLD = `  // Platená Premium/Elite funkcia -- neplatiaci účet dostane presne
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

const NEW = `  // Platená Premium/Elite funkcia -- neplatiaci účet dostane 3
  // bezplatné použitia (ai_generator_trial_count), potom Premium.
  const authUser = await verifyToken(req);
  if (!authUser) return res.status(401).json({ error: { message: 'Musíš byť prihlásený.' } });
  const genUserEmail = (authUser.email || '').toLowerCase();
  const { data: dbUser } = await supabase.from('users').select('is_premium, ai_generator_trial_count').eq('email', genUserEmail).maybeSingle();
  if (!dbUser?.is_premium) {
    const genUsed = dbUser?.ai_generator_trial_count || 0;
    if (genUsed >= 3) {
      return res.status(403).json({ error: { message: 'AI Generátor úloh vyžaduje Premium predplatné (3 bezplatné vyskúšania si už použil/a).' } });
    }
    await supabase.from('users').update({ ai_generator_trial_count: genUsed + 1 }).eq('email', genUserEmail);
  }`;

if (!src.includes(OLD)) {
  console.error('❌ Nenašiel som presnú kotvu (1-použitie gate z patchu 255). Nič som nezmenil.');
  process.exit(1);
}
src = replaceOnce(src, OLD, NEW, 'routes/generate.js: 3 bezplatné použitia generátora');

const backup = FILE + '.pre-256-ai-generator-three-free-uses-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ AI Generátor: neplatiaci účet má teraz 3 bezplatné použitia, potom vyžaduje Premium.');
console.log('   Záloha:', backup);
console.log('   POZOR: predpokladá, že si už spustil SQL migráciu db/migrate_ai_generator_trial_count.sql v Supabase.');
console.log('   pm2 restart sptrener-main (routes/generate.js nie je statický súbor)');
