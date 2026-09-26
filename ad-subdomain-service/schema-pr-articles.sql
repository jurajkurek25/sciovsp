-- Nová tabuľka pre "PR článok na blog" — nový typ reklamy popri banneroch a
-- video reklamách. Jednorazová platba (nie predplatné), AI vedie interview
-- (otázky/odpovede) a po zaplatení AI sama vygeneruje a vypublikuje článok
-- na blog hlavnej appky (sptrener.online).
--
-- Spusti raz: mysql -h 127.0.0.1 -P 3306 -u reklama -p reklama < schema-pr-articles.sql
-- (CREATE TABLE IF NOT EXISTS je bezpečné spúšťať opakovane.)

CREATE TABLE IF NOT EXISTS pr_articles (
  id                       INT AUTO_INCREMENT PRIMARY KEY,
  advertiser_id            INT NOT NULL,
  company_name             VARCHAR(255) NOT NULL,
  product_info             TEXT NOT NULL,   -- čo firma/produkt robí
  student_benefit          TEXT NOT NULL,   -- prečo sa to hodí študentom
  student_outcome          TEXT NOT NULL,   -- aký výsledok z toho majú študenti
  blog_fit                 TEXT NOT NULL,   -- prečo sa to hodí do nášho blogu
  target_url               VARCHAR(1000) NOT NULL,
  questions_json           TEXT NULL,       -- AI vygenerované doplňujúce otázky
  answers_json             TEXT NULL,       -- odpovede inzerenta
  status                   VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- 'draft' | 'questions_ready' | 'answered' | 'paid' | 'generating' | 'published' | 'failed'
  stripe_payment_intent_id VARCHAR(255) NULL UNIQUE,
  generated_title          VARCHAR(500) NULL,
  generated_slug           VARCHAR(255) NULL,
  blog_url                 VARCHAR(500) NULL,
  moderation_allowed       TINYINT(1) NULL,
  moderation_reason        TEXT NULL,
  fail_reason              TEXT NULL,
  paid_at                  TIMESTAMP NULL,
  published_at             TIMESTAMP NULL,
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pr_articles_advertiser (advertiser_id),
  INDEX idx_pr_articles_status (status),
  CONSTRAINT fk_pr_articles_advertiser FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Rovnaká audit-log tabuľka ako moderation_log, len item_type='pr_article' —
-- žiadna schémová zmena netreba, moderation_log už item_type podporuje ako
-- voľný VARCHAR(10). Nič ďalšie tu netreba vytvárať.
