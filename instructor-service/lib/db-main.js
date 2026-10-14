// Priamy prístup do hlavnej appky (sptrener.online) — zdieľaný Supabase
// projekt. Inštruktorská appka nemá vlastnú databázu: kurzy, lekcie aj
// nákupy žijú v tých istých tabuľkách, ktoré používa aj dash-service.
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.MAIN_SUPABASE_URL,
  process.env.MAIN_SUPABASE_SERVICE_KEY,
  { realtime: { transport: ws } }
);

module.exports = { supabase };
