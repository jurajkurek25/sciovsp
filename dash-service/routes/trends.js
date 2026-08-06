// Trendy a analýzy platieb a blogu — hlavná appka beží na Supabase (nie
// raw pg), takže tu nejde robiť GROUP BY/date_trunc priamo v SQL — dáta sa
// natiahnu a agregujú v JS. Pri súčasnom objeme (stovky/tisícky riadkov)
// je to v pohode; ak appka výrazne narastie, zváž RPC/materializovaný view.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

const ROW_LIMIT = 5000;

async function safe(label, fn) {
  try {
    return { label, ok: true, value: await fn() };
  } catch (err) {
    return { label, ok: false, error: err.message };
  }
}

function groupByDay(rows, dateField) {
  const counts = {};
  for (const row of rows) {
    const day = String(row[dateField]).slice(0, 10);
    counts[day] = (counts[day] || 0) + 1;
  }
  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).map(([day, n]) => ({ day, n }));
}

function groupByMonth(rows, dateField, limit) {
  const counts = {};
  for (const row of rows) {
    const month = String(row[dateField]).slice(0, 7);
    counts[month] = (counts[month] || 0) + 1;
  }
  return Object.entries(counts).sort(([a], [b]) => b.localeCompare(a)).slice(0, limit).map(([month, n]) => ({ month, n }));
}

router.get('/api/dash/trends', requireDashAuth, async (req, res) => {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [signupsByDay, subsByPlan, blogByTag, blogByMonth] = await Promise.all([
    safe('signups_by_day_30', async () => {
      const { data, error } = await mainDb.from('users').select('created_at').gt('created_at', since30d).limit(ROW_LIMIT);
      if (error) throw new Error(error.message);
      return groupByDay(data || [], 'created_at');
    }),
    safe('active_subs_by_plan', async () => {
      // Plán/stav predplatného žije priamo na users (žiadna samostatná
      // subscriptions tabuľka) — pozri routes/overview.js pre rovnaký fix.
      const { data, error } = await mainDb.from('users').select('plan').eq('is_premium', true).limit(ROW_LIMIT);
      if (error) throw new Error(error.message);
      const counts = {};
      for (const row of data || []) {
        const plan = row.plan || 'premium';
        counts[plan] = (counts[plan] || 0) + 1;
      }
      return Object.entries(counts).map(([plan, n]) => ({ plan, n }));
    }),
    safe('blog_posts_by_tag', async () => {
      const { data, error } = await mainDb.from('blog_posts').select('tag').eq('published', true).limit(ROW_LIMIT);
      if (error) throw new Error(error.message);
      const counts = {};
      for (const row of data || []) {
        const tag = row.tag || 'bez tagu';
        counts[tag] = (counts[tag] || 0) + 1;
      }
      return Object.entries(counts).sort(([, a], [, b]) => b - a).map(([tag, n]) => ({ tag, n }));
    }),
    safe('blog_posts_by_month', async () => {
      const { data, error } = await mainDb.from('blog_posts').select('created_at').limit(ROW_LIMIT);
      if (error) throw new Error(error.message);
      return groupByMonth(data || [], 'created_at', 12);
    })
  ]);

  res.json({ signupsByDay, subsByPlan, blogByTag, blogByMonth });
});

module.exports = router;
