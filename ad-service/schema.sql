-- SP Tréner Ads — MySQL schéma pre databázu "reklama".
-- Spusti raz: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema.sql
-- (CREATE TABLE IF NOT EXISTS je bezpečné spúšťať opakovane.)

CREATE TABLE IF NOT EXISTS advertisers (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password_hash      VARCHAR(255) NOT NULL,
  company_name       VARCHAR(255) NULL,
  stripe_customer_id VARCHAR(255) NULL UNIQUE,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Bannery (PNG/GIF/MP4 bez zvuku) — súbor žije lokálne v public/uploads/banners,
-- public_url je cesta k nemu (napr. /uploads/banners/12-172....png).
-- Predplatné sa platí za KAŽDÝ banner samostatne.
CREATE TABLE IF NOT EXISTS ad_banners (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  advertiser_id          INT NOT NULL,
  public_url             VARCHAR(500) NOT NULL,
  mime_type              VARCHAR(50) NOT NULL,
  link_url               VARCHAR(1000) NOT NULL,
  active                 TINYINT(1) NOT NULL DEFAULT 1,
  stripe_subscription_id VARCHAR(255) NULL UNIQUE,
  status                 VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  current_period_end     TIMESTAMP NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ad_banners_advertiser (advertiser_id),
  INDEX idx_ad_banners_status (status),
  CONSTRAINT fk_ad_banners_advertiser FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ad_events (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  banner_id   INT NOT NULL,
  event_type  VARCHAR(20) NOT NULL, -- 'impression' | 'click'
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ad_events_banner (banner_id),
  CONSTRAINT fk_ad_events_banner FOREIGN KEY (banner_id) REFERENCES ad_banners(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Video reklamy (so zvukom) — súbor v public/uploads/videos.
CREATE TABLE IF NOT EXISTS video_ads (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  advertiser_id          INT NOT NULL,
  public_url             VARCHAR(500) NOT NULL,
  mime_type              VARCHAR(50) NOT NULL,
  duration_s             INT NOT NULL,
  link_url               VARCHAR(1000) NOT NULL,
  active                 TINYINT(1) NOT NULL DEFAULT 1,
  stripe_subscription_id VARCHAR(255) NULL UNIQUE,
  status                 VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  current_period_end     TIMESTAMP NULL,
  created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_video_ads_advertiser (advertiser_id),
  INDEX idx_video_ads_status (status),
  CONSTRAINT fk_video_ads_advertiser FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Zhliadnutia video reklám — klik-tracking tu robí táto appka (video-ads/go/:id).
-- Pozn.: reward flow (odmena +1 test v hlavnej appke) zapisuje completed_at/reward_granted
-- odtiaľto len ak hlavná appka bude mať prístup k tejto istej MySQL databáze — pozri DEPLOY.md.
CREATE TABLE IF NOT EXISTS video_ad_views (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  video_ad_id    INT NOT NULL,
  user_email     VARCHAR(255) NOT NULL,
  session_token  VARCHAR(100) NOT NULL UNIQUE,
  started_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at   TIMESTAMP NULL,
  reward_granted TINYINT(1) NOT NULL DEFAULT 0,
  clicked        TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_video_ad_views_video (video_ad_id),
  INDEX idx_video_ad_views_email_day (user_email, completed_at),
  CONSTRAINT fk_video_ad_views_video FOREIGN KEY (video_ad_id) REFERENCES video_ads(id) ON DELETE CASCADE
) ENGINE=InnoDB;
