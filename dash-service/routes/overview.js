// Jednotný prehľad naprieč všetkými 3 appkami. Každá metrika sa číta
// nezávisle v try/catch — schema.sql v hlavnom repe aj ad-service je
// potvrdene zastaraná oproti produkcii, takže zlý odhad jedného stĺpca
// nesmie zhodiť celú stránku, len tú jednu kartičku.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');
const { supabase: partnerDb } = require('../lib/db-partner');
const { pool: adPool } = require('../lib/db-ads');

async function safe(label, fn) {
  try {
    return { label, ok: true, ...(await fn()) };
  } catch (err) {
    return { label, ok: false, error: err.message };
  }
}

router.get('/api/dash/overview', requireDashAuth, async (req, res) => {
  const [
    users, activeSubs, newSignups7d, blogPosts,
    partners, pendingPayoutSum, openPartnerFlags,
    advertisers, activeBanners, openAdFlags, pendingPrArticles, expiringSoon,
    bugReports, aiActions
  ] = await Promise.all([
    safe('users_total', async () => {
      const { count, error } = await mainDb.from('users').select('id', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return { value: count || 0 };
    }),
    safe('active_subscriptions', async () => {
      const { data, error } = await mainDb.from('subscriptions').select('plan').eq('status', 'active');
      if (error) throw new Error(error.message);
      const counts = {};
      for (const row of data || []) counts[row.plan] = (counts[row.plan] || 0) + 1;
      return { value: Object.entries(counts).map(([plan, n]) => ({ plan, n })) };
    }),
    safe('new_signups_7d', async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await mainDb.from('users').select('id', { count: 'exact', head: true }).gt('created_at', since);
      if (error) throw new Error(error.message);
      return { value: count || 0 };
    }),
    safe('blog_posts_total', async () => {
      const { count, error } = await mainDb.from('blog_posts').select('id', { count: 'exact', head: true }).eq('published', true);
      if (error) throw new Error(error.message);
      return { value: count || 0 };
    }),
    safe('partners_total', async () => {
      const { count } = await partnerDb.from('partners').select('id', { count: 'exact', head: true });
      return { value: count || 0 };
    }),
    safe('pending_payouts_eur', async () => {
      const { data } = await partnerDb.from('partner_payouts').select('amount').eq('status', 'pending');
      return { value: (data || []).reduce((s, r) => s + Number(r.amount || 0), 0) };
    }),
    safe('open_partner_flags', async () => {
      const { count } = await partnerDb.from('partner_flags').select('id', { count: 'exact', head: true }).eq('resolved', false);
      return { value: count || 0 };
    }),
    safe('advertisers_total', async () => {
      const [rows] = await adPool.query('SELECT COUNT(*) AS n FROM advertisers');
      return { value: rows[0].n };
    }),
    safe('active_banners', async () => {
      const [rows] = await adPool.query('SELECT COUNT(*) AS n FROM ad_banners WHERE active = 1');
      return { value: rows[0].n };
    }),
    safe('open_ad_flags', async () => {
      const [rows] = await adPool.query(`SELECT COUNT(*) AS n FROM ad_flags WHERE resolved = 0`);
      return { value: rows[0].n };
    }),
    safe('pending_pr_articles', async () => {
      const [rows] = await adPool.query(`SELECT COUNT(*) AS n FROM pr_articles WHERE status = 'pending_approval'`);
      return { value: rows[0].n };
    }),
    safe('expiring_banners_7d', async () => {
      const [rows] = await adPool.query(
        `SELECT COUNT(*) AS n FROM ad_banners WHERE active = 1 AND current_period_end <= DATE_ADD(NOW(), INTERVAL 7 DAY)`
      );
      return { value: rows[0].n };
    }),
    safe('open_bug_reports', async () => {
      const { count } = await partnerDb.from('dash_bug_reports').select('id', { count: 'exact', head: true }).eq('status', 'open');
      return { value: count || 0 };
    }),
    safe('recent_ai_actions', async () => {
      const { data } = await partnerDb.from('dash_ai_actions_log').select('*').order('created_at', { ascending: false }).limit(10);
      return { value: data || [] };
    })
  ]);

  res.json({
    main: { users, activeSubs, newSignups7d, blogPosts },
    partner: { partners, pendingPayoutSum, openPartnerFlags },
    ads: { advertisers, activeBanners, openAdFlags, pendingPrArticles, expiringSoon },
    bugReports, aiActions
  });
});

module.exports = router;
