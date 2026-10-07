import { describe, expect, it } from 'vitest';
import type { TextOverrides, TextRow } from '../../../lib/siteContent';
import {
  customisedCount,
  editKey,
  groupRows,
  isCustomised,
  isEditable,
  matchesQuery,
  overLimit,
  pendingChanges,
  savedValue,
  shownValue,
  MAX_TEXT_LEN,
} from './siteTextModel';

const rows: TextRow[] = [
  { key: 'site.home.ctaPrimary', en: 'Book a workshop', ar: 'احجز ورشة', englishElsewhere: false },
  { key: 'site.home.ctaSecondary', en: 'See our work', ar: 'شاهد أعمالنا', englishElsewhere: false },
  { key: 'core.hero.title', en: 'Hero', ar: 'عنوان', englishElsewhere: true },
  { key: 'site.team.title', en: 'Team', ar: 'الفريق', englishElsewhere: false },
];
const [cta, cta2, hero, team] = rows;

const none: TextOverrides = { en: {}, ar: {} };
const saved: TextOverrides = { en: { 'site.home.ctaPrimary': 'Join us' }, ar: {} };

describe('values', () => {
  it('uses the stored edit, else the default', () => {
    expect(savedValue(cta, 'en', saved)).toBe('Join us');
    expect(savedValue(cta, 'ar', saved)).toBe('احجز ورشة');
  });

  it('shows an unsaved edit over everything', () => {
    expect(shownValue(cta, 'en', saved, { [editKey(cta.key, 'en')]: 'Typing…' })).toBe('Typing…');
    expect(shownValue(cta, 'en', saved, {})).toBe('Join us');
  });

  it('allows an empty edit to be shown (the user cleared the field)', () => {
    expect(shownValue(cta, 'en', saved, { [editKey(cta.key, 'en')]: '' })).toBe('');
  });

  it('flags a string as customised only when it differs from the default', () => {
    expect(isCustomised(cta, 'en', saved)).toBe(true);
    expect(isCustomised(cta, 'ar', saved)).toBe(false);
    expect(isCustomised(cta, 'en', { en: { [cta.key]: cta.en }, ar: {} })).toBe(false);
  });

  it('locks English for homepage copy managed elsewhere', () => {
    expect(isEditable(hero, 'en')).toBe(false);
    expect(isEditable(hero, 'ar')).toBe(true);
    expect(isEditable(cta, 'en')).toBe(true);
  });
});

describe('pendingChanges', () => {
  it('is empty when nothing was touched', () => {
    expect(pendingChanges(rows, none, {})).toEqual([]);
  });

  it('sends a new custom text', () => {
    expect(pendingChanges(rows, none, { [editKey(cta.key, 'en')]: 'Sign up' })).toEqual([
      { key: cta.key, locale: 'en', value: 'Sign up' },
    ]);
  });

  it('ignores an edit that equals what is already saved', () => {
    expect(pendingChanges(rows, saved, { [editKey(cta.key, 'en')]: 'Join us' })).toEqual([]);
  });

  it('turns "back to the default" into a reset when something was stored', () => {
    expect(pendingChanges(rows, saved, { [editKey(cta.key, 'en')]: cta.en })).toEqual([
      { key: cta.key, locale: 'en', value: '' },
    ]);
  });

  it('turns a cleared field into a reset when something was stored', () => {
    expect(pendingChanges(rows, saved, { [editKey(cta.key, 'en')]: '   ' })).toEqual([
      { key: cta.key, locale: 'en', value: '' },
    ]);
  });

  it('does nothing for a reset of text that was never customised', () => {
    expect(pendingChanges(rows, none, { [editKey(cta.key, 'en')]: '' })).toEqual([]);
    expect(pendingChanges(rows, none, { [editKey(cta.key, 'en')]: cta.en })).toEqual([]);
  });

  it('never sends English for homepage copy managed elsewhere', () => {
    expect(pendingChanges(rows, none, { [editKey(hero.key, 'en')]: 'Sneaky' })).toEqual([]);
    expect(pendingChanges(rows, none, { [editKey(hero.key, 'ar')]: 'عنوان جديد' })).toEqual([
      { key: hero.key, locale: 'ar', value: 'عنوان جديد' },
    ]);
  });

  it('keeps both languages of one string separate', () => {
    const changes = pendingChanges(rows, none, {
      [editKey(cta2.key, 'en')]: 'Our results',
      [editKey(cta2.key, 'ar')]: 'نتائجنا',
    });
    expect(changes).toHaveLength(2);
    expect(changes.map(c => c.locale).sort()).toEqual(['ar', 'en']);
  });

  it('preserves leading and trailing characters of real text', () => {
    expect(pendingChanges(rows, none, { [editKey(team.key, 'en')]: 'Our team\n' })[0].value).toBe('Our team\n');
  });
});

describe('overLimit', () => {
  it('finds edits beyond the server limit, counting characters not bytes', () => {
    expect(overLimit({ a: 'x'.repeat(MAX_TEXT_LEN) })).toEqual([]);
    expect(overLimit({ a: 'é'.repeat(MAX_TEXT_LEN), b: 'x'.repeat(MAX_TEXT_LEN + 1) })).toEqual(['b']);
  });
});

describe('search', () => {
  it('matches the label, key and either language, case-insensitively', () => {
    expect(matchesQuery(cta, 'cta primary', none, {})).toBe(true);
    expect(matchesQuery(cta, 'BOOK', none, {})).toBe(true);
    expect(matchesQuery(cta, 'احجز', none, {})).toBe(true);
    expect(matchesQuery(cta, 'zzz', none, {})).toBe(false);
  });

  it('matches what the admin is typing, not just the default', () => {
    expect(matchesQuery(cta, 'sign up', none, { [editKey(cta.key, 'en')]: 'Sign up now' })).toBe(true);
  });

  it('matches everything for an empty query', () => {
    expect(matchesQuery(cta, '   ', none, {})).toBe(true);
  });
});

describe('grouping', () => {
  it('groups by section heading in first-seen order', () => {
    const groups = groupRows(rows);
    expect(groups.map(g => g.title)).toEqual(['Homepage', 'Homepage — hero', 'Team page']);
    expect(groups[0].rows).toEqual([cta, cta2]);
  });

  it('counts customised cells', () => {
    expect(customisedCount(rows, none)).toBe(0);
    expect(customisedCount(rows, saved)).toBe(1);
  });
});
