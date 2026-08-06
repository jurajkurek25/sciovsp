// Automatizovaná starostlivosť o reklamných partnerov (advertiserov) bez
// potreby ručného zásahu — spúšťané raz denne cez POST /api/admin/cron/daily
// (externý cron, alebo zatiaľ ručne).
//
// Nič v tomto súbore nič automaticky neblokuje ani neúčtuje navyše —
// detekcia opakovaných zamietnutí len OZNAČÍ advertisera na ľudské
// posúdenie (viď ad_flags), nikdy ho sama nedeaktivuje.
//
// Predpoklad: schema-ad-automation.sql už bola spustená.

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('./db');
const {
  notifyAdvertiserCampaignExpiringSoon,
  notifyAdvertiserCampaignLive,
  notifyAdvertiserPrArticleApprovalReminder,
  notifyAdminFraudFlag,
  notifyAdvertiserPerformanceReport
} = require('./notify');

const ADMIN_KEY = process.env.ADMIN_KEY;
const EXPIRY_WARNING_DAYS = 3;
const PR_APPROVAL_REMINDER_HOURS = 48;
// "campaign live" sa posiela len pre nedávno vytvorené kampane, nech pri
// prvom nasadení cronu nezaplaví dávno bežiace kampane falošným
// "práve sa spustila" oznámením.
const RECENT_CAMPAIGN_DAYS = 2;
const FRAUD_REJECTION_THRESHOLD = 3;
const FRAUD_REJECTION_WINDOW_DAYS = 7;
const REPORT_WINDOW_DAYS = 7;

