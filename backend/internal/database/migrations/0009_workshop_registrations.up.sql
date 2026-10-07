-- =====================================================
-- 0009 — workshop registration
--
-- Visitors register for an upcoming workshop with a name and an email so the
-- organisers know who is coming.
--
--   workshops.registration_open  per-workshop switch (default: open)
--   workshops.capacity           optional seat limit; NULL means unlimited
--
--   workshop_registrations       one row per person per workshop. The email is
--                                compared case-insensitively, so the same
--                                address cannot register twice.
-- =====================================================

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS capacity INTEGER;

ALTER TABLE workshops
  DROP CONSTRAINT IF EXISTS workshops_capacity_check,
  ADD CONSTRAINT workshops_capacity_check
    CHECK (capacity IS NULL OR capacity > 0);

CREATE TABLE IF NOT EXISTS workshop_registrations (
  id UUID PRIMARY KEY,
  workshop_id UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workshop_registrations_email
  ON workshop_registrations (workshop_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_workshop_registrations_workshop
  ON workshop_registrations (workshop_id, created_at);
