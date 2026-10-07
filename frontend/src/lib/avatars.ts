/**
 * Player avatar vocabulary — mirrors the quiz answer-shape glyphs so a
 * player's picked avatar reads consistently between the join screen, the
 * lobby, and the leaderboard.
 *
 * The backend stores only an index (avatar_id 0-6), so the order here is part
 * of the wire contract: append, never reorder. Colours are drawn from the
 * identity (turquoise, teal, white) plus a few warm/cool accents; coral is
 * kept out on purpose — it means "wrong" and "live" everywhere else.
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
  { glyph: '▲', color: '#00cccc', label: 'Triangle' },
  { glyph: '●', color: '#fbbf24', label: 'Circle' },
  { glyph: '■', color: '#2fd58a', label: 'Square' },
  { glyph: '◆', color: '#5aa2ff', label: 'Diamond' },
  { glyph: '★', color: '#f1f8f8', label: 'Star' },
  { glyph: '✚', color: '#ffb067', label: 'Cross' },
  { glyph: '⬢', color: '#01a3a3', label: 'Hexagon' },
];

export const MAX_AVATAR_UPLOAD_MB = 5;
export const AVATAR_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/** Edge length of an uploaded avatar after it is shrunk for the wire. */
export const AVATAR_PX = 160;

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
  return AVATARS[((idx % AVATARS.length) + AVATARS.length) % AVATARS.length];
}

const ADJECTIVES = ['Curious', 'Bright', 'Sharp', 'Quick', 'Bold', 'Clever', 'Calm', 'Lucky', 'Witty', 'Brave'];
const NOUNS = ['Fox', 'Owl', 'Falcon', 'Lynx', 'Otter', 'Comet', 'Maze', 'Column', 'Spark', 'Compass'];

/** A friendly suggestion for a player who does not want to type. `rng` returns [0,1). */
export function randomNickname(rng: () => number = Math.random): string {
  const pick = <T,>(list: T[]) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

/** First letter(s) of a name for places a glyph is too noisy. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? Array.from(parts[0]).slice(0, 2) : parts.slice(0, 2).map(p => Array.from(p)[0]);
  return letters.join('').toUpperCase();
}

/**
 * Centre-crops a picked photo to a small square JPEG data URL.
 *
 * The avatar rides along on every leaderboard broadcast, to every player, on
 * every answer — so a 5 MB phone photo would be re-sent hundreds of times.
 * At 160px it is a few kilobytes.
 */
export function resizeAvatarFile(file: File, size = AVATAR_PX): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx || side === 0) {
        reject(new Error('Could not read that image.'));
        return;
      }
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}
