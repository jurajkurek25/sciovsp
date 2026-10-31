// Jednorazovo (ale bezpečne opakovateľne) synchronizuje status/current_period_end
// pre bannery a video reklamy podľa skutočného stavu ich Stripe predplatného.
// Rieši dieru, kde checkout vytvoril platbu, ale nič v appke nikdy neoznačilo
// banner/video ako 'active' — appka doteraz nemala webhook.
//
// Spusti z priečinka ad-service:
//   node 09-reconcile-subscriptions.js

require('dotenv').config();
const mysql = require('mysql2/promise');
const Stripe = require('stripe');

const db = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  dateStrings: true
});
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

function mapStatus(stripeStatus) {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active';
  if (stripeStatus === 'past_due') return 'past_due';
  return 'cancelled';
}

// Novšie Stripe API verzie presunuli current_period_end z hlavného subscription
// objektu na jednotlivé subscription items — top-level pole už nemusí existovať.
function getPeriodEnd(sub) {
  const ts = sub.current_period_end || (sub.items && sub.items.data[0] && sub.items.data[0].current_period_end);
  return ts ? new Date(ts * 1000) : null;
}

async function reconcileKnown(table) {
  const [rows] = await db.query(`SELECT id, stripe_subscription_id, status FROM ${table} WHERE stripe_subscription_id IS NOT NULL`);
  for (const row of rows) {
    try {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      const status = mapStatus(sub.status);
      const periodEnd = getPeriodEnd(sub);
      await db.query(`UPDATE ${table} SET status = ?, current_period_end = ? WHERE id = ?`, [status, periodEnd, row.id]);
      console.log(`${table} #${row.id}: ${row.status} -> ${status} (do ${periodEnd ? periodEnd.toISOString() : 'neznáme'})`);
    } catch (e) {
      console.error(`${table} #${row.id}: chyba —`, e.message);
    }
  }
}

// Doteraz sa stripe_subscription_id na banner/video nikdy nezapisoval (chýbal
// webhook) — dohľadaj cez advertiserov stripe_customer_id a metadata.
async function reconcileOrphans(table, metadataKey) {
  const [rows] = await db.query(`SELECT id, advertiser_id FROM ${table} WHERE stripe_subscription_id IS NULL AND status = 'pending_payment'`);
  for (const row of rows) {
    const [advRows] = await db.query('SELECT stripe_customer_id FROM advertisers WHERE id = ?', [row.advertiser_id]);
    const customerId = advRows[0] && advRows[0].stripe_customer_id;
    if (!customerId) continue;
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    const match = subs.data.find(s => s.metadata && s.metadata[metadataKey] === String(row.id));
    if (!match) continue;
    const status = mapStatus(match.status);
    const periodEnd = getPeriodEnd(match);
    await db.query(`UPDATE ${table} SET status = ?, current_period_end = ?, stripe_subscription_id = ? WHERE id = ?`, [status, periodEnd, match.id, row.id]);
    console.log(`${table} #${row.id}: dohľadané cez zákazníka -> ${status} (do ${periodEnd ? periodEnd.toISOString() : 'neznáme'})`);
  }
}

(async () => {
  await reconcileKnown('ad_banners');
  await reconcileKnown('video_ads');
  await reconcileOrphans('ad_banners', 'bannerId');
  await reconcileOrphans('video_ads', 'videoAdId');
  console.log('Hotovo.');
  process.exit(0);
})();
