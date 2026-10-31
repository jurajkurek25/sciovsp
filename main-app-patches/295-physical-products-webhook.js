// Fyzické publikácie (tlačené knihy cez Lulu Print API) -- pridáva novú
// vetvu do existujúceho Stripe webhooku (checkout.session.completed) pre
// metadata.type === 'physical_product_purchase', presne tým istým vzorom
// ako main-app-patches/289 pre digital_product_purchase. Celá Lulu-špecifická
// logika (zápis objednávky, vytvorenie Print-Jobu, email) žije v
// routes/shop.js a je sem vystavená cez app.locals.handlePhysicalProductPurchase
// -- tento patch len zavolá tú jednu funkciu.
//
// Vyžaduje: db/migrate_physical_products.sql (uz spustený), lulu.js,
// routes/shop.js (s physical_product podporou -- commit s touto zmenou),
// main-app-patches/289-mount-digital-shop.js (uz aplikovaný -- vyžaduje
// routes/shop.js mount a app.locals helpery).
//
// 🚨 PRED spustením nastav v .env (over, že si tam nič neprepísal):
//   LULU_ENV=sandbox   (nechaj "sandbox", kým si celý flow neoveríš -- na
//                        "production" prepni AŽ keď máš v Lulu produkčnom
//                        účte nastavenú platebnú kartu a overil si aspoň
//                        jednu objednávku v sandboxe)
//   LULU_SANDBOX_CLIENT_KEY=...
//   LULU_SANDBOX_CLIENT_SECRET=...
//   (a pre produkciu neskôr: LULU_CLIENT_KEY / LULU_CLIENT_SECRET)
//   SHOP_CONTACT_EMAIL=tvoj@email.com   (voliteľné -- inak sa použije ADMIN_EMAIL;
//                        toto je kontaktný email, ktorý Lulu použije, ak
//                        vznikne otázka k Print-Jobu)
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/295-physical-products-webhook.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.295-lock';
try {
  fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
} catch (e) {
  console.error('Iný beh tohto patchu práve prebieha alebo neupratený LOCK súbor existuje (' + LOCK + '). Nič som nezmenil.');
  process.exit(1);
}
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (e) {} });

function replaceExactCount(s, oldStr, newStr, expectedCount, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== expectedCount) {
    console.error('❌ ' + label + ' — očakávaných ' + expectedCount + ' výskytov, nájdených ' + count + '. Nič som nezmenil.');
    process.exit(1);
  }
  return s.split(oldStr).join(newStr);
}

if (!fs.existsSync(FILE)) {
  console.error('❌ Nenašiel som súbor:', FILE, '— spusti tento skript z koreňa hlavnej appky.');
  process.exit(1);
}
for (const required of ['lulu.js', 'routes/shop.js']) {
  if (!fs.existsSync(required)) {
    console.error('❌ Chýba potrebný súbor:', required, '— stiahni ho najprv (pozri commit).');
    process.exit(1);
  }
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('physical_product_purchase')) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}
if (!src.includes("require('./routes/shop')")) {
  console.error('❌ server.js: main-app-patches/289-mount-digital-shop.js ešte nie je aplikovaný. Spusti ho najprv -- táto záplata naňho nadväzuje.');
  process.exit(1);
}

const WEBHOOK_OLD = `        if (session.metadata?.type === 'digital_product_purchase') {`;
const WEBHOOK_NEW = `        if (session.metadata?.type === 'physical_product_purchase') {
          try {
            await app.locals.handlePhysicalProductPurchase(session);
          } catch (physErr) {
            console.error('🚨 physical_product_purchase webhook zlyhal (zákazník zaplatil, over manuálne):', physErr.message);
          }
          break;
        }

        if (session.metadata?.type === 'digital_product_purchase') {`;

src = replaceExactCount(src, WEBHOOK_OLD, WEBHOOK_NEW, 1, 'physical_product_purchase webhook branch');

const backup = FILE + '.pre-295-physical-products-webhook-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: Stripe webhook teraz spracuje physical_product_purchase (Lulu Print-Job + email).');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ pred pm2 restart sptrener-main:');
console.log('   1. Over v .env: LULU_ENV=sandbox, LULU_SANDBOX_CLIENT_KEY, LULU_SANDBOX_CLIENT_SECRET.');
console.log('   2. Over v Supabase dashboarde, že bucket "physical-products" existuje a je PRIVÁTNY.');
console.log('   3. pm2 restart sptrener-main');
console.log('   4. V /obchod/admin pridaj prvú tlačenú knihu, klikni "Prepočítať cenu", over si číslo, až potom "Aktivovať".');
console.log('   5. Over CELÝ flow jedným testovacím nákupom v Lulu SANDBOXE (testovacia karta Stripe + sandbox Lulu kľúče)');
console.log('      -- skontroluj v Lulu sandbox dashboarde (https://developers.sandbox.lulu.com/), že sa Print-Job vytvoril.');
console.log('   6. Až keď sandbox flow funguje end-to-end, prepni na produkčné Lulu kľúče (LULU_ENV=production,');
console.log('      LULU_CLIENT_KEY/LULU_CLIENT_SECRET) a PRED prvým skutočným predajom nastav platebnú kartu v');
console.log('      Lulu Developer Portáli (produkčný účet, Settings → Payment Methods) -- bez nej Print-Job');
console.log('      ostane navždy UNPAID a kniha sa nikdy nevytlačí.');
