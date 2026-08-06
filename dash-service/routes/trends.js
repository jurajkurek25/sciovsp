// Trendy a analýzy platieb a blogu — denne/mesačne agregované, defensive
// per-metrika rovnako ako overview.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { pool: mainPool } = require('../lib/db-main');

async function safe(label, fn) {
  try {
    return { label, ok: true, value: await fn() };
  } catch (err) {
    return { label, ok: false, error: err.message };
  }
}

router.get('/api/dash/trends', requireDashAuth, async (req, res) => {
  const [signupsByDay, subsByPlan, testActivityByDay, blogByTag, blogByMonth] = await Promise.all([
    safe('signups_by_day_30', async () => {
      const { rows } = await mainPool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
         FROM users WHERE created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`
      );
      return rows;
    }),
    safe('active_subs_by_plan', async () => {
      const { rows } = await mainPool.query(
        `SELECT plan, COUNT(*)::int AS n FROM subscriptions WHERE status = 'active' GROUP BY plan ORDER BY plan`
      );
      return rows;
    }),
    safe('test_activity_by_day_30', async () => {
      const { rows } = await mainPool.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day, COUNT(*)::int AS n
         FROM test_results WHERE created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1`
      );
      return rows;
    }),
    safe('blog_posts_by_tag', async () => {
      const { rows } = await mainPool.query(
        `SELECT COALESCE(tag, 'bez tagu') AS tag, COUNT(*)::int AS n FROM blog_posts WHERE published = true GROUP BY 1 ORDER BY n DESC`
      );
      return rows;
    }),
    safe('blog_posts_by_month', async () => {
      const { rows } = await mainPool.query(
        `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, COUNT(*)::int AS n
         FROM blog_posts GROUP BY 1 ORDER BY 1 DESC LIMIT 12`
      );
      return rows;
    })
  ]);

  res.json({ signupsByDay, subsByPlan, testActivityByDay, blogByTag, blogByMonth });
});

module.exports = router;
