// Zapája nový router pr-articles.js do server.js:
//   1) require + mount router (nové /api/pr-articles* endpointy)
//   2) rozširuje existujúci Stripe webhook handler o vetvu pre JEDNORAZOVÉ
//      platby (mode:'payment') s metadata.prArticleId — existujúca vetva
//      rieši len predplatné (mode:'subscription'), táto je čisto pridaná
//      vedľa nej, nič existujúce nemení.
//
// Presný textový match proti overenému živému súboru server.js.
//
// Spusti z /home/sptrener-ad/htdocs/ad.sptrener.online:
//   node /root/ad-subdomain-service/03-server-wire-pr-articles.js
// (predpokladá, že 01-moderation-article-text.js a 02-notify-pr-article.js
//  už boli spustené, a pr-articles.js je skopírovaný do tohto priečinka)

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(process.cwd(), 'server.js');
const src = fs.readFileSync(FILE_PATH, 'utf8');

if (src.includes('prArticlesRouter')) {
  console.error('❌ Vyzerá to, že pr-articles už je zapojený. Nič som nezmenil.');
  process.exit(1);
}

if (!fs.existsSync(path.join(process.cwd(), 'pr-articles.js'))) {
  console.error('❌ pr-articles.js sa nenašiel v tomto priečinku. Skopíruj ho sem pred spustením tohto skriptu.');
  process.exit(1);
}

const OLD_REQUIRES = `const db = require('./db');
const { moderateContent } = require('./moderation');
const { notifyAdminRejection } = require('./notify');`;

const NEW_REQUIRES = `const db = require('./db');
const { moderateContent } = require('./moderation');
const { notifyAdminRejection } = require('./notify');
const { router: prArticlesRouter, handlePrArticlePaid } = require('./pr-articles');`;

const OLD_WEBHOOK = `  try {
    const obj = event.data.object;
    const subscriptionId =
      event.type === 'checkout.session.completed' ? obj.subscription :
      event.type === 'invoice.payment_succeeded' ? obj.subscription :
      (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') ? obj.id :
      null;
    if (subscriptionId) await syncFromSubscription(subscriptionId);
  } catch (e) {
    console.error('webhook handling error:', e);
  }`;

const NEW_WEBHOOK = `  try {
    const obj = event.data.object;
    const subscriptionId =
      event.type === 'checkout.session.completed' ? obj.subscription :
      event.type === 'invoice.payment_succeeded' ? obj.subscription :
      (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') ? obj.id :
      null;
    if (subscriptionId) await syncFromSubscription(subscriptionId);

    // Jednorazová platba za PR článok (nie predplatné) — samostatná vetva,
    // nedotýka sa vyššie riešenej subscription logiky.
    if (event.type === 'checkout.session.completed' && obj.mode === 'payment' && obj.metadata && obj.metadata.prArticleId) {
      handlePrArticlePaid(obj.metadata.prArticleId, obj.payment_intent).catch(e => console.error('handlePrArticlePaid error:', e));
    }
  } catch (e) {
    console.error('webhook handling error:', e);
  }`;

const OLD_CORS = `app.use(express.json());
app.use(cors({ origin: [MAIN_APP_ORIGIN, APP_URL], methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));`;

const NEW_CORS = `app.use(express.json());
app.use(cors({ origin: [MAIN_APP_ORIGIN, APP_URL], methods: ['GET', 'POST', 'PATCH', 'DELETE'] }));
app.use(prArticlesRouter);`;

for (const [name, needle] of [['requires', OLD_REQUIRES], ['webhook', OLD_WEBHOOK], ['cors', OLD_CORS]]) {
  if (!src.includes(needle)) {
    console.error(`❌ Nenašiel som presný očakávaný blok "${name}" v server.js. Nič som nezmenil.`);
    process.exit(1);
  }
}

const backupPath = FILE_PATH + '.pre-pr-articles-wire-' + Date.now();
fs.copyFileSync(FILE_PATH, backupPath);
let out = src.replace(OLD_REQUIRES, NEW_REQUIRES);
out = out.replace(OLD_WEBHOOK, NEW_WEBHOOK);
out = out.replace(OLD_CORS, NEW_CORS);
fs.writeFileSync(FILE_PATH, out);

console.log('✅ pr-articles router zapojený, webhook rozšírený o jednorazové platby.');
console.log('   Záloha pôvodného server.js:', backupPath);
console.log('   Over syntax: node -c server.js');
