import type { FieldErrors } from '../serverErrors';
import { moveItem, renumber } from '../listOps';

export type Group = 'leadership' | 'core' | 'volunteer' | 'alumni';

export const GROUPS: { value: Group; label: string; blurb: string }[] = [
  { value: 'leadership', label: 'Leadership', blurb: 'Shown first on the Team page' },
  { value: 'core', label: 'Core team', blurb: 'The people who run Skillture day to day' },
  { value: 'volunteer', label: 'Volunteers', blurb: 'Helpers and facilitators' },
  { value: 'alumni', label: 'Alumni', blurb: 'Former members' },
];

export interface Member {
  id: string;
  name: { en: string; ar: string };
  role: { en: string; ar: string };
  bio?: { en?: string; ar?: string } | null;
  photo_path: string | null;
  linkedin_url: string | null;
  group: Group;
  sort_order: number;
}

export interface MemberForm {
  name_en: string;
  name_ar: string;
  role_en: string;
  role_ar: string;
  bio_en: string;
  bio_ar: string;
  group: Group;
  photo_path: string;
  linkedin_url: string;
}

export const emptyMemberForm = (group: Group = 'core'): MemberForm => ({
  name_en: '',
  name_ar: '',
  role_en: '',
  role_ar: '',
  bio_en: '',
  bio_ar: '',
  group,
  photo_path: '',
  linkedin_url: '',
});

export const memberToForm = (m: Member): MemberForm => ({
  name_en: m.name.en || '',
  name_ar: m.name.ar || '',
  role_en: m.role.en || '',
  role_ar: m.role.ar || '',
  bio_en: m.bio?.en || '',
  bio_ar: m.bio?.ar || '',
  group: m.group,
  photo_path: m.photo_path || '',
  linkedin_url: m.linkedin_url || '',
});

export const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

export interface MemberPayload {
  name: { en: string; ar: string };
  role: { en: string; ar: string };
  bio: { en: string; ar: string } | Record<string, never>;
  photo_path: string | null;
  linkedin_url: string | null;
  group: Group;
  sort_order: number;
}

/** Body for POST/PUT /api/v1/admin/team. */
export function formToPayload(form: MemberForm, sortOrder: number): MemberPayload {
  return {
    name: { en: form.name_en.trim(), ar: form.name_ar.trim() },
    role: { en: form.role_en.trim(), ar: form.role_ar.trim() },
    bio: form.bio_en.trim() || form.bio_ar.trim() ? { en: form.bio_en.trim(), ar: form.bio_ar.trim() } : {},
    photo_path: form.photo_path || null,
    linkedin_url: form.linkedin_url.trim() || null,
    group: form.group,
    sort_order: sortOrder,
  };
}

/** A member re-expressed as a write body, for changing only its sort order. */
export const memberToPayload = (m: Member, sortOrder: number): MemberPayload => formToPayload(memberToForm(m), sortOrder);

export const TEAM_SERVER_FIELDS: Record<string, string> = {
  name: 'name',
  role: 'role',
  bio: 'bio',
  group: 'group',
  linkedin_url: 'linkedin_url',
  photo_path: 'photo_path',
};

export function validateMemberForm(form: MemberForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name_en.trim() || !form.name_ar.trim()) errors.name = 'Add the name in both English and Arabic.';
  if (!form.role_en.trim() || !form.role_ar.trim()) errors.role = 'Add the role in both English and Arabic.';
  if (form.linkedin_url.trim() && !isHttpUrl(form.linkedin_url.trim())) {
    errors.linkedin_url = 'The link must start with http:// or https://';
  }
  return errors;
}

/** Members of one group, in the order the public page shows them. */
export const inGroup = (members: readonly Member[], group: Group): Member[] =>
  members.filter(m => m.group === group).sort((a, b) => a.sort_order - b.sort_order);

/**
 * Moving a member within its group: the group's new order, and the write each
 * affected person needs. Empty `changes` means nothing moved.
 */
export function reorderInGroup(members: readonly Member[], id: string, to: number) {
  const target = members.find(m => m.id === id);
  if (!target) return { ordered: [] as Member[], changes: [] as { id: string; sort_order: number }[] };
  const group = inGroup(members, target.group);
  const ordered = moveItem(group, group.findIndex(m => m.id === id), to);
  // Orders may not start at 0 (the API numbers across all groups), so a move
  // that changes nothing must not renumber the whole group.
  const moved = ordered.some((m, i) => m.id !== group[i].id);
  return { ordered, changes: moved ? renumber(ordered) : [] };
}

export const matchesQuery = (m: Member, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [m.name.en, m.name.ar, m.role.en, m.role.ar].some(s => s?.toLowerCase().includes(q));
};

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?';

/** One past the highest order in the group, so a new arrival lands last. */
export const nextSortOrder = (members: readonly Member[], group: Group): number => {
  const orders = members.filter(m => m.group === group).map(m => m.sort_order);
  return orders.length === 0 ? 0 : Math.max(...orders) + 1;
};

/**
 * Order to save with an edited member: unchanged while it stays in its group,
 * last place when it moves to another one (or is new).
 */
export const sortOrderForSave = (members: readonly Member[], existing: Member | undefined, group: Group): number =>
  existing && existing.group === group ? existing.sort_order : nextSortOrder(members, group);
