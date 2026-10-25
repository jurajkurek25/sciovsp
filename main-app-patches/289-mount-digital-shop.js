// Zapája nový obchod s digitálnymi produktami (routes/shop.js) do
// hlavnej appky:
//   1. require('./routes/shop')(app) -- rovnaký vzor ako community/
//      generalka/sutaz.
//   2. 3 statické stránky: /obchod, /obchod/dakujeme, /obchod/admin.
//   3. Nová vetva v existujúcom Stripe webhooku pre
//      metadata.type === 'digital_product_purchase' -- zapíše nákup,
//      vygeneruje podpísaný download link a pošle ho emailom (záloha
//      k priamemu linku na success stránke).
//
// Vyžaduje: db/migrate_digital_shop.sql (uz spustený), routes/shop.js,
// public/obchod.html, public/obchod-dakujeme.html, public/obchod-admin.html,
// emails/digital-product-purchased.html (všetky uz na mieste pred spustením
// tohto patchu). Vyžaduje tiež nastavenie SHOP_ADMIN_EMAILS v .env
// (čiarkou oddelený zoznam emailov, ktoré majú prístup do /obchod/admin --
// bez neho padne na ADMIN_EMAIL).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/289-mount-digital-shop.js
const fs = require('fs');
const FILE = 'server.js';

const LOCK = FILE + '.289-lock';
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
for (const required of ['routes/shop.js', 'public/obchod.html', 'public/obchod-dakujeme.html', 'public/obchod-admin.html', 'emails/digital-product-purchased.html']) {
  if (!fs.existsSync(required)) {
    console.error('❌ Chýba potrebný súbor:', required, '— stiahni ho najprv (pozri commit).');
    process.exit(1);
  }
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes("require('./routes/shop')")) {
  console.error('❌ server.js: už je aplikované, nič som nezmenil.');
  process.exit(1);
}

// ── 1) Mount routes/shop.js ──────────────────────────────────────
src = replaceExactCount(
  src,
  `require('./routes/sutaz')(app);`,
  `require('./routes/sutaz')(app);
require('./routes/shop')(app);`,
  1, 'routes/shop mount point'
);

// ── 2) Statické stránky obchodu ──────────────────────────────────
src = replaceExactCount(
  src,
  `app.get('/generalka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'generalka.html')); });`,
  `app.get('/generalka', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'generalka.html')); });
app.get('/obchod', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'obchod.html')); });
app.get('/obchod/dakujeme', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'obchod-dakujeme.html')); });
app.get('/obchod/admin', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'obchod-admin.html')); });`,
  1, 'obchod static routes'
);

// ── 3) Webhook vetva pre digital_product_purchase ────────────────
const WEBHOOK_OLD = `          } else if (session.metadata.optionId) {
            const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', session.metadata.optionId).single();
            if (gcOption) await createOneGiftCard(gcOption, session.metadata.includesCourse === 'true');
          }
          break;
        }

        const notifyPartnerMembershipCredit = (payload) => {`;

const WEBHOOK_NEW = `          } else if (session.metadata.optionId) {
            const { data: gcOption } = await supabase.from('gift_card_options').select('*').eq('id', session.metadata.optionId).single();
            if (gcOption) await createOneGiftCard(gcOption, session.metadata.includesCourse === 'true');
          }
          break;
        }

        if (session.metadata?.type === 'digital_product_purchase') {
          const shopCustomer = await stripe.customers.retrieve(session.customer);
          const shopBuyerEmail = shopCustomer.email;
          const { data: shopProduct } = await supabase.from('digital_products').select('*').eq('id', session.metadata.productId).maybeSingle();
          if (!shopProduct) { console.error('Shop webhook: produkt', session.metadata.productId, 'sa nenašiel.'); break; }
          await supabase.from('digital_product_purchases').upsert({
            product_id: shopProduct.id,
            buyer_email: shopBuyerEmail,
            stripe_session_id: session.id,
            amount_paid_cents: session.amount_total
          }, { onConflict: 'stripe_session_id' });
          console.log('✅ Digitálny produkt zakúpený:', shopBuyerEmail, shopProduct.slug);
          try {
            const downloadUrl = await app.locals.shopSignedDownloadUrl(shopProduct.storage_path);
            const { sendMail } = require('./mailer');
            const fs2 = require('fs');
            const tpl = fs2.readFileSync(require('path').join(__dirname, 'emails', 'digital-product-purchased.html'), 'utf8');
            const html = tpl
              .replace(/\\{\\{TITLE\\}\\}/g, shopProduct.title)
              .replace(/\\{\\{DOWNLOAD_URL\\}\\}/g, downloadUrl)
              .replace(/\\{\\{BASE_URL\\}\\}/g, BASE_URL_BLOG)
              .replace(/\\{\\{SESSION_ID\\}\\}/g, session.id);
            await sendMail({ to: shopBuyerEmail, subject: 'Tvoj produkt ' + shopProduct.title + ' je pripravený', html });
          } catch (mailErr) {
            console.error('Shop purchase email error (link na success stránke stále funguje):', mailErr.message);
          }
          break;
        }

        const notifyPartnerMembershipCredit = (payload) => {`;

src = replaceExactCount(src, WEBHOOK_OLD, WEBHOOK_NEW, 1, 'digital_product_purchase webhook branch');

const backup = FILE + '.pre-289-mount-digital-shop-' + Date.now();
fs.copyFileSync(FILE, backup);
fs.writeFileSync(FILE, src);

console.log('✅ server.js: routes/shop.js zapojený, /obchod + /obchod/dakujeme + /obchod/admin registrované.');
console.log('✅ server.js: Stripe webhook teraz spracuje digital_product_purchase (zápis + email s download linkom).');
console.log('   Záloha:', backup);
console.log('');
console.log('🚨 DÔLEŽITÉ pred pm2 restart sptrener-main:');
console.log('   1. V .env nastav SHOP_ADMIN_EMAILS=tvoj@email.com (čiarkou oddelené, ak viac) -- inak padne na ADMIN_EMAIL.');
console.log('   2. Over v Supabase dashboarde (Storage), že bucket "digital-products" existuje a je PRIVÁTNY (Public = OFF).');
console.log('   3. pm2 restart sptrener-main');
console.log('   4. Prihlás sa na /obchod/admin cez Google, over, že tvoj email má prístup, pridaj prvý produkt.');
console.log('   5. Over celý platobný flow na /obchod jedným testovacím nákupom (Stripe test mode, ak ho appka podporuje).');
