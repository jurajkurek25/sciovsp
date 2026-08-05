-- Pridáva target_lang stĺpec (SK/CZ publikum targeting) do ad_banners,
-- video_ads a pr_articles — súčasť delenia reklám podľa jazyka publika
-- (SK vs CZ testovacia appka). Default 'both' zachováva doterajšie
-- správanie pre existujúce riadky (zobrazujú sa všetkým, nič sa nerozbije).
--
-- Spusti raz: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema-target-lang.sql

ALTER TABLE ad_banners ADD COLUMN IF NOT EXISTS target_lang VARCHAR(10) NOT NULL DEFAULT 'both';
ALTER TABLE video_ads ADD COLUMN IF NOT EXISTS target_lang VARCHAR(10) NOT NULL DEFAULT 'both';
ALTER TABLE pr_articles ADD COLUMN IF NOT EXISTS target_lang VARCHAR(10) NOT NULL DEFAULT 'both';
