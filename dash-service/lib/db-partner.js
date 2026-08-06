// Priamy Supabase prístup do partner appky (partner.sptrener.online) —
// rovnaký projekt ako dash_* tabuľky (schema-dash.sql žije v partner repe),
// takže dash vie čítať aj zapisovať priamo, plus volá partnerov existujúce
// /api/partner/admin/* endpointy pre akcie so side-effectami (emaily).
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.PARTNER_SUPABASE_URL,
  process.env.PARTNER_SUPABASE_SERVICE_ROLE_KEY
);

const PARTNER_APP_URL = process.env.PARTNER_APP_URL || 'https://partner.sptrener.online';
const PARTNER_ADMIN_KEY = process.env.PARTNER_ADMIN_KEY;

async function partnerAdminFetch(path, opts = {}) {
  const res = await fetch(`${PARTNER_APP_URL}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      'x-admin-key': PARTNER_ADMIN_KEY,
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Partner admin API ${res.status}`);
  return data;
}

module.exports = { supabase, partnerAdminFetch };
