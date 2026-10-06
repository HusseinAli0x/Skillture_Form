import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, breadcrumbsFor, isActivePath, pageTitleFor } from './adminNav';

describe('isActivePath', () => {
  it('matches the page and anything beneath it, not a sibling prefix', () => {
    expect(isActivePath('/admin/forms', '/admin/forms')).toBe(true);
    expect(isActivePath('/admin/forms/abc/edit', '/admin/forms')).toBe(true);
    expect(isActivePath('/admin/formsX', '/admin/forms')).toBe(false);
    expect(isActivePath('/admin/builder', '/admin/forms')).toBe(false);
  });
});

describe('breadcrumbsFor', () => {
  it('shows a single crumb for the overview', () => {
    expect(breadcrumbsFor('/admin/dashboard')).toEqual([{ label: 'Overview' }]);
  });

  it('groups sections under Website / Engagement', () => {
    expect(breadcrumbsFor('/admin/messages')).toEqual([{ label: 'Website' }, { label: 'Messages' }]);
    expect(breadcrumbsFor('/admin/quizzes')).toEqual([{ label: 'Engagement' }, { label: 'Quiz Game' }]);
  });

  it('links back to the section on nested pages', () => {
    expect(breadcrumbsFor('/admin/forms/new')).toEqual([
      { label: 'Engagement' },
      { label: 'Forms', to: '/admin/forms' },
      { label: 'New form' },
    ]);
    expect(breadcrumbsFor('/admin/forms/123/edit').at(-1)).toEqual({ label: 'Edit' });
    expect(breadcrumbsFor('/admin/forms/123').at(-1)).toEqual({ label: 'Responses' });
    expect(breadcrumbsFor('/admin/builder/9').at(-1)).toEqual({ label: 'Edit quiz' });
  });

  it('degrades for an unknown section', () => {
    expect(breadcrumbsFor('/admin/nope')).toEqual([{ label: 'Admin' }]);
  });
});

describe('pageTitleFor', () => {
  it('is the last crumb', () => {
    expect(pageTitleFor('/admin/forms/1')).toBe('Responses');
  });
});

describe('NAV_GROUPS', () => {
  it('has unique paths, each under /admin', () => {
    const paths = NAV_GROUPS.flatMap(g => g.items.map(i => i.path));
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every(p => p.startsWith('/admin/'))).toBe(true);
  });
});
