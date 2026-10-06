/** Remembers the last game a phone joined, so closing the tab is not the end of it. */
export interface Rejoin {
  sessionId: string;
  playerId: string;
  name: string;
  pin: string;
}

const KEY = 'skillture:player';

export function loadRejoin(): Rejoin | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Rejoin>;
    return v.sessionId && v.playerId && v.name ? (v as Rejoin) : null;
  } catch {
    return null;
  }
}

export function saveRejoin(r: Rejoin): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // Private mode: rejoin simply is not offered.
  }
}

export function clearRejoin(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
