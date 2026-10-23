-- Kategórie kurzov prechádzajú z pevného 3-hodnotového zoznamu na voľný text
-- (rovnaká konvencia ako blog_posts.tag a affiliate_products.category_slug) --
-- admin teraz vie zadať úplne novú kategóriu z instructor.sptrener.online aj
-- dash.sptrener.online namiesto výberu len z 3 vopred daných hodnôt.
--
-- Existujúce hodnoty (slugy z migrate_courses_category.sql) sa menia na
-- čitateľný text, aby sa rovno pekne zobrazovali ako pill na /kurzy.
--
-- Spusti v Supabase SQL editore (alebo cez psql $DATABASE_URL -f db/migrate_courses_category_freetext.sql).

update courses set category = 'Príprava na skúšku' where category = 'priprava-na-skusku';
update courses set category = 'Prihláška' where category = 'prihlaska';
update courses set category = 'Osobný rozvoj' where category = 'osobny-rozvoj';
