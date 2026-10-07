-- =====================================================
-- 0011 — a player proves who they are
--
-- A player used to be identified by their player id alone. That id is not
-- secret: the public leaderboard lists every player's id, and so do the game's
-- broadcasts. Anyone in the room could therefore answer on behalf of another
-- player (locking in a wrong answer for them) or open their socket.
--
-- On joining, a player now receives a random secret, shown to them once. Only
-- its SHA-256 is stored here. Answering and opening the player socket require
-- it. NULL means the player joined before this migration; such rows keep
-- working so a game in progress during an upgrade is not interrupted.
-- =====================================================

ALTER TABLE quiz_players ADD COLUMN IF NOT EXISTS secret_hash TEXT;
