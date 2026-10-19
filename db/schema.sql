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
  last_login    TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ
);

-- Pre existujúcu DB (tabuľka už bola vytvorená bez stĺpca)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

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

-- Indexy
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_results_user ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_questions_user ON ai_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── Zdieľaná banka úloh ────────────────────────────────────
-- Úlohy nie sú personalizované, takže jedna vygenerovaná úloha slúži všetkým
-- používateľom. AI sa volá len keď v banke chýba úloha, ktorú používateľ
-- ešte nevidel; banku dopĺňa aj nočný scripts/fill-bank.js cez Batch API.
CREATE TABLE IF NOT EXISTS bank_questions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic       TEXT NOT NULL,
  part        TEXT NOT NULL,  -- 'verbal' | 'analytical'
  difficulty  TEXT NOT NULL DEFAULT 'medium',
  question    TEXT NOT NULL,
  context     TEXT,
  options     JSONB NOT NULL,
  answer      INT NOT NULL,
  explanation TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bank_questions_filter ON bank_questions(part, difficulty, topic);

-- Ktoré úlohy z banky už používateľ dostal (aby ich nedostal znova).
CREATE TABLE IF NOT EXISTS user_bank_questions (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES bank_questions(id) ON DELETE CASCADE,
  served_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_user_bank_questions_served ON user_bank_questions(user_id, served_at);

-- Presun doteraz vygenerovaných úloh (ai_questions) do banky — id ostávajú.
INSERT INTO bank_questions (id, topic, part, difficulty, question, options, answer, explanation, created_at)
SELECT id, topic, part, COALESCE(difficulty, 'medium'), question, options, answer, explanation, created_at
FROM ai_questions
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_bank_questions (user_id, question_id, served_at)
SELECT user_id, id, created_at FROM ai_questions WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;
