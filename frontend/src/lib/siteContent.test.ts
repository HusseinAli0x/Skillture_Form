import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  EMPTY_CONTENT,
  IMAGE_SLOTS,
  applyOverrides,
  buildTextCatalog,
  flattenStrings,
  imageFor,
  labelOf,
  parseSiteContent,
  sectionOf,
} from './siteContent';
import { siteStrings } from './siteStrings';
import { translations } from './translations';

describe('applyOverrides', () => {
  const defaults = {
    title: 'Hello',
    nested: { cta: 'Join', list: ['one', 'two'] },
    count: 3,
    fn: (n: number) => `${n} items`,
  };

  it('returns the very same object when there is nothing to apply', () => {
    expect(applyOverrides(defaults, {}, 'site')).toBe(defaults);
    expect(applyOverrides(defaults, undefined, 'site')).toBe(defaults);
  });

  it('replaces only the strings that have an override', () => {
    const out = applyOverrides(defaults, { 'site.nested.cta': 'Sign up', 'site.nested.list.1': 'deux' }, 'site');
    expect(out.title).toBe('Hello');
    expect(out.nested.cta).toBe('Sign up');
    expect(out.nested.list).toEqual(['one', 'deux']);
  });

  it('leaves numbers and functions alone', () => {
    const out = applyOverrides(defaults, { 'site.title': 'Hi' }, 'site');
    expect(out.count).toBe(3);
    expect(out.fn(2)).toBe('2 items');
  });

  it('never mutates the defaults', () => {
    applyOverrides(defaults, { 'site.title': 'Changed' }, 'site');
    expect(defaults.title).toBe('Hello');
  });

  it('ignores overrides for keys that do not exist', () => {
    const out = applyOverrides(defaults, { 'site.gone': 'x', 'other.title': 'y' }, 'site');
    expect(out).toEqual(defaults);
  });

  it('is not fooled by keys that look like object internals', () => {
    const out = applyOverrides({ a: 'x' }, { 'site.constructor': 'boom', 'site.__proto__': 'boom' }, 'site');
    expect(out).toEqual({ a: 'x' });
  });
});

describe('flattenStrings', () => {
  it('lists string leaves with dotted paths and array indexes', () => {
    expect(flattenStrings({ a: 'x', b: { c: ['y', 'z'] }, n: 1, f: () => 'q' }, 'p')).toEqual([
      ['p.a', 'x'],
      ['p.b.c.0', 'y'],
      ['p.b.c.1', 'z'],
    ]);
  });
});

describe('parseSiteContent', () => {
  it('accepts a well-formed response and fills in default settings', () => {
    const out = parseSiteContent({
      text: { en: { 'site.home.ctaPrimary': 'Go' }, ar: {} },
      images: { hand: '/uploads/a.png' },
      settings: { contact_email: 'hi@example.com' },
    });
    expect(out.text.en['site.home.ctaPrimary']).toBe('Go');
    expect(out.images.hand).toBe('/uploads/a.png');
    expect(out.settings.contact_email).toBe('hi@example.com');
    expect(out.settings.linkedin_url).toBe(DEFAULT_SETTINGS.linkedin_url);
  });

  it.each([null, undefined, 'x', 42, [], { text: 'nope' }, { text: { en: 5 } }])('survives malformed data: %j', bad => {
    const out = parseSiteContent(bad);
    expect(out.text).toEqual({ en: {}, ar: {} });
    expect(out.settings.contact_email).toBe('skillture.course@gmail.com');
  });

  it('drops a link setting that is not http(s), keeping the default', () => {
    const out = parseSiteContent({
      settings: { linkedin_url: 'javascript:alert(1)', x_url: 'data:text/html,hi', youtube_url: 'https://youtube.com/@a', contact_email: 'a@b.co' },
    });
    expect(out.settings.linkedin_url).toBe(DEFAULT_SETTINGS.linkedin_url);
    expect(out.settings.x_url).toBe('');
    expect(out.settings.youtube_url).toBe('https://youtube.com/@a');
    expect(out.settings.contact_email).toBe('a@b.co');
  });

  it('drops non-string values', () => {
    const out = parseSiteContent({ text: { en: { a: 'ok', b: 7, c: null } }, images: { x: 1 } });
    expect(out.text.en).toEqual({ a: 'ok' });
    expect(out.images).toEqual({});
  });

  it('defaults the contact email to the organisation address', () => {
    expect(EMPTY_CONTENT.settings.contact_email).toBe('skillture.course@gmail.com');
  });
});

