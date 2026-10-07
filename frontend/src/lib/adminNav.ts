/**
 * The admin information architecture: which sections exist, where they live,
 * and how a URL maps to a breadcrumb trail. Kept free of React so it is tested
 * directly.
 */

export type NavIconName =
  | 'dashboard'
  | 'home'
  | 'site'
  | 'workshops'
  | 'team'
  | 'messages'
  | 'forms'
  | 'quizzes'
  | 'builder';

export interface NavItem {
  label: string;
  path: string;
  icon: NavIconName;
}

export interface NavGroup {
  /** Null renders the group without a heading (the Overview link). */
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ label: 'Overview', path: '/admin/dashboard', icon: 'dashboard' }] },
  {
    label: 'Website',
    items: [
      { label: 'Homepage Editor', path: '/admin/homepage', icon: 'home' },
      { label: 'Site content', path: '/admin/site', icon: 'site' },
      { label: 'Workshops', path: '/admin/workshops', icon: 'workshops' },
      { label: 'Team', path: '/admin/team', icon: 'team' },
      { label: 'Messages', path: '/admin/messages', icon: 'messages' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { label: 'Forms', path: '/admin/forms', icon: 'forms' },
      { label: 'Quiz Game', path: '/admin/quizzes', icon: 'quizzes' },
      { label: 'Quiz Builder', path: '/admin/builder', icon: 'builder' },
    ],
  },
];

export interface Crumb {
  label: string;
  /** Absent on the current page. */
  to?: string;
}

const SECTION_OF: Record<string, string> = {
  homepage: 'Website',
  site: 'Website',
  workshops: 'Website',
  team: 'Website',
  messages: 'Website',
  forms: 'Engagement',
  quizzes: 'Engagement',
  builder: 'Engagement',
};

const SECTION_LABEL: Record<string, string> = {
  dashboard: 'Overview',
  homepage: 'Homepage Editor',
  site: 'Site content',
  workshops: 'Workshops',
  team: 'Team',
  messages: 'Messages',
  forms: 'Forms',
  quizzes: 'Quiz Game',
  builder: 'Quiz Builder',
};

/** True when `path` is the nav item's page or anything beneath it. */
export function isActivePath(pathname: string, itemPath: string): boolean {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/** Breadcrumb trail for an /admin URL, e.g. Engagement / Forms / Responses. */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean); // ['admin', 'forms', ':id', 'edit']
  const section = parts[1] ?? 'dashboard';
  const label = SECTION_LABEL[section];
  if (!label) return [{ label: 'Admin' }];

  const base = `/admin/${section}`;
  const trail: Crumb[] = [];
  const group = SECTION_OF[section];
  if (group) trail.push({ label: group });

  const rest = parts.slice(2);
  if (rest.length === 0) {
    trail.push({ label });
    return trail;
  }

  trail.push({ label, to: base });
  const last = rest[rest.length - 1];
  if (section === 'forms') {
    trail.push({ label: last === 'new' ? 'New form' : last === 'edit' ? 'Edit' : 'Responses' });
  } else if (section === 'builder') {
    trail.push({ label: 'Edit quiz' });
  } else {
    trail.push({ label: last });
  }
  return trail;
}

/** Last crumb, for the browser tab title. */
export function pageTitleFor(pathname: string): string {
  const trail = breadcrumbsFor(pathname);
  return trail[trail.length - 1].label;
}
