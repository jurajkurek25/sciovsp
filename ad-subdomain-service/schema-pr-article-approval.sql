-- Pridáva draft_json stĺpec do pr_articles — potrebný pre nový krok
-- schválenia vygenerovaného textu Inzerentom pred publikovaním
-- (status 'pending_approval'). Uchováva vygenerovaný návrh článku
-- (title/excerpt/content/tag/readTime + Cs varianty) v JSON, kým
-- Inzerent buď schváli (/approve, publikuje sa) alebo zamietne (/reject).
--
-- Spusti raz: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema-pr-article-approval.sql
--
-- Pozn.: zámerne bez "IF NOT EXISTS" (staršie MySQL/MariaDB verzie
-- ADD COLUMN IF NOT EXISTS nepodporujú) — pri opakovanom behu skončí
-- chybou "Duplicate column name", čo je v poriadku.

ALTER TABLE pr_articles ADD COLUMN draft_json MEDIUMTEXT DEFAULT NULL;
