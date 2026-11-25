-- Retencia dokladu o prijatí (čl. VII ods. 2 štatútu, FAQ na /sutaz): "kópia
-- dokladu sa vymaže do 30 dní po overení". Doteraz to bol len text bez
-- technického vynútenia -- žiadny job dokument v Storage nemazal.
--
-- admission_doc_deleted_at sa nastaví v momente, keď cleanup job skutočne
-- zmaže súbor zo Storage bucketu 'sutaz-admission-docs'. Stĺpec
-- admission_doc_path ostáva (má NOT NULL, navyše slúži ako audit stopa, že
-- tu doklad existoval), len odkazovaný súbor v Storage už nebude existovať.
--
-- Spusti v Supabase SQL editore (alebo cez psql $DATABASE_URL -f db/migrate_sutaz_admission_doc_retention.sql).

alter table sutaz_applications
  add column if not exists admission_doc_deleted_at timestamptz;
