-- =====================================================
-- 0005 — workshops
--
-- Admin-managed events shown on the public homepage's "Upcoming Workshops"
-- section (previously a hardcoded array in HomePage.tsx). title/description/
-- extra_info follow the same {"en": "...", "ar": "..."} JSONB convention as
-- forms.title and quiz_questions.question — see form_fields in 0001 — so the
-- existing `localized()` frontend helper works unmodified.
--
-- "Upcoming" is derived from event_date >= CURRENT_DATE at query time (see
-- workshop_handler.go's public List), not a stored flag — a workshop ages
-- out of the public section on its own the day after it happens.
-- =====================================================
CREATE TABLE IF NOT EXISTS workshops (
  id UUID PRIMARY KEY,
  title JSONB NOT NULL,
  description JSONB NOT NULL,
  extra_info JSONB,
  image_path TEXT,
  event_date DATE NOT NULL,
  event_time TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshops_event_date ON workshops (event_date);

-- =====================================================
-- Table: contact_submissions
-- Messages sent through the homepage Contact Us form. Read-only from the
-- public side (POST to create); the admin dashboard lists and deletes.
-- =====================================================
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
