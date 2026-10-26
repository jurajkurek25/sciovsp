// Jednorazová registrácia Lulu Print API webhooku (PRINT_JOB_STATUS_CHANGED)
// -- Lulu bude posielať stav tlačových objednávok (IN_PRODUCTION, SHIPPED, ...)
// na /api/shop/lulu-webhook, ktorý appka už vie prijať (routes/shop.js).
//
// Spusti TOTO AŽ PO main-app-patches/295-physical-products-webhook.js a
// nastavení LULU_ENV + LULU_(SANDBOX_)CLIENT_KEY/SECRET v .env. Nerobí
// žiadnu zmenu v server.js, len jedno API volanie na Lulu -- spusti ho
// znova, ak meníš prostredie (sandbox → production), pretože webhooky sú
// registrované OSOBITNE pre sandbox a produkciu.
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/register-lulu-webhook.js
require('dotenv').config();
const lulu = require('../lulu');

const BASE_URL = (process.env.BASE_URL || 'https://sptrener.online').replace(/\/$/, '');
const webhookUrl = BASE_URL + '/api/shop/lulu-webhook';

(async () => {
  try {
    const result = await lulu.registerStatusWebhook(webhookUrl);
    console.log('✅ Lulu webhook zaregistrovaný (' + (lulu.IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX') + '):');
    console.log('   id:', result.id, '  url:', result.url, '  topics:', result.topics);
    console.log('Over, že appka už beží na tejto adrese a /api/shop/lulu-webhook vracia 200 pre bežný POST.');
  } catch (e) {
    console.error('❌ Registrácia Lulu webhooku zlyhala:', e.message);
    console.error('   Over LULU_ENV a LULU_(SANDBOX_)CLIENT_KEY/SECRET v .env.');
    process.exit(1);
  }
})();
