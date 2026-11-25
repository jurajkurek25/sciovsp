// Vlastná Postgres databáza (náhrada za Supabase). Pripája sa priamo na
// lokálne bežiacu Postgres na VPS cez DATABASE_URL v .env, napr.:
//   DATABASE_URL=postgresql://sptrener:HESLO@localhost:5432/sptrener_db
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL chýba v .env!');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message);
});

module.exports = pool;
