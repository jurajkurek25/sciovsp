-- Opt-out z týždenného reportu výkonu (jediný "marketingový" typ emailu z
-- automation.js — expirácia/live/PR-pripomienka sa priamo týkajú
-- advertiserovej vlastnej platenej kampane, tie sa naďalej posielajú vždy).
--
-- Spusti: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema-ad-automation-v2.sql

ALTER TABLE advertisers ADD COLUMN marketing_emails_opt_in TINYINT(1) NOT NULL DEFAULT 1;
