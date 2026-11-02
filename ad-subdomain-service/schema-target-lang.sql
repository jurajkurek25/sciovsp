-- Pridáva target_lang stĺpec (SK/CZ publikum targeting) do ad_banners,
-- video_ads a pr_articles — súčasť delenia reklám podľa jazyka publika
-- (SK vs CZ testovacia appka). Default 'both' zachováva doterajšie
-- správanie pre existujúce riadky (zobrazujú sa všetkým, nič sa nerozbije).
--
-- Spusti raz: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema-target-lang.sql
--
-- Pozn.: zámerne bez "IF NOT EXISTS" (staršie MySQL/MariaDB verzie
-- ADD COLUMN IF NOT EXISTS nepodporujú). Skript je teda urobený tak,
-- aby sa dal spustiť len raz -- pri opakovanom behu skončí chybou
-- "Duplicate column name", čo je v poriadku a znamená, že už bol spustený.

ALTER TABLE ad_banners ADD COLUMN target_lang VARCHAR(10) NOT NULL DEFAULT 'both';
ALTER TABLE video_ads ADD COLUMN target_lang VARCHAR(10) NOT NULL DEFAULT 'both';
ALTER TABLE pr_articles ADD COLUMN target_lang VARCHAR(10) NOT NULL DEFAULT 'both';
