import { create } from 'zustand';
import client from '../api/client';

/**
 * Contact messages carry no read flag on the server, so "new" means "arrived
 * after the newest message this browser had open in the inbox". That is a
 * per-browser convenience for the sidebar badge, not a shared inbox state.
 */
const SEEN_KEY = 'skillture.messages.seenAt';

interface MessageStamp {
  created_at: string;
}

/** Messages newer than `seenAt` (ISO string). With no marker nothing is "new" yet. */
export function countUnread(messages: MessageStamp[], seenAt: string | null): number {
  if (!seenAt) return 0;
  const seen = Date.parse(seenAt);
  if (Number.isNaN(seen)) return 0;
  return messages.filter(m => Date.parse(m.created_at) > seen).length;
}

/** Newest created_at in the list, or null when empty. */
export function newestStamp(messages: MessageStamp[]): string | null {
  let best: string | null = null;
  for (const m of messages) {
    if (best === null || Date.parse(m.created_at) > Date.parse(best)) best = m.created_at;
  }
  return best;
}

/** The inbox marker this browser last saved (ISO), or null. */
export const readSeen = (): string | null => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};

const writeSeen = (value: string) => {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Storage blocked: the badge just resets on reload.
  }
};

interface MessagesState {
  total: number | null;
  unread: number;
  /** Re-reads the inbox; resolves quietly on failure (a badge is not worth a toast). */
  refresh: () => Promise<void>;
  /** Marks everything currently in the inbox as seen. */
  markSeen: (messages: MessageStamp[]) => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  total: null,
  unread: 0,
  refresh: async () => {
    try {
      const res = await client.get<MessageStamp[]>('/api/v1/admin/contact');
      const list = Array.isArray(res.data) ? res.data : [];
      let seenAt = readSeen();
      // First visit ever: start from "everything so far is seen" so the badge
      // does not open at the whole backlog.
      if (!seenAt) {
        const newest = newestStamp(list);
        if (newest) {
          writeSeen(newest);
          seenAt = newest;
        }
      }
      set({ total: list.length, unread: countUnread(list, seenAt) });
    } catch {
      // Keep whatever we had.
    }
  },
  markSeen: (messages) => {
    const newest = newestStamp(messages);
    if (newest) writeSeen(newest);
    set({ total: messages.length, unread: 0 });
  },
}));
