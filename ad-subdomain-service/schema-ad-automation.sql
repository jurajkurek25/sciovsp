-- Automatizovaná starostlivosť o reklamných partnerov (advertiserov) bez
-- potreby ručného zásahu: upozornenie pred koncom kampane, potvrdenie
-- spustenia, pripomienka na neschválený PR článok, a detekcia opakovaných
-- zamietnutí obsahu automatickou kontrolou (možný fraud/abuse signál pre
-- admina — nikdy nič sama neblokuje, len označí na posúdenie).
--
-- Spusti: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema-ad-automation.sql

-- Kedy sa vygenerovaný návrh PR článku stal pripraveným na schválenie
-- inzerentom — potrebné na to, aby vedel cron zistiť, koľko dní tam už
-- nečinne čaká, a poslať pripomienku.
ALTER TABLE pr_articles ADD COLUMN draft_ready_at TIMESTAMP NULL;

-- Dedup log pre automatizované notifikácie — "period" umožňuje poslať
-- rovnaký typ upozornenia znova pri ďalšom predĺžení/cykle (napr. expiring
-- soon pri každom novom current_period_end), nie len raz navždy.
CREATE TABLE IF NOT EXISTS ad_notification_log (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  item_type         VARCHAR(20) NOT NULL,   -- 'banner' | 'video' | 'pr_article'
  item_id           INT NOT NULL,
  notification_type VARCHAR(30) NOT NULL,   -- 'expiring_soon' | 'campaign_live' | 'pr_approval_reminder'
  period            VARCHAR(20) NOT NULL DEFAULT 'once',
  sent_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_notification (item_type, item_id, notification_type, period)
) ENGINE=InnoDB;

-- Automaticky odhalené rizikové signály (napr. opakované zamietnutia
-- obsahu automatickou kontrolou) — systém len OZNAČÍ advertisera na
-- manuálne posúdenie, nikdy ho sám nezablokuje.
CREATE TABLE IF NOT EXISTS ad_flags (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  advertiser_id INT NOT NULL,
  flag_type     VARCHAR(30) NOT NULL,
  detail        TEXT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved      TINYINT(1) NOT NULL DEFAULT 0,
  resolved_at   TIMESTAMP NULL,
  INDEX idx_ad_flags_unresolved (resolved, created_at),
  CONSTRAINT fk_ad_flags_advertiser FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
) ENGINE=InnoDB;
