/**
 * Player avatar vocabulary — mirrors the quiz answer-shape glyphs so a
 * player's picked avatar reads consistently between the join screen, the
 * lobby, and the leaderboard.
 *
 * `avatarForPlayer` falls back to a glyph deterministically derived from the
 * player's id when avatar_id is unset (a player who joined before this
 * existed, or picked a custom photo instead) — other players' avatars stay
 * stable across renders even without a stored pick.
 */
export interface AvatarChoice {
  glyph: string;
  color: string;
  label: string;
}

export const AVATARS: AvatarChoice[] = [
  { glyph: '▲', color: '#e05555', label: 'Triangle' },
  { glyph: '●', color: '#fbbf24', label: 'Circle' },
  { glyph: '■', color: '#22c97a', label: 'Square' },
  { glyph: '◆', color: '#3b82f6', label: 'Diamond' },
  { glyph: '★', color: '#0ABFBC', label: 'Star' },
  { glyph: '✚', color: '#e05555', label: 'Cross' },
  { glyph: '⬢', color: '#22c97a', label: 'Hexagon' },
];

export const MAX_AVATAR_UPLOAD_MB = 5;
export const AVATAR_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Deterministic index into AVATARS for a player with no known pick. */
export function avatarIndexForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % AVATARS.length;
}

export function avatarForPlayer(id: string, avatarId?: number | null): AvatarChoice {
  const idx = typeof avatarId === 'number' ? avatarId : avatarIndexForId(id);
  return AVATARS[idx % AVATARS.length];
}
