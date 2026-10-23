-- Vlastné (interné) reklamy Juraja — zadarmo, doplňujú voľné miesta v
-- rotácii, platiaci klienti majú vždy prednosť. Spusti: mysql -h 127.0.0.1
-- -u reklama -p reklama < schema-house-ads.sql

ALTER TABLE ad_banners ADD COLUMN is_house TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE video_ads ADD COLUMN is_house TINYINT(1) NOT NULL DEFAULT 0;

INSERT INTO advertisers (email, password_hash, company_name, marketing_emails_opt_in)
SELECT 'house@sptrener.online', '$2b$10$00000000000000000000000000000000000000000000000000', 'SP Tréner (interná reklama)', 0
WHERE NOT EXISTS (SELECT 1 FROM advertisers WHERE email = 'house@sptrener.online');
