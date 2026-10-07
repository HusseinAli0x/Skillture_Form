-- =====================================================
-- 0008 — anyone can create and host a game
--
-- Until now only admins could create quizzes, so ownership did not exist:
-- every admin could edit every quiz. Visitors without an account now host
-- games too. They are identified by a random key their browser generates and
-- sends in the X-Host-Key header; only a SHA-256 hash of it is stored here, so
-- a database leak does not hand out control of anyone's games.
--
--   * NULL owner_key_hash  -> created by an admin (admins manage everything).
--   * non-NULL             -> created by the visitor holding the matching key.
--
-- PINs: quiz_sessions.pin was UNIQUE across all sessions ever created. With
-- six-digit PINs and public hosting, finished games would slowly use up the
-- whole PIN space and new games would start failing. A PIN only has to be
-- unambiguous among games that can still be joined, so uniqueness is now
-- limited to sessions that are not finished.
-- =====================================================

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS owner_key_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_quizzes_owner_key_hash
  ON quizzes (owner_key_hash)
  WHERE owner_key_hash IS NOT NULL;

ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_pin_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_sessions_open_pin
  ON quiz_sessions (pin)
  WHERE status <> 'finished';
