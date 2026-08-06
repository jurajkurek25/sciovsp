// Priamy prístup do hlavnej appky (sptrener.online) — read-mostly, raw pg
// Pool rovnako ako v hlavnom repe (db/pool.js), aby dash vedel čítať
// klientov/platby bez toho, aby musel prechádzať cez HTTP admin endpoint,
// ktorý v hlavnej appke ani neexistuje.
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.MAIN_DATABASE_URL
});

pool.on('error', (err) => {
  console.error('Neočakávaná chyba PostgreSQL pool (main):', err);
});

module.exports = { pool };
