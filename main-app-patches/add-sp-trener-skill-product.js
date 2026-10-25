// Jednorazový skript: nahrá SP Tréner SKILL (.skill súbor) do privátneho
// Supabase Storage bucketu "digital-products" a vytvorí/aktualizuje
// záznam v tabuľke digital_products, aby sa produkt hneď zobrazil na
// /obchod. Nepotrebuje prihlásenie cez admin UI -- použije
// SUPABASE_SERVICE_KEY, ktorý už máš v .env.
//
// Idempotentný: slug je unique, takže opakované spustenie (napr. po
// úprave ceny/popisu v tomto súbore) existujúci záznam len aktualizuje,
// nevytvorí duplicitu.
//
// Vyžaduje: SP-Trener-SKILL.skill v koreni appky (stiahni ho najprv --
// pozri inštrukciu, ktorú dostaneš spolu s týmto skriptom).
//
// Spusti z koreňa hlavnej appky:
//   node main-app-patches/add-sp-trener-skill-product.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SKILL_FILE = path.join(process.cwd(), 'SP-Trener-SKILL.skill');
const STORAGE_BUCKET = 'digital-products';

const PRODUCT = {
  slug: 'sp-trener-skill',
  title: 'SP Tréner SKILL',
  description: 'Vlastný Claude Skill, ktorý ťa pripraví na VŠP/OSP priamo v Claude -- bez appky, bez prihlasovania. Po nahratí ti vygeneruje cvičný test, pýta sa po jednej otázke, čaká na tvoju odpoveď a hneď po nej ti povie, či si odpovedal/a správne, s krátkym vysvetlením. Funguje v Claude Desktop aj v Claude Code.',
  price_cents: 990,
  file_type: 'skill',
};

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ Chýba SUPABASE_URL alebo SUPABASE_SERVICE_KEY v .env.');
  process.exit(1);
}
if (!fs.existsSync(SKILL_FILE)) {
  console.error('❌ Nenašiel som', SKILL_FILE, '-- stiahni ho najprv do koreňa appky.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const fileBuffer = fs.readFileSync(SKILL_FILE);
  const storagePath = PRODUCT.slug + '/' + Date.now() + '.skill';

  console.log('⬆️  Nahrávam', SKILL_FILE, '(' + fileBuffer.length + ' B) do bucketu', STORAGE_BUCKET, '...');
  const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: 'application/zip' });
  if (uploadErr) {
    console.error('❌ Upload zlyhal:', uploadErr.message);
    console.error('   Over, že bucket "' + STORAGE_BUCKET + '" existuje (Supabase Dashboard → Storage) -- vytvára ho db/migrate_digital_shop.sql.');
    process.exit(1);
  }
  console.log('✅ Nahraté na cestu:', storagePath);

  const { data: existing } = await supabase.from('digital_products').select('id, storage_path').eq('slug', PRODUCT.slug).maybeSingle();

  const { data: saved, error: upsertErr } = await supabase.from('digital_products').upsert({
    slug: PRODUCT.slug,
    title: PRODUCT.title,
    description: PRODUCT.description,
    price_cents: PRODUCT.price_cents,
    file_type: PRODUCT.file_type,
    storage_path: storagePath,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'slug' }).select().single();

  if (upsertErr) {
    console.error('❌ Zápis do digital_products zlyhal:', upsertErr.message);
    process.exit(1);
  }

  console.log('✅ Produkt v databáze:', saved.id, '|', saved.title, '|', (saved.price_cents / 100).toFixed(2) + ' €');

  // starý súbor zo storage upraceme až po úspešnom zápise do DB (nech sa
  // nestane, že zmažeme platný súbor a zápis medzitým zlyhá)
  if (existing && existing.storage_path && existing.storage_path !== storagePath) {
    const { error: removeErr } = await supabase.storage.from(STORAGE_BUCKET).remove([existing.storage_path]);
    if (removeErr) {
      console.log('⚠️  Starý súbor', existing.storage_path, 'sa nepodarilo zmazať (nič sa nepokazilo, len zbytočne zaberá miesto):', removeErr.message);
    } else {
      console.log('🧹 Starý súbor zmazaný:', existing.storage_path);
    }
  }

  console.log('');
  console.log('Hotovo -- produkt by sa mal hneď zobraziť na https://sptrener.online/obchod');
  console.log('Cenu/popis/aktívnosť vieš kedykoľvek upraviť priamo v Supabase (tabuľka digital_products) alebo cez API (/api/admin/shop/products/' + saved.id + ').');
})();
