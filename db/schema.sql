-- VSP Tréner — databázová schéma
-- Spustiť: psql -U postgres -d vsp_trainer -f schema.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Používatelia
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  verified      BOOLEAN DEFAULT FALSE,
  verify_token  TEXT,
  reset_token   TEXT,
  reset_expires TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_login    TIMESTAMPTZ
);

-- Predplatné
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan                  TEXT DEFAULT 'free',  -- 'free' | 'pro'
  status                TEXT DEFAULT 'inactive', -- 'active' | 'inactive' | 'cancelled' | 'past_due'
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- História testov
CREATE TABLE IF NOT EXISTS test_results (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL,  -- 'full' | 'verbal' | 'analytical' | 'topic' | 'ai'
  score       NUMERIC(5,2),
  correct     INT DEFAULT 0,
  wrong       INT DEFAULT 0,
  skipped     INT DEFAULT 0,
  verbal_pct  INT,  -- odhadnutý percentil
  analyt_pct  INT,
  est_pct     INT,
  duration_s  INT,
  answers     JSONB,  -- {questionId: answerIndex}
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- AI generované úlohy (cache)
CREATE TABLE IF NOT EXISTS ai_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  topic       TEXT NOT NULL,
  part        TEXT NOT NULL,  -- 'verbal' | 'analytical'
  question    TEXT NOT NULL,
  options     JSONB NOT NULL,  -- ["A","B","C","D"]
  answer      INT NOT NULL,    -- index správnej odpovede
  explanation TEXT,
  difficulty  TEXT DEFAULT 'medium',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Blog
CREATE TABLE IF NOT EXISTS blog_posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  excerpt     TEXT NOT NULL,
  content     TEXT NOT NULL,  -- HTML
  tag         TEXT,           -- napr. 'Príprava', 'Psychológia'
  read_time   TEXT,           -- napr. '6 min čítania'
  published   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Reklamný systém (ad.sptrener.online)
-- Predplatné sa platí ZA KAŽDÝ BANNER SAMOSTATNE (nie raz za účet inzerenta) —
-- preto stripe_subscription_id/status/current_period_end žijú na ad_banners, nie na advertisers.
CREATE TABLE IF NOT EXISTS advertisers (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email              TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  company_name       TEXT,
  stripe_customer_id TEXT UNIQUE,  -- jeden Stripe zákazník, môže mať viac predplatných (jedno na banner)
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Nahraté banner kreatívy (PNG/GIF/MP4 uložené priamo v DB) — každý riadok = vlastné mesačné predplatné
CREATE TABLE IF NOT EXISTS ad_banners (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id          UUID REFERENCES advertisers(id) ON DELETE CASCADE,
  file_name              TEXT NOT NULL,
  mime_type              TEXT NOT NULL,  -- image/png | image/gif | video/mp4
  file_data              BYTEA NOT NULL,
  link_url               TEXT NOT NULL,
  active                 BOOLEAN DEFAULT TRUE,  -- inzerent si banner môže sám pozastaviť bez zrušenia platby
  stripe_subscription_id TEXT UNIQUE,
  status                 TEXT DEFAULT 'pending_payment', -- 'pending_payment' | 'active' | 'past_due' | 'cancelled'
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Impresie a kliky na bannery
CREATE TABLE IF NOT EXISTS ad_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  banner_id   UUID REFERENCES ad_banners(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,  -- 'impression' | 'click'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Video reklamy (rewarded video, so zvukom) — drahšia alternatíva k banneru, odmeňuje
-- registrovaného free používateľa bonus testom za plné dopozeranie. Rovnaký princíp
-- fakturácie ako ad_banners: predplatné sa platí za KAŽDÉ video samostatne.
CREATE TABLE IF NOT EXISTS video_ads (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id          UUID REFERENCES advertisers(id) ON DELETE CASCADE,
  file_name              TEXT NOT NULL,
  mime_type              TEXT NOT NULL,  -- video/mp4
  file_data              BYTEA NOT NULL,
  duration_s             INT NOT NULL,   -- deklarovaná dĺžka videa — používa sa na overenie plného dopozerania
  link_url               TEXT NOT NULL,
  active                 BOOLEAN DEFAULT TRUE,
  stripe_subscription_id TEXT UNIQUE,
  status                 TEXT DEFAULT 'pending_payment', -- 'pending_payment' | 'active' | 'past_due' | 'cancelled'
  current_period_end     TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- Zhliadnutia video reklám — slúži zároveň ako anti-cheat session (start/complete),
-- denný limit odmien (max 3/deň na používateľa) aj štatistiky pre inzerenta
CREATE TABLE IF NOT EXISTS video_ad_views (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_ad_id    UUID REFERENCES video_ads(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token  TEXT UNIQUE NOT NULL,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  reward_granted BOOLEAN DEFAULT FALSE,
  clicked        BOOLEAN DEFAULT FALSE
);

-- Indexy
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_results_user ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_questions_user ON ai_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advertisers_email ON advertisers(email);
CREATE INDEX IF NOT EXISTS idx_ad_banners_advertiser ON ad_banners(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_ad_banners_active ON ad_banners(active);
CREATE INDEX IF NOT EXISTS idx_ad_banners_status ON ad_banners(status);
CREATE INDEX IF NOT EXISTS idx_ad_events_banner ON ad_events(banner_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_type_created ON ad_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_video_ads_advertiser ON video_ads(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_video_ads_status ON video_ads(status);
CREATE INDEX IF NOT EXISTS idx_video_ad_views_video ON video_ad_views(video_ad_id);
CREATE INDEX IF NOT EXISTS idx_video_ad_views_user_day ON video_ad_views(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_video_ad_views_token ON video_ad_views(session_token);
