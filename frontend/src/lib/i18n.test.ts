import { describe, expect, it } from 'vitest';
import { localized, optionLabel, toLocalized } from './i18n';

// Every field the API returns for a title, label or question is a JSONB map.
// Pages used to unpack that inline with a different fallback chain each, and
// one forgot entirely and rendered "[object Object]".

describe('localized', () => {
  it('prefers the requested language', () => {
    expect(localized({ en: 'Name', ar: 'الاسم' }, '', 'ar')).toBe('الاسم');
  });

  it('falls back to English when the requested language is missing', () => {
    expect(localized({ en: 'Name' }, '', 'ar')).toBe('Name');
  });

  it('falls back to any translation present', () => {
    // An Arabic-only form used to render blank labels.
    expect(localized({ ar: 'الاسم' })).toBe('الاسم');
  });

  it('accepts a plain string, which older rows still hold', () => {
    expect(localized('Name')).toBe('Name');
  });

  it('returns the fallback for null, undefined and empty maps', () => {
    expect(localized(null, 'Untitled')).toBe('Untitled');
    expect(localized(undefined, 'Untitled')).toBe('Untitled');
    expect(localized({}, 'Untitled')).toBe('Untitled');
  });

  it('skips empty translations rather than returning one', () => {
    expect(localized({ en: '', ar: 'الاسم' })).toBe('الاسم');
  });

  it('never returns "[object Object]"', () => {
    expect(localized({ en: 'Name' })).not.toContain('object Object');
  });
});

describe('toLocalized', () => {
  it('wraps a string for the API', () => {
    expect(toLocalized('Name')).toEqual({ en: 'Name' });
    expect(toLocalized('الاسم', 'ar')).toEqual({ ar: 'الاسم' });
  });

  it('round-trips through localized', () => {
    expect(localized(toLocalized('Survey'))).toBe('Survey');
  });
});

describe('optionLabel', () => {
  // The builder writes {opt_0: {label: "…"}} while some readers only looked
  // for en/value, so respondents saw the raw keys opt_0, opt_1.
  it('reads every shape the builder and older rows produce', () => {
    expect(optionLabel({ label: 'Red' }, 'opt_0')).toBe('Red');
    expect(optionLabel({ value: 'Red' }, 'opt_0')).toBe('Red');
    expect(optionLabel({ en: 'Red' }, 'opt_0')).toBe('Red');
    expect(optionLabel({ ar: 'أحمر' }, 'opt_0')).toBe('أحمر');
    expect(optionLabel('Red', 'opt_0')).toBe('Red');
  });

  it('prefers label over the other keys', () => {
    expect(optionLabel({ label: 'Red', value: 'r', en: 'Rouge' }, 'opt_0')).toBe('Red');
  });

  it('falls back to the key only when there is nothing else', () => {
    expect(optionLabel(undefined, 'opt_0')).toBe('opt_0');
    expect(optionLabel({}, 'opt_0')).toBe('opt_0');
  });
});
