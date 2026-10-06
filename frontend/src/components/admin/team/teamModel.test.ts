import { describe, expect, it } from 'vitest';
import {
  emptyMemberForm,
  formToPayload,
  inGroup,
  matchesQuery,
  memberToForm,
  nextSortOrder,
  reorderInGroup,
  sortOrderForSave,
  validateMemberForm,
  type Member,
} from './teamModel';

const m = (id: string, group: Member['group'], sort_order: number, en = id): Member => ({
  id,
  name: { en, ar: `ar-${en}` },
  role: { en: 'Role', ar: 'دور' },
  photo_path: null,
  linkedin_url: null,
  group,
  sort_order,
});

describe('validateMemberForm', () => {
  const ok = { ...emptyMemberForm(), name_en: 'A', name_ar: 'ا', role_en: 'R', role_ar: 'د' };

  it('requires both languages for name and role', () => {
    expect(validateMemberForm(ok)).toEqual({});
    const errors = validateMemberForm({ ...ok, name_ar: '', role_en: ' ' });
    expect(Object.keys(errors).sort()).toEqual(['name', 'role']);
  });

  it('rejects a non-http LinkedIn link', () => {
    expect(validateMemberForm({ ...ok, linkedin_url: 'linkedin.com/in/x' }).linkedin_url).toBeTruthy();
    expect(validateMemberForm({ ...ok, linkedin_url: 'https://linkedin.com/in/x' }).linkedin_url).toBeUndefined();
  });
});

describe('formToPayload', () => {
  it('maps blanks to null/empty so the API clears them', () => {
    const body = formToPayload(
      { ...emptyMemberForm('leadership'), name_en: ' A ', name_ar: 'ا', role_en: 'R', role_ar: 'د' },
      3
    );
    expect(body).toEqual({
      name: { en: 'A', ar: 'ا' },
      role: { en: 'R', ar: 'د' },
      bio: {},
      photo_path: null,
      linkedin_url: null,
      group: 'leadership',
      sort_order: 3,
    });
  });

  it('round-trips an existing member', () => {
    const member = { ...m('a', 'core', 2), bio: { en: 'Hi', ar: 'مرحبا' }, linkedin_url: 'https://x.org/a' };
    expect(formToPayload(memberToForm(member), 2)).toMatchObject({
      bio: { en: 'Hi', ar: 'مرحبا' },
      linkedin_url: 'https://x.org/a',
    });
  });
});

describe('ordering', () => {
  const members = [m('a', 'core', 0), m('b', 'core', 1), m('c', 'core', 2), m('x', 'leadership', 0)];

  it('lists a group in sort order', () => {
    expect(inGroup([m('b', 'core', 5), m('a', 'core', 1)], 'core').map(x => x.id)).toEqual(['a', 'b']);
  });

  it('moves a member and reports only the writes needed', () => {
    const { ordered, changes } = reorderInGroup(members, 'c', 0);
    expect(ordered.map(x => x.id)).toEqual(['c', 'a', 'b']);
    expect(changes).toEqual([
      { id: 'c', sort_order: 0 },
      { id: 'a', sort_order: 1 },
      { id: 'b', sort_order: 2 },
    ]);
  });

  it('does nothing when moved past the end', () => {
    expect(reorderInGroup(members, 'c', 5).changes).toEqual([]);
  });

  it('does not renumber a group whose orders do not start at 0 when nothing moved', () => {
    const offset = [m('p', 'core', 4), m('q', 'core', 5)];
    expect(reorderInGroup(offset, 'q', 9).changes).toEqual([]);
    expect(reorderInGroup(offset, 'q', 0).changes).toEqual([
      { id: 'q', sort_order: 0 },
      { id: 'p', sort_order: 1 },
    ]);
  });

  it('does not touch other groups', () => {
    const { changes } = reorderInGroup(members, 'b', 0);
    expect(changes.map(c => c.id)).not.toContain('x');
  });

  it('places a new or regrouped member last', () => {
    expect(nextSortOrder(members, 'core')).toBe(3);
    expect(nextSortOrder(members, 'alumni')).toBe(0);
    expect(sortOrderForSave(members, members[0], 'core')).toBe(0);
    expect(sortOrderForSave(members, members[0], 'leadership')).toBe(1);
    expect(sortOrderForSave(members, undefined, 'core')).toBe(3);
  });
});

describe('matchesQuery', () => {
  it('searches names and roles in both languages', () => {
    expect(matchesQuery(m('a', 'core', 0, 'Salma'), 'sal')).toBe(true);
    expect(matchesQuery(m('a', 'core', 0, 'Salma'), 'ar-sal')).toBe(true);
    expect(matchesQuery(m('a', 'core', 0, 'Salma'), 'zzz')).toBe(false);
    expect(matchesQuery(m('a', 'core', 0), '')).toBe(true);
  });
});
