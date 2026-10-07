import { create } from 'zustand';
import client from '../api/client';
import {
  DEFAULT_SETTINGS,
  EMPTY_CONTENT,
  parseSiteContent,
  type SiteContent,
  type SiteSettings,
} from '../lib/siteContent';
import type { Locale } from './LanguageStore';

/**
 * Admin-edited site content (wording, images, contact links), loaded once when
 * the app starts. `status` lets the public shell wait a moment for it so a
 * visitor never sees the built-in text flash into the edited text.
 */
export type SiteStatus = 'loading' | 'ready' | 'failed';

export interface TextChange {
  key: string;
  locale: Locale;
  /** Empty removes the override (the default wording returns). */
  value: string;
}

interface SiteState extends SiteContent {
  status: SiteStatus;
  /** Fetch the content. Safe to call again after an admin saves a change. */
  load: () => Promise<void>;
  /**
   * Apply an edit the server has just accepted, without waiting for a refetch.
   * The admin editors use these so what they show is what was saved even if the
   * follow-up `load()` fails.
   */
  patchText: (changes: TextChange[]) => void;
  patchImage: (slot: string, path: string | null) => void;
  patchSettings: (settings: Partial<SiteSettings>) => void;
}

/** How long the shell waits for the content before showing the defaults. */
const WAIT_MS = 2500;

let inFlight: Promise<void> | null = null;

export const useSiteStore = create<SiteState>(set => ({
  ...EMPTY_CONTENT,
  status: 'loading',

  load: () => {
    if (inFlight) return inFlight;

    // Do not hold the page hostage to a slow request: after WAIT_MS render the
    // built-in content. If the response lands later it is still applied.
    const giveUp = setTimeout(() => set(s => (s.status === 'loading' ? { status: 'failed' } : s)), WAIT_MS);

    inFlight = client
      .get<unknown>('/api/v1/site')
      .then(res => set({ ...parseSiteContent(res.data), status: 'ready' }))
      .catch(() => set(s => (s.status === 'ready' ? s : { status: 'failed' })))
      .finally(() => {
        clearTimeout(giveUp);
        inFlight = null;
      });
    return inFlight;
  },

  patchText: changes =>
    set(s => {
      const text: SiteState['text'] = { en: { ...s.text.en }, ar: { ...s.text.ar } };
      for (const c of changes) {
        if (c.value.trim() === '') delete text[c.locale][c.key];
        else text[c.locale][c.key] = c.value;
      }
      return { text };
    }),

  patchImage: (slot, path) =>
    set(s => {
      const images = { ...s.images };
      if (path) images[slot] = path;
      else delete images[slot];
      return { images };
    }),

  patchSettings: settings =>
    set(s => {
      const next = { ...s.settings };
      for (const [key, value] of Object.entries(settings) as [keyof SiteSettings, string][]) {
        const v = value.trim();
        // An emptied email returns to the default; an emptied link is hidden.
        next[key] = v === '' && key === 'contact_email' ? DEFAULT_SETTINGS.contact_email : v;
      }
      return { settings: next };
    }),
}));
