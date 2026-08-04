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

-- Indexy
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_results_user ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_questions_user ON ai_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, created_at DESC);
