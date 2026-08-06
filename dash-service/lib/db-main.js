// Priamy prístup do hlavnej appky (sptrener.online) — read-mostly Supabase
// klient (hlavná appka beží na Supabase, nie na raw pg s DATABASE_URL —
// pôvodná verzia tohto súboru to predpokladala nesprávne).
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.MAIN_SUPABASE_URL,
  process.env.MAIN_SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
