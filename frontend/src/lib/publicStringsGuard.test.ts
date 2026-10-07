import { describe, expect, it } from 'vitest';

/**
 * The public site's wording is admin-editable, which only works if every
 * public component reads it through the hooks in lib/useSiteContent.ts
 * (useSiteStrings, useTranslations, …). A component that imports the string
 * tables directly would keep showing the built-in wording after an admin edited
 * it — a silent bug no other test would notice.
 */

const sources = import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });

// Files that legitimately read the tables themselves (paths relative to src/).
const ALLOWED = new Set([
  'lib/siteStrings.ts', // defines the table
  'lib/translations.ts', // defines the table
  'lib/siteContent.ts', // builds the editor's catalog from the defaults
  'lib/useSiteContent.ts', // applies the admin's edits to the defaults
  // The English homepage copy comes from the database; the defaults are used
  // only until it loads and are the same text the editor shows.
  'pages/HomePage.tsx',
  // The English-only admin dashboard shows the built-in wording; the public
  // builder gets the editable text through useSiteStrings in useQuizText.
  'components/quiz/quizText.ts',
]);

const IMPORTS_TABLE = /from\s+['"][^'"]*\/(siteStrings|translations)['"]/;
const isTest = (path: string) => /\.test\.(ts|tsx)$/.test(path);

describe('public wording goes through the hooks', () => {
  const files = Object.entries(sources)
    // Keys are relative to this file (src/lib): "./x.ts" is in lib, "../a/x.ts" is src/a/x.ts.
    .map(([path, source]) => ({ file: path.startsWith('./') ? `lib/${path.slice(2)}` : path.replace(/^\.\.\//, ''), source }))
    .filter(({ file }) => !isTest(file));

  it('no component imports siteStrings or translations directly', () => {
    const offenders = files.filter(({ file, source }) => !ALLOWED.has(file) && IMPORTS_TABLE.test(source)).map(f => f.file);
    expect(offenders).toEqual([]);
  });

  it('actually scans the source tree', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(f => f.file === 'lib/useSiteContent.ts')).toBe(true);
  });

  it('every allow-listed file still exists (so the list cannot rot)', () => {
    const present = new Set(files.map(f => f.file));
    expect([...ALLOWED].filter(f => !present.has(f))).toEqual([]);
  });
});
