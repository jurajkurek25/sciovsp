// Priamy MySQL prístup do reklamnej appky (ad.sptrener.online), rovnaký
// connection pattern ako ad-service/db.js. Plus volanie existujúcich
// /api/admin/* endpointov appky pre akcie so side-effectami.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.AD_MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.AD_MYSQL_PORT) || 3306,
  database: process.env.AD_MYSQL_DATABASE,
  user: process.env.AD_MYSQL_USER,
  password: process.env.AD_MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true
});

const AD_APP_URL = process.env.AD_APP_URL || 'https://ad.sptrener.online';
const AD_ADMIN_KEY = process.env.AD_ADMIN_KEY;

async function adAdminFetch(path, opts = {}) {
  const isFormData = typeof FormData !== 'undefined' && opts.body instanceof FormData;
  const res = await fetch(`${AD_APP_URL}${path}`, {
    ...opts,
    headers: {
      ...(isFormData ? {} : { 'content-type': 'application/json' }),
      'x-admin-key': AD_ADMIN_KEY,
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ad admin API ${res.status}`);
  return data;
}

module.exports = { pool, adAdminFetch };
