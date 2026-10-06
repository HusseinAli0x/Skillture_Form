-- =====================================================
-- 0006 — team members and workshop recaps
--
-- Two public-site features driven by admin-authored content:
--
--   * "Our Work": past workshops become a portfolio. Each workshop can now
--     carry a track, location, speaker, attendee count, a short outcome
--     headline (e.g. "+34% average quiz score"), a longer recap, a photo
--     gallery and, for upcoming events, a registration link. All columns are
--     nullable / defaulted so existing rows and the existing admin payload keep
--     working unchanged.
--
--   * "Team": the people behind Skillture, grouped for display.
--
-- Bilingual text uses the same {"en": "...", "ar": "..."} JSONB convention as
-- workshops.title (0005), so the frontend `localized()` helper works as-is.
-- =====================================================

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS track TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS speaker TEXT,
  ADD COLUMN IF NOT EXISTS attendees INTEGER,
  ADD COLUMN IF NOT EXISTS outcome JSONB,
  ADD COLUMN IF NOT EXISTS recap JSONB,
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS registration_url TEXT;

ALTER TABLE workshops
  DROP CONSTRAINT IF EXISTS workshops_track_check,
  ADD CONSTRAINT workshops_track_check
    CHECK (track IS NULL OR track IN ('technical', 'career', 'industry', 'business')),
  DROP CONSTRAINT IF EXISTS workshops_attendees_check,
  ADD CONSTRAINT workshops_attendees_check
    CHECK (attendees IS NULL OR attendees >= 0);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY,
  name JSONB NOT NULL,
  role JSONB NOT NULL,
  bio JSONB,
  photo_path TEXT,
  linkedin_url TEXT,
  member_group TEXT NOT NULL DEFAULT 'core'
    CHECK (member_group IN ('leadership', 'core', 'volunteer', 'alumni')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_group_order
  ON team_members (member_group, sort_order);
