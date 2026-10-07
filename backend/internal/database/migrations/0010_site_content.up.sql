-- =====================================================
-- 0010 — editable site content
--
-- Everything a visitor reads on the public site can be changed from the admin
-- without a deploy. The built-in wording and images stay in the code as
-- defaults; these tables hold only what an admin has changed, so "reset to
-- default" is just deleting a row.
--
--   site_text_overrides  one row per (string key, language). Keys are the
--                        dotted paths of the frontend's string tables, for
--                        example "home.ctaPrimary".
--   site_assets          one row per image slot (logo, section photos...).
--   site_settings        small facts the site shows as links: contact email,
--                        social profiles.
-- =====================================================

CREATE TABLE IF NOT EXISTS site_text_overrides (
  key TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'ar')),
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (key, locale)
);

CREATE TABLE IF NOT EXISTS site_assets (
  slot TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
