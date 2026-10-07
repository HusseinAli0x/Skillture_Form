import type { SiteSettings } from '../../../lib/siteContent';
import { DEFAULT_SETTINGS } from '../../../lib/siteContent';

/**
 * Logic behind Site content → Contact & links, free of React.
 *
 * Mirrors the server's rules (backend site_handler.go): the email must look
 * like an email, every link must be http(s) — they become href values on the
 * public site, so a `javascript:` link must never get through — and an empty
 * value means "no link" (or, for the email, the built-in default).
 */

export type SettingKey = keyof SiteSettings;

export interface SettingField {
  key: SettingKey;
  label: string;
  hint: string;
  placeholder: string;
  kind: 'email' | 'url';
}

export const SETTING_FIELDS: SettingField[] = [
  {
    key: 'contact_email',
    label: 'Contact email',
    hint: 'Shown on the homepage and in the footer as a "write to us" link. Leave empty to use the default.',
    placeholder: DEFAULT_SETTINGS.contact_email,
    kind: 'email',
  },
  {
    key: 'linkedin_url',
    label: 'LinkedIn',
    hint: 'Link to your LinkedIn page. Leave empty to hide it.',
    placeholder: 'https://www.linkedin.com/company/…',
    kind: 'url',
  },
  {
    key: 'instagram_url',
    label: 'Instagram',
    hint: 'Link to your Instagram profile. Leave empty to hide it.',
    placeholder: 'https://www.instagram.com/…',
    kind: 'url',
  },
  {
    key: 'facebook_url',
    label: 'Facebook',
    hint: 'Link to your Facebook page. Leave empty to hide it.',
    placeholder: 'https://www.facebook.com/…',
    kind: 'url',
  },
  {
    key: 'x_url',
    label: 'X (Twitter)',
    hint: 'Link to your X profile. Leave empty to hide it.',
    placeholder: 'https://x.com/…',
    kind: 'url',
  },
  {
    key: 'youtube_url',
    label: 'YouTube',
    hint: 'Link to your YouTube channel. Leave empty to hide it.',
    placeholder: 'https://www.youtube.com/@…',
    kind: 'url',
  },
];

export const MAX_SETTING_LEN = 300;

// Same shape check as the server (contact_handler.go / site_handler.go).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Plain-language problem with one value, or null when it is fine (or empty). */
export function settingProblem(field: SettingField, raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  if (value.length > MAX_SETTING_LEN) return `Keep this under ${MAX_SETTING_LEN} characters.`;
  if (field.kind === 'email') return EMAIL.test(value) ? null : 'Enter a valid email address, like name@example.com.';
  try {
    const url = new URL(value);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.host) return null;
  } catch {
    // falls through to the message below
  }
  return 'Enter a full link starting with https://';
}

export type SettingErrors = Partial<Record<SettingKey, string>>;

export function settingErrors(values: SiteSettings): SettingErrors {
  const errors: SettingErrors = {};
  for (const field of SETTING_FIELDS) {
    const problem = settingProblem(field, values[field.key]);
    if (problem) errors[field.key] = problem;
  }
  return errors;
}

/** The request body: every field, trimmed. An empty string resets or hides it. */
export function settingsPayload(values: SiteSettings): { settings: Record<SettingKey, string> } {
  const settings = {} as Record<SettingKey, string>;
  for (const field of SETTING_FIELDS) settings[field.key] = values[field.key].trim();
  return { settings };
}

/** True when any field differs from what is saved (ignoring surrounding spaces). */
export function settingsChanged(saved: SiteSettings, values: SiteSettings): boolean {
  return SETTING_FIELDS.some(f => saved[f.key].trim() !== values[f.key].trim());
}
