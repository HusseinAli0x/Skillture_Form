-- =====================================================
-- 0007 — finish the TIMESTAMP -> TIMESTAMPTZ conversion
--
-- 0002 converted every timestamp column that existed then. Tables added after
-- it (homepage content, workshops, contact messages, team members) were
-- created with plain TIMESTAMP, which the schema test in migrate_integration_test.go
-- rejects: a TIMESTAMP WITHOUT TIME ZONE silently shifts by the server's zone
-- when the database and the application disagree.
--
-- Same rule as 0002: existing values are UTC (the column default is NOW() on a
-- UTC server), so they are reinterpreted AT TIME ZONE 'UTC'. Running this on a
-- column that is already TIMESTAMPTZ is a no-op, so it is safe on any database.
-- =====================================================
ALTER TABLE homepage_about_facts    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE homepage_offer_pillars  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE workshops               ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE workshops               ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE contact_submissions     ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE team_members            ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
ALTER TABLE team_members            ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
