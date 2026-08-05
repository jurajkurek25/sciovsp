// Spustí db/seed_blog_batch2.sql cez existujúci `pg` Pool aplikácie
// (db/pool.js), namiesto psql (ktorý na serveri chýba a apt install
// postgresql-client zlyhával). Používa presne rovnaké pripojenie/SSL
// nastavenia ako samotná appka, takže DATABASE_URL netreba riešiť ručne.
// Na konci pošle aj NOTIFY pgrst, 'reload schema' (rovnaký krok, ktorý bol
// potrebný po migrate_blog_cs.sql).
//
// Spusti z /home/jurajkurek-vsp/htdocs/sptrener.online:
//   node /root/ad-service/39-run-seed-blog-batch2.js

const fs = require('fs');
const path = require('path');
const { pool } = require(path.join(process.cwd(), 'db', 'pool.js'));

(async () => {
  const sqlPath = path.join(process.cwd(), 'db', 'seed_blog_batch2.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Nenašiel som db/seed_blog_batch2.sql. Spusti tento skript z koreňa repozitára (kde je priečinok db/).');
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    console.log('→ Spúšťam seed_blog_batch2.sql...');
    await pool.query(sql);
    console.log('✅ Insert dokončený (ON CONFLICT DO NOTHING — bezpečné aj pri opakovanom spustení).');

    console.log('→ Obnovujem PostgREST schema cache...');
    await pool.query("NOTIFY pgrst, 'reload schema';");
    console.log('✅ NOTIFY pgrst odoslaný.');

    const { rows } = await pool.query(
      `SELECT slug, title FROM blog_posts WHERE slug = ANY($1::text[]) ORDER BY slug`,
      [[
        'prijimacky-na-medicinu-vsp-biologia-chemia',
        'prijimacky-na-pravo-ako-sa-pripravit',
        'prijimacky-na-ekonomiu-vsp-matematika',
        'scio-testy-terminy-prihlasenie',
        'osp-test-co-to-je-priprava',
        'zebry-logicke-ulohy-navod'
      ]]
    );
    console.log(`\nNájdených ${rows.length}/6 nových článkov v DB:`);
    rows.forEach(r => console.log('  -', r.slug, '→', r.title));
  } catch (err) {
    console.error('❌ Chyba pri behu SQL:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
