import type { Locale } from '../../../context/LanguageStore';
import { labelOf, sectionOf, sectionRank, type TextOverrides, type TextRow } from '../../../lib/siteContent';

/**
 * Logic behind the Site content → Text editor, kept free of React.
 *
 * Every string on the public site has a built-in default. The admin sees the
 * text as it is now (their saved edit, else the default) and changes it; only
 * the differences from the default are stored, and an edit that puts the
 * default back removes the stored copy, so "reset" never leaves clutter.
 */

/** Longest text the server accepts for one string. */
export const MAX_TEXT_LEN = 5000;

/** Unsaved edits, by cell. A cell is one language of one string. */
export type Edits = Record<string, string>;

export const editKey = (key: string, locale: Locale): string => `${locale}|${key}`;

export interface Change {
  key: string;
  locale: Locale;
  /** Empty means "return to the default". */
  value: string;
}

/** The text that is saved right now for a cell: the stored edit, else the default. */
export function savedValue(row: TextRow, locale: Locale, saved: TextOverrides): string {
  return saved[locale][row.key] ?? row[locale];
}

/** What the editor shows for a cell: the unsaved edit, else the saved text. */
export function shownValue(row: TextRow, locale: Locale, saved: TextOverrides, edits: Edits): string {
  const edit = edits[editKey(row.key, locale)];
  return edit !== undefined ? edit : savedValue(row, locale, saved);
}

/** True when the saved text differs from the built-in default. */
export function isCustomised(row: TextRow, locale: Locale, saved: TextOverrides): boolean {
  const stored = saved[locale][row.key];
  return stored !== undefined && stored !== row[locale];
}

/** English cells of homepage copy are edited elsewhere and cannot change here. */
export const isEditable = (row: TextRow, locale: Locale): boolean => !(locale === 'en' && row.englishElsewhere);

const LOCALES: Locale[] = ['en', 'ar'];

/**
 * The changes to send: every edited cell whose text now differs from what is
 * saved. Text that is blank or equal to the default becomes a reset (empty
 * value) — and is skipped entirely if nothing was stored for it anyway.
 */
export function pendingChanges(rows: TextRow[], saved: TextOverrides, edits: Edits): Change[] {
  const changes: Change[] = [];
  for (const row of rows) {
    for (const locale of LOCALES) {
      if (!isEditable(row, locale)) continue;
      const edit = edits[editKey(row.key, locale)];
      if (edit === undefined) continue;
      if (edit === savedValue(row, locale, saved)) continue;

      const isReset = edit.trim() === '' || edit === row[locale];
      const hasStored = saved[locale][row.key] !== undefined;
      if (isReset && !hasStored) continue;
      changes.push({ key: row.key, locale, value: isReset ? '' : edit });
    }
  }
  return changes;
}

/** Edited cells that are longer than the server accepts. */
export function overLimit(edits: Edits): string[] {
  return Object.entries(edits)
    .filter(([, v]) => [...v].length > MAX_TEXT_LEN)
    .map(([k]) => k);
}

/** Does the row match what the admin typed in the search box? */
export function matchesQuery(row: TextRow, query: string, saved: TextOverrides, edits: Edits): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    labelOf(row.key),
    row.key,
    shownValue(row, 'en', saved, edits),
    shownValue(row, 'ar', saved, edits),
    row.en,
    row.ar,
  ];
  return haystack.some(h => h.toLowerCase().includes(q));
}

export interface Section {
  title: string;
  rows: TextRow[];
}

/** Rows grouped under their section heading, in the editor's fixed section order. */
export function groupRows(rows: TextRow[]): Section[] {
  const sections = new Map<string, TextRow[]>();
  for (const row of rows) {
    const title = sectionOf(row.key);
    const list = sections.get(title);
    if (list) list.push(row);
    else sections.set(title, [row]);
  }
  // Array.sort is stable, so sections of equal rank keep the order they appeared in.
  return [...sections].map(([title, list]) => ({ title, rows: list })).sort((a, b) => sectionRank(a.title) - sectionRank(b.title));
}

/** How many cells in a list of rows are customised (for the section badge). */
export function customisedCount(rows: TextRow[], saved: TextOverrides): number {
  let n = 0;
  for (const row of rows) for (const locale of LOCALES) if (isCustomised(row, locale, saved)) n++;
  return n;
}
