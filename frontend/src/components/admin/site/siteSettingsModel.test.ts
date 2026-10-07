import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type SiteSettings } from '../../../lib/siteContent';
import {
  MAX_SETTING_LEN,
  SETTING_FIELDS,
  settingErrors,
  settingProblem,
  settingsChanged,
  settingsPayload,
} from './siteSettingsModel';

const field = (key: string) => SETTING_FIELDS.find(f => f.key === key)!;

describe('settingProblem', () => {
  it('accepts a normal email and rejects malformed ones', () => {
    expect(settingProblem(field('contact_email'), 'skillture.course@gmail.com')).toBeNull();
    expect(settingProblem(field('contact_email'), '  hi@example.com  ')).toBeNull();
    for (const bad of ['nope', 'a@b', 'a b@c.co', '@x.co']) {
      expect(settingProblem(field('contact_email'), bad), bad).not.toBeNull();
    }
  });

  it('accepts only http(s) links', () => {
    expect(settingProblem(field('linkedin_url'), 'https://www.linkedin.com/company/skillture')).toBeNull();
    expect(settingProblem(field('x_url'), 'http://x.com/skillture')).toBeNull();
    for (const bad of ['linkedin.com/company/x', 'javascript:alert(1)', 'data:text/html,hi', 'ftp://x.com', 'https://', '/relative']) {
      expect(settingProblem(field('linkedin_url'), bad), bad).not.toBeNull();
    }
  });

  it('treats empty as fine (it means reset or hide)', () => {
    for (const f of SETTING_FIELDS) {
      expect(settingProblem(f, ''), f.key).toBeNull();
      expect(settingProblem(f, '   '), f.key).toBeNull();
    }
  });

  it('rejects values over the server limit', () => {
    expect(settingProblem(field('youtube_url'), 'https://example.com/' + 'a'.repeat(MAX_SETTING_LEN))).not.toBeNull();
  });
});

describe('settingErrors', () => {
  it('lists only the fields with a problem', () => {
    const errors = settingErrors({ ...DEFAULT_SETTINGS, contact_email: 'broken', facebook_url: 'not a url' });
    expect(Object.keys(errors).sort()).toEqual(['contact_email', 'facebook_url']);
  });

  it('is clean for the defaults', () => {
    expect(settingErrors(DEFAULT_SETTINGS)).toEqual({});
  });
});

describe('settingsPayload', () => {
  it('sends every field, trimmed, including cleared ones', () => {
    const values: SiteSettings = { ...DEFAULT_SETTINGS, contact_email: '  hi@example.com ', linkedin_url: '' };
    const { settings } = settingsPayload(values);
    expect(settings.contact_email).toBe('hi@example.com');
    expect(settings.linkedin_url).toBe('');
    expect(Object.keys(settings).sort()).toEqual(SETTING_FIELDS.map(f => f.key).sort());
  });
});

describe('settingsChanged', () => {
  it('ignores whitespace-only differences', () => {
    expect(settingsChanged(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, contact_email: ` ${DEFAULT_SETTINGS.contact_email} ` })).toBe(false);
  });

  it('detects a real change', () => {
    expect(settingsChanged(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, x_url: 'https://x.com/a' })).toBe(true);
  });
});

describe('the defaults', () => {
  it('use the organisation email', () => {
    expect(DEFAULT_SETTINGS.contact_email).toBe('skillture.course@gmail.com');
    expect(field('contact_email').placeholder).toBe('skillture.course@gmail.com');
  });
});
