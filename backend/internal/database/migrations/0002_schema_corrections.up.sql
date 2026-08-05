-- =====================================================
-- 0002 — schema corrections (D8)
--
-- Six defects that could not be fixed before migrations existed: editing
-- schema.sql only ever affected a fresh volume, so any deployed database kept
-- them.
-- =====================================================

-- -----------------------------------------------------
-- 1. Deleting an admin destroyed every game they hosted
--
-- quiz_sessions.host_id referenced admins(id) ON DELETE CASCADE, and
-- quiz_players and quiz_player_answers cascade from quiz_sessions. Removing
-- one admin account therefore erased every session they ever ran, every
-- player in those sessions, and every answer — all historical results, with
-- no warning.
--
-- SET NULL rather than RESTRICT: an admin who has left should be removable,
-- and the games they ran should outlive them. host_id becomes nullable, which
-- entities.QuizSession models as *uuid.UUID.
-- -----------------------------------------------------
ALTER TABLE quiz_sessions ALTER COLUMN host_id DROP NOT NULL;

ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS fk_quiz_sessions_host;
ALTER TABLE quiz_sessions ADD CONSTRAINT fk_quiz_sessions_host
    FOREIGN KEY (host_id) REFERENCES admins(id) ON DELETE SET NULL;

-- -----------------------------------------------------
-- 2. TIMESTAMP -> TIMESTAMPTZ
--
-- Every timestamp was `TIMESTAMP WITHOUT TIME ZONE`, which stores no offset.
-- The Go side writes time.Time in the process's local zone and Postgres
-- defaults use NOW() in the server's zone, so a container in a different TZ
-- silently shifted every value — and quiz scoring compares timestamps.
--
-- Existing values are interpreted as UTC, which is what both the containers
-- and NOW() on a UTC server were producing.
-- -----------------------------------------------------
ALTER TABLE admins                ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE forms                 ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE form_fields           ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE form_fields           ALTER COLUMN updated_at   TYPE TIMESTAMPTZ USING updated_at   AT TIME ZONE 'UTC';
ALTER TABLE responses             ALTER COLUMN submitted_at TYPE TIMESTAMPTZ USING submitted_at AT TIME ZONE 'UTC';
ALTER TABLE response_answers      ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE response_answer_vectors ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE quizzes               ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE quiz_questions        ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE quiz_questions        ALTER COLUMN updated_at   TYPE TIMESTAMPTZ USING updated_at   AT TIME ZONE 'UTC';
ALTER TABLE quiz_sessions         ALTER COLUMN created_at   TYPE TIMESTAMPTZ USING created_at   AT TIME ZONE 'UTC';
ALTER TABLE quiz_sessions         ALTER COLUMN started_at   TYPE TIMESTAMPTZ USING started_at   AT TIME ZONE 'UTC';
ALTER TABLE quiz_sessions         ALTER COLUMN finished_at  TYPE TIMESTAMPTZ USING finished_at  AT TIME ZONE 'UTC';
ALTER TABLE quiz_players          ALTER COLUMN joined_at    TYPE TIMESTAMPTZ USING joined_at    AT TIME ZONE 'UTC';
ALTER TABLE quiz_player_answers   ALTER COLUMN answered_at  TYPE TIMESTAMPTZ USING answered_at  AT TIME ZONE 'UTC';
ALTER TABLE homepage_content      ALTER COLUMN updated_at   TYPE TIMESTAMPTZ USING updated_at   AT TIME ZONE 'UTC';
ALTER TABLE homepage_images       ALTER COLUMN uploaded_at  TYPE TIMESTAMPTZ USING uploaded_at  AT TIME ZONE 'UTC';

-- -----------------------------------------------------
-- 3. updated_at never updated
--
-- Three tables carry an updated_at with a DEFAULT NOW() and no trigger, so the
-- column recorded the insert time and then never moved. The repositories set
-- it explicitly on UPDATE, but anything touching a row by any other route left
-- it stale, and a column named updated_at that silently lies is worse than no
-- column at all.
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_form_fields_updated_at ON form_fields;
CREATE TRIGGER trg_form_fields_updated_at
    BEFORE UPDATE ON form_fields
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_quiz_questions_updated_at ON quiz_questions;
CREATE TRIGGER trg_quiz_questions_updated_at
    BEFORE UPDATE ON quiz_questions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_homepage_content_updated_at ON homepage_content;
CREATE TRIGGER trg_homepage_content_updated_at
    BEFORE UPDATE ON homepage_content
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------------------------------
-- 4. Redundant index
--
-- quiz_sessions.pin is declared UNIQUE, which already creates a btree index.
-- idx_quiz_sessions_pin was a second copy of it: extra write cost on every
-- insert, no read benefit.
-- -----------------------------------------------------
DROP INDEX IF EXISTS idx_quiz_sessions_pin;

-- -----------------------------------------------------
-- 5. Missing foreign-key indexes
--
-- Postgres does not index the referencing side of a foreign key. Without
-- these, deleting an admin or a response answer sequentially scans the child
-- table to find rows to cascade.
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_host_id
    ON quiz_sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_response_answer_vectors_response_answer_id
    ON response_answer_vectors(response_answer_id);

-- -----------------------------------------------------
-- 6. Status columns accepted any value
--
-- Nothing at the database level stopped a status outside its enum. The Go
-- enums are the source of truth; these constraints make the database agree.
--
-- forms.status also had the wrong default and no NOT NULL. It defaulted to 1,
-- which enums.FormStatus reads as Published — so a form inserted without an
-- explicit status was born published and publicly answerable. The use case
-- always sets Draft explicitly, so nothing hit this in practice, but the
-- default should not be the one dangerous value.
-- -----------------------------------------------------
UPDATE forms SET status = 0 WHERE status IS NULL;
ALTER TABLE forms ALTER COLUMN status SET DEFAULT 0;
ALTER TABLE forms ALTER COLUMN status SET NOT NULL;

-- quizzes defaulted to 1 (Active) for the same reason; the handler always
-- sends Draft.
ALTER TABLE quizzes ALTER COLUMN status SET DEFAULT 0;

ALTER TABLE forms DROP CONSTRAINT IF EXISTS chk_forms_status;
ALTER TABLE forms ADD CONSTRAINT chk_forms_status
    CHECK (status IN (0, 1, 2));  -- draft | published | closed

ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS chk_quizzes_status;
ALTER TABLE quizzes ADD CONSTRAINT chk_quizzes_status
    CHECK (status IN (0, 1, 2));  -- draft | active | archived

ALTER TABLE responses DROP CONSTRAINT IF EXISTS chk_responses_status;
ALTER TABLE responses ADD CONSTRAINT chk_responses_status
    CHECK (status IN (0, 1, 2));  -- pending | submitted | reviewed

ALTER TABLE form_fields DROP CONSTRAINT IF EXISTS chk_form_fields_type;
ALTER TABLE form_fields ADD CONSTRAINT chk_form_fields_type
    CHECK (type BETWEEN 1 AND 8);  -- enums.FieldType, text .. date

ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS chk_quiz_sessions_status;
ALTER TABLE quiz_sessions ADD CONSTRAINT chk_quiz_sessions_status
    CHECK (status IN ('lobby', 'active', 'finished'));

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS chk_quiz_questions_type;
ALTER TABLE quiz_questions ADD CONSTRAINT chk_quiz_questions_type
    CHECK (type IN ('mcq', 'tf', 'short'));