function checkAdminKey(req) {
  const key = req.headers['x-admin-key'];
  if (!key || !ADMIN_KEY) return false;
  const a = Buffer.from(String(key));
  const b = Buffer.from(String(ADMIN_KEY));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function tryLogNotification(itemType, itemId, notificationType, period) {
  try {
    await db.query(
      'INSERT INTO ad_notification_log (item_type, item_id, notification_type, period) VALUES (?, ?, ?, ?)',
      [itemType, itemId, notificationType, period || 'once']
    );
    return true;
  } catch (e) {
    return false; // UNIQUE constraint -> pre toto obdobie už bolo poslané
  }
}

const RECURRING_TABLES = [['ad_banners', 'banner'], ['video_ads', 'video']];

async function checkExpiringSoon() {
  let sent = 0;
  for (const [table, itemType] of RECURRING_TABLES) {
    const [rows] = await db.query(
      `SELECT b.id, b.current_period_end, a.email FROM ${table} b
       JOIN advertisers a ON a.id = b.advertiser_id
       WHERE b.active = 1 AND b.status = 'active'
         AND b.current_period_end > NOW()
         AND b.current_period_end <= DATE_ADD(NOW(), INTERVAL ? DAY)`,
      [EXPIRY_WARNING_DAYS]
    );
    for (const row of rows) {
      const period = new Date(row.current_period_end).toISOString().slice(0, 10);
      const logged = await tryLogNotification(itemType, row.id, 'expiring_soon', period);
      if (!logged) continue;
      notifyAdvertiserCampaignExpiringSoon({ advertiserEmail: row.email, itemType, daysLeft: EXPIRY_WARNING_DAYS }).catch(() => {});
      sent++;
    }
  }
  return sent;
}

async function checkCampaignLive() {
  let sent = 0;
  for (const [table, itemType] of RECURRING_TABLES) {
    const [rows] = await db.query(
      `SELECT b.id, b.current_period_end, a.email FROM ${table} b
       JOIN advertisers a ON a.id = b.advertiser_id
       WHERE b.active = 1 AND b.status = 'active' AND b.current_period_end > NOW()
         AND b.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [RECENT_CAMPAIGN_DAYS]
    );
    for (const row of rows) {
      const period = new Date(row.current_period_end).toISOString().slice(0, 10);
      const logged = await tryLogNotification(itemType, row.id, 'campaign_live', period);
      if (!logged) continue;
      notifyAdvertiserCampaignLive({ advertiserEmail: row.email, itemType }).catch(() => {});
      sent++;
    }
  }
  return sent;
}

async function checkPrApprovalReminders() {
  const [rows] = await db.query(
    `SELECT p.id, a.email FROM pr_articles p
     JOIN advertisers a ON a.id = p.advertiser_id
     WHERE p.status = 'pending_approval'
       AND p.draft_ready_at IS NOT NULL
       AND p.draft_ready_at <= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [PR_APPROVAL_REMINDER_HOURS]
  );
  let sent = 0;
  for (const row of rows) {
    const logged = await tryLogNotification('pr_article', row.id, 'pr_approval_reminder', 'once');
    if (!logged) continue;
    notifyAdvertiserPrArticleApprovalReminder({ advertiserEmail: row.email }).catch(() => {});
    sent++;
  }
  return sent;
}

// Opakované zamietnutia obsahu automatickou kontrolou (moderation.js) v
// krátkom čase sú signál možného zneužívania — len flagne, nikdy sám
// nezablokuje účet.
async function checkRepeatedRejections() {
  const [rows] = await db.query(
    `SELECT advertiser_id, COUNT(*) AS cnt FROM moderation_log
     WHERE allowed = 0 AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY advertiser_id HAVING cnt >= ?`,
    [FRAUD_REJECTION_WINDOW_DAYS, FRAUD_REJECTION_THRESHOLD]
  );
  let flagged = 0;
  for (const row of rows) {
    const [existing] = await db.query(
      `SELECT id FROM ad_flags WHERE advertiser_id = ? AND flag_type = 'repeated_rejections' AND resolved = 0 LIMIT 1`,
      [row.advertiser_id]
    );
    if (existing.length) continue;

    const detail = `${row.cnt} zamietnutých kreatív/článkov automatickou kontrolou za posledných ${FRAUD_REJECTION_WINDOW_DAYS} dní.`;
    await db.query(
      `INSERT INTO ad_flags (advertiser_id, flag_type, detail) VALUES (?, 'repeated_rejections', ?)`,
      [row.advertiser_id, detail]
    );
    const [advRows] = await db.query('SELECT email FROM advertisers WHERE id = ?', [row.advertiser_id]);
    notifyAdminFraudFlag({ advertiserEmail: advRows[0] ? advRows[0].email : null, detail }).catch(() => {});
    flagged++;
  }
  return flagged;
}

// Týždenný report výkonu — impressions/kliky pre bannery (ad_events),
// zhliadnutia/kliky pre videá (video_ad_views). Advertiseri bez akejkoľvek
// aktivity za obdobie report nedostanú (žiadny prázdny email).
async function sendPerformanceReports() {
  const [advertisers] = await db.query(
    `SELECT DISTINCT a.id, a.email FROM advertisers a
     WHERE EXISTS (SELECT 1 FROM ad_banners b WHERE b.advertiser_id = a.id)
        OR EXISTS (SELECT 1 FROM video_ads v WHERE v.advertiser_id = a.id)`
  );
  const period = new Date().toISOString().slice(0, 10);

  let sent = 0;
  for (const adv of advertisers) {
    const [[{ impressions }]] = await db.query(
      `SELECT COUNT(*) AS impressions FROM ad_events e JOIN ad_banners b ON b.id = e.banner_id
       WHERE b.advertiser_id = ? AND e.event_type = 'impression' AND e.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [adv.id, REPORT_WINDOW_DAYS]
    );
    const [[{ clicks }]] = await db.query(
      `SELECT COUNT(*) AS clicks FROM ad_events e JOIN ad_banners b ON b.id = e.banner_id
       WHERE b.advertiser_id = ? AND e.event_type = 'click' AND e.created_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [adv.id, REPORT_WINDOW_DAYS]
    );
    const [[{ views }]] = await db.query(
      `SELECT COUNT(*) AS views FROM video_ad_views vv JOIN video_ads v ON v.id = vv.video_ad_id
       WHERE v.advertiser_id = ? AND vv.completed_at IS NOT NULL AND vv.started_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [adv.id, REPORT_WINDOW_DAYS]
    );
    const [[{ videoClicks }]] = await db.query(
      `SELECT COUNT(*) AS videoClicks FROM video_ad_views vv JOIN video_ads v ON v.id = vv.video_ad_id
       WHERE v.advertiser_id = ? AND vv.clicked = 1 AND vv.started_at > DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [adv.id, REPORT_WINDOW_DAYS]
    );

    if (impressions === 0 && views === 0) continue;

    const logged = await tryLogNotification('advertiser', adv.id, 'performance_report', period);
    if (!logged) continue;

    notifyAdvertiserPerformanceReport({
      advertiserEmail: adv.email, days: REPORT_WINDOW_DAYS,
      impressions, clicks, views, videoClicks: videoClicks
    }).catch(() => {});
    sent++;
  }
  return sent;
}

router.get('/api/admin/flags', async (req, res) => {
  if (!checkAdminKey(req)) return res.status(403).json({ error: 'Forbidden.' });
  const resolved = req.query.resolved === 'true' ? 1 : 0;
  try {
    const [rows] = await db.query(
      `SELECT f.*, a.email FROM ad_flags f
       JOIN advertisers a ON a.id = f.advertiser_id
       WHERE f.resolved = ? ORDER BY f.created_at DESC`,
      [resolved]
    );
    res.json({ flags: rows });
  } catch (e) {
    console.error('admin flags list error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

router.post('/api/admin/flags/:id/resolve', async (req, res) => {
  if (!checkAdminKey(req)) return res.status(403).json({ error: 'Forbidden.' });
  try {
    await db.query(`UPDATE ad_flags SET resolved = 1, resolved_at = NOW() WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('admin flag resolve error:', e);
    res.status(500).json({ error: 'Chyba servera.' });
  }
});

router.post('/api/admin/cron/daily', async (req, res) => {
  if (!checkAdminKey(req)) return res.status(403).json({ error: 'Forbidden.' });
  const results = { expiringSoonEmails: 0, campaignLiveEmails: 0, prApprovalReminders: 0, fraudFlags: 0, performanceReports: 0 };
  try {
    results.expiringSoonEmails = await checkExpiringSoon();
    results.campaignLiveEmails = await checkCampaignLive();
    results.prApprovalReminders = await checkPrApprovalReminders();
    results.fraudFlags = await checkRepeatedRejections();
    // Report je za posledných REPORT_WINDOW_DAYS dní — posiela sa len raz
    // týždenne (pondelky), nie pri každom dennom behu cronu.
    if (new Date().getUTCDay() === 1) results.performanceReports = await sendPerformanceReports();
  } catch (e) {
    console.error('ads cron/daily error:', e);
    return res.status(500).json({ error: e.message, partial: results });
  }
  res.json({ ok: true, ranAt: new Date().toISOString(), results });
});

module.exports = { router };
