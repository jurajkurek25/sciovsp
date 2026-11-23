-- AutoSEO webhook storage — brand-new table only, no existing tables touched.
-- Safe to run multiple times.
CREATE TABLE IF NOT EXISTS autoseo_posts (
  id BIGINT PRIMARY KEY,               -- AutoSEO's own article id — upsert key
  event TEXT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  published_url TEXT,
  meta_description TEXT,
  content_html TEXT,
  content_markdown TEXT,
  hero_image_url TEXT,                 -- local /uploads/autoseo/... path once downloaded
  hero_image_alt TEXT,
  infographic_image_url TEXT,          -- local /uploads/autoseo/... path once downloaded
  keywords JSONB,
  meta_keywords TEXT,
  faq_schema JSONB,
  language_code TEXT,
  source_article_id BIGINT,
  status TEXT,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autoseo_posts_slug ON autoseo_posts (slug);
CREATE INDEX IF NOT EXISTS idx_autoseo_posts_language ON autoseo_posts (language_code);
CREATE INDEX IF NOT EXISTS idx_autoseo_posts_source_article ON autoseo_posts (source_article_id);
