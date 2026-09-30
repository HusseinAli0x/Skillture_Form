-- =====================================================
-- 0003 — player avatars
--
-- The join screen lets a player pick one of the built-in glyph avatars or
-- upload their own photo, but quiz_players had nowhere to put that choice —
-- it only ever reached this device, not the host lobby or the leaderboard.
--
-- avatar_id indexes into the frontend's fixed AVATARS list (7 entries, see
-- frontend/src/lib/avatars.ts) and avatar_url carries a data: URL for an
-- uploaded photo. Exactly one is set at a time; both null means "no pick
-- yet", which the client renders as a deterministic glyph derived from the
-- player's id so unpicked avatars still look stable rather than blank.
-- =====================================================
ALTER TABLE quiz_players ADD COLUMN IF NOT EXISTS avatar_id SMALLINT;
ALTER TABLE quiz_players ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE quiz_players DROP CONSTRAINT IF EXISTS chk_quiz_players_avatar_id;
ALTER TABLE quiz_players ADD CONSTRAINT chk_quiz_players_avatar_id
    CHECK (avatar_id IS NULL OR avatar_id BETWEEN 0 AND 6);

-- Uploaded photos are inlined as data: URLs by the client (see PlayerJoin's
-- FileReader.readAsDataURL) and capped at 5MB there; this is a second,
-- server-side backstop against a client that skips the check.
ALTER TABLE quiz_players DROP CONSTRAINT IF EXISTS chk_quiz_players_avatar_url_size;
ALTER TABLE quiz_players ADD CONSTRAINT chk_quiz_players_avatar_url_size
    CHECK (avatar_url IS NULL OR length(avatar_url) <= 7000000);