describe('the editable-text catalog', () => {
  const rows = buildTextCatalog();

  it('is not empty and covers both string tables', () => {
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.some(r => r.key.startsWith('site.'))).toBe(true);
    expect(rows.some(r => r.key.startsWith('core.'))).toBe(true);
  });

  // The server rejects a whole save if any key is malformed or too long, so
  // every key we can generate must pass its rule. Keep in sync with
  // siteKeyPatternShape / maxSiteKeyLen in backend/internal/server/handlers/site_handler.go.
  it('only generates keys the server accepts', () => {
    const rule = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/;
    for (const { key } of rows) {
      expect(key, key).toMatch(rule);
      expect(key.length, key).toBeLessThanOrEqual(120);
    }
  });

  it('has unique keys', () => {
    expect(new Set(rows.map(r => r.key)).size).toBe(rows.length);
  });

  it('holds only values within the server text limit', () => {
    for (const r of rows) {
      expect([...r.en].length, r.key).toBeLessThanOrEqual(5000);
      expect([...r.ar].length, r.key).toBeLessThanOrEqual(5000);
    }
  });

  it('gives the default text of both languages', () => {
    const cta = rows.find(r => r.key === 'site.home.ctaPrimary');
    expect(cta?.en).toBe(siteStrings.en.home.ctaPrimary);
    expect(cta?.ar).toBe(siteStrings.ar.home.ctaPrimary);
  });

  it('hides strings the site does not show', () => {
    expect(rows.find(r => r.key === 'core.hero.kicker')).toBeUndefined();
    expect(rows.find(r => r.key === 'core.footer.terms')).toBeUndefined();
    expect(rows.find(r => r.key === 'core.about.facts.0.value')).toBeUndefined();
    // …while the ones it does show are present.
    expect(rows.find(r => r.key === 'core.hero.title')?.ar).toBe(translations.ar.hero.title);
    expect(rows.find(r => r.key === 'core.footer.rights')).toBeDefined();
  });

  it('sends English homepage copy to the Homepage Editor', () => {
    expect(rows.find(r => r.key === 'core.hero.title')?.englishElsewhere).toBe(true);
    expect(rows.find(r => r.key === 'site.home.ctaPrimary')?.englishElsewhere).toBe(false);
  });
});

describe('labels', () => {
  it('names sections and rows readably', () => {
    expect(sectionOf('site.home.contact.errors.email')).toBe('Homepage');
    expect(sectionOf('core.hero.title')).toBe('Homepage — hero');
    expect(labelOf('site.home.contact.errors.email')).toBe('Contact › Errors › Email');
    expect(labelOf('site.home.ctaPrimary')).toBe('Cta Primary');
  });
});

describe('images', () => {
  it('knows each slot the server accepts', () => {
    expect(IMAGE_SLOTS.map(s => s.slot).sort()).toEqual(
      ['badge', 'cards', 'hand', 'logo_full', 'logo_icon', 'pins', 'poster', 'stationery'].sort(),
    );
  });

  it('prefers an uploaded file and falls back to the built-in one', () => {
    expect(imageFor({ hand: '/uploads/new.png' }, 'hand')).toBe('/uploads/new.png');
    expect(imageFor({}, 'hand')).toBe('/brand/hand.webp');
    expect(imageFor({}, 'logo_full')).toBe('/logo-full.png');
  });

  it('ignores an override that is not an uploaded file', () => {
    expect(imageFor({ hand: 'https://evil.example/x.png' }, 'hand')).toBe('/brand/hand.webp');
    expect(imageFor({ hand: 'javascript:alert(1)' }, 'hand')).toBe('/brand/hand.webp');
    expect(imageFor({ hand: '/uploads/a.png") ; background: url("//evil.example/x' }, 'hand')).toBe('/brand/hand.webp');
    expect(imageFor({ hand: '/uploads/../etc/passwd' }, 'hand')).toBe('/brand/hand.webp');
  });
});
