-- Shared key/value settings table so dash-service can flip a switch that
-- the main app (sptrener.online) reads. New table only — nothing existing
-- touched. Safe to run multiple times.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
