import type { Locale } from '../context/LanguageStore';
import { brandAssets, logoAssets } from '../components/brand/assets';
import { siteStrings } from './siteStrings';
import { translations } from './translations';

/**
 * Admin-editable site content.
 *
 * The public site's wording, images and contact links all have built-in
 * defaults in the code. An admin can change any of them from Site content in
 * the dashboard; only the changes are stored (GET /api/v1/site), so "reset to
 * default" is just removing one, and the site still renders if the request
 * fails.
 *
 * Text is addressed by the dotted path of the string in its table, prefixed
 * with the table name: `site.home.ctaPrimary`, `core.hero.title`.
 */

// ---- Wire format -----------------------------------------------------------

export type TextOverrides = Record<Locale, Record<string, string>>;

export interface SiteSettings {
  contact_email: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  x_url: string;
  youtube_url: string;
}

export interface SiteContent {
  text: TextOverrides;
  images: Record<string, string>;
  settings: SiteSettings;
}

/** What the site shows until an admin changes it. Mirrors the server's defaults. */
export const DEFAULT_SETTINGS: SiteSettings = {
  contact_email: 'skillture.course@gmail.com',
  linkedin_url: 'https://www.linkedin.com/company/skillture',
  instagram_url: '',
  facebook_url: '',
  x_url: '',
  youtube_url: '',
};

export const EMPTY_CONTENT: SiteContent = {
  text: { en: {}, ar: {} },
  images: {},
  settings: DEFAULT_SETTINGS,
};

/** Social profiles shown in the footer, in order, when a link is set. */
export const SOCIAL_LINKS: { key: keyof SiteSettings; label: string }[] = [
  { key: 'linkedin_url', label: 'LinkedIn' },
  { key: 'instagram_url', label: 'Instagram' },
  { key: 'facebook_url', label: 'Facebook' },
  { key: 'x_url', label: 'X' },
  { key: 'youtube_url', label: 'YouTube' },
];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function stringMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (isRecord(v)) {
    for (const [k, val] of Object.entries(v)) if (typeof val === 'string') out[k] = val;
  }
  return out;
}

/** Turn an untrusted API response into a safe SiteContent. Never throws. */
export function parseSiteContent(data: unknown): SiteContent {
  if (!isRecord(data)) return EMPTY_CONTENT;
  const text = isRecord(data.text) ? data.text : {};
  const settings = stringMap(data.settings);
  // The server only stores http(s) links, but these become href values on every
  // public page, so a link with any other scheme is dropped here as well.
  for (const key of Object.keys(settings)) {
    if (key.endsWith('_url') && settings[key] !== '' && !/^https?:\/\//i.test(settings[key])) delete settings[key];
  }
  return {
    text: { en: stringMap(text.en), ar: stringMap(text.ar) },
    images: stringMap(data.images),
    settings: { ...DEFAULT_SETTINGS, ...settings },
  };
}

// ---- Text overrides --------------------------------------------------------

/**
 * Copy of `defaults` with every string that has an override replaced.
 * Walks objects and arrays; numbers and functions (such as `delivered(n)`)
 * are left alone — they are not editable text. With no overrides the very same
 * object is returned, so callers can rely on referential equality.
 */
export function applyOverrides<T>(defaults: T, overrides: Record<string, string> | undefined, prefix: string): T {
  if (!overrides || Object.keys(overrides).length === 0) return defaults;
  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === 'string') return Object.prototype.hasOwnProperty.call(overrides, path) ? overrides[path] : node;
    if (Array.isArray(node)) return node.map((v, i) => walk(v, `${path}.${i}`));
    if (isRecord(node)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) out[k] = walk(v, `${path}.${k}`);
      return out;
    }
    return node;
  };
  return walk(defaults, prefix) as T;
}

/** Every string leaf of a table as [dotted key, value]. */
export function flattenStrings(node: unknown, prefix: string): [string, string][] {
  if (typeof node === 'string') return [[prefix, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => flattenStrings(v, `${prefix}.${i}`));
  if (isRecord(node)) return Object.entries(node).flatMap(([k, v]) => flattenStrings(v, `${prefix}.${k}`));
  return [];
}

// ---- The editable-text catalog ---------------------------------------------

/**
 * Strings that exist in the tables but are not shown anywhere on the site
 * today. Listing them in the editor would offer fields that do nothing.
 */
const UNUSED_KEY = [
  /^core\.hero\.(kicker|ctaPrimary|ctaSecondary)$/,
  /^core\.about\.(kicker|facts\.)/,
  /^core\.offer\.(kicker|title)$/,
  /^core\.offer\.pillars\.\d+\.points/,
  /^core\.nav\.(about|offer|workshops)$/,
  /^core\.footer\.(privacy|terms)$/,
  // The homepage contact form and workshop list read site.* strings; of these
  // two tables only the LinkedIn label is still shown.
  /^core\.contact\.(?!linkedinLabel$)/,
  /^core\.workshops\./,
  /^site\.(ourWork\.(kicker|impact\.upcoming)|team\.kicker|home\.upcoming\.details|workshop\.register|host\.errors\.generic)$/,
];

/**
 * The English homepage hero/about/offer text is edited in the Homepage Editor
 * (it lives in the database); only the Arabic version is edited as site text.
 */
const ENGLISH_FROM_HOMEPAGE_EDITOR = [/^core\.(hero|about|offer)\./];

export interface TextRow {
  key: string;
  en: string;
  ar: string;
  /** English is managed in the Homepage Editor, not here. */
  englishElsewhere: boolean;
}

/** The default text of every editable string, in both languages. */
export function buildTextCatalog(): TextRow[] {
  const tables: [string, Record<Locale, unknown>][] = [
    ['site', siteStrings],
    ['core', translations],
  ];
  const rows: TextRow[] = [];
  for (const [prefix, table] of tables) {
    const en = new Map(flattenStrings(table.en, prefix));
    const ar = new Map(flattenStrings(table.ar, prefix));
    for (const [key, enValue] of en) {
      if (!ar.has(key) || UNUSED_KEY.some(re => re.test(key))) continue;
      rows.push({
        key,
        en: enValue,
        ar: ar.get(key) ?? '',
        englishElsewhere: ENGLISH_FROM_HOMEPAGE_EDITOR.some(re => re.test(key)),
      });
    }
  }
  return rows;
}

const SECTION_LABELS: Record<string, string> = {
  'site.common': 'Shared labels',
  'site.nav': 'Menu',
  'site.tracks': 'Workshop tracks',
  'site.home': 'Homepage',
  'site.ourWork': 'Our Work page',
  'site.team': 'Team page',
  'site.workshop': 'Workshop page',
  'site.host': 'Host a game (visitors\' game builder)',
  'core.nav': 'Menu',
  'core.hero': 'Homepage — hero',
  'core.about': 'Homepage — about',
  'core.offer': 'Homepage — what we offer',
  'core.workshops': 'Homepage — upcoming workshops',
  'core.contact': 'Homepage — contact',
  'core.footer': 'Footer',
};

/** The order sections are listed in: the homepage first, then shared pieces, then pages. */
const SECTION_ORDER = [
  'Homepage',
  'Homepage — hero',
  'Homepage — about',
  'Homepage — what we offer',
  'Homepage — upcoming workshops',
  'Homepage — contact',
  'Menu',
  'Footer',
  'Shared labels',
  'Our Work page',
  'Team page',
  'Workshop page',
  'Workshop tracks',
  "Host a game (visitors' game builder)",
];

/** Position of a section in the editor; sections not listed go last. */
export function sectionRank(title: string): number {
  const i = SECTION_ORDER.indexOf(title);
  return i === -1 ? SECTION_ORDER.length : i;
}

/** Section heading for a key: the longest matching prefix, else its first two segments. */
export function sectionOf(key: string): string {
  const parts = key.split('.');
  const two = parts.slice(0, 2).join('.');
  return SECTION_LABELS[two] ?? humanize(two);
}

/** `home.contact.errors.email` -> "Contact › Errors › Email". */
export function labelOf(key: string): string {
  const parts = key.split('.').slice(2);
  return (parts.length ? parts : key.split('.').slice(1)).map(humanize).join(' › ');
}

function humanize(segment: string): string {
  const spaced = segment.replace(/[._]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---- Images ----------------------------------------------------------------

export type ImageSlot = 'logo_full' | 'logo_icon' | 'hand' | 'badge' | 'pins' | 'cards' | 'stationery' | 'poster';

export interface ImageSlotInfo {
  slot: ImageSlot;
  label: string;
  where: string;
  /** Guidance shown next to the upload. */
  hint: string;
  default: string;
  /** Tailwind aspect class for the preview frame. */
  aspectClass: string;
  /** Logos are shown in one colour and must not be cropped in the preview. */
  isLogo: boolean;
}

export const IMAGE_SLOTS: ImageSlotInfo[] = [
  {
    slot: 'logo_full',
    label: 'Logo — wide',
    where: 'Header and footer of every public page',
    hint: 'Transparent PNG, roughly 5 times wider than tall. It is shown in a single colour.',
    default: logoAssets.full,
    aspectClass: 'aspect-[5/1]',
    isLogo: true,
  },
  {
    slot: 'logo_icon',
    label: 'Logo — mark',
    where: 'Small spaces: game screens, the admin sidebar, the sign-in page',
    hint: 'Transparent PNG, roughly square. It is shown in a single colour.',
    default: logoAssets.icon,
    aspectClass: 'aspect-square',
    isLogo: true,
  },
  {
    slot: 'hand',
    label: 'Homepage hero photo',
    where: 'Top of the homepage, beside the join-game box',
    hint: 'Landscape photo, about 3:2.',
    default: brandAssets.hand,
    aspectClass: 'aspect-[3/2]',
    isLogo: false,
  },
  {
    slot: 'badge',
    label: 'Participants section photo',
    where: 'Homepage, "for participants" section',
    hint: 'Landscape photo, 16:9.',
    default: brandAssets.badge,
    aspectClass: 'aspect-video',
    isLogo: false,
  },
  {
    slot: 'pins',
    label: 'Contact section photo',
    where: 'Homepage, next to the contact form',
    hint: 'Landscape photo, 16:9.',
    default: brandAssets.pins,
    aspectClass: 'aspect-video',
    isLogo: false,
  },
  {
    slot: 'cards',
    label: 'Our Work photo',
    where: 'Our Work page, call-to-action band',
    hint: 'Landscape photo, 16:9.',
    default: brandAssets.cards,
    aspectClass: 'aspect-video',
    isLogo: false,
  },
  {
    slot: 'stationery',
    label: 'Team page photo',
    where: 'Team page, "join us" band',
    hint: 'Landscape photo, 16:9.',
    default: brandAssets.stationery,
    aspectClass: 'aspect-video',
    isLogo: false,
  },
  {
    slot: 'poster',
    label: 'Sign-in poster',
    where: 'Admin sign-in page',
    hint: 'Portrait image, 3:4.',
    default: brandAssets.poster,
    aspectClass: 'aspect-[3/4]',
    isLogo: false,
  },
];

/** The path to show for a slot: the admin's image, else the built-in one. */
export function imageFor(images: Record<string, string>, slot: ImageSlot): string {
  const override = images[slot];
  // Same shape the server accepts: plain filename characters only, so the path
  // is safe in a src attribute and inside a CSS url("…").
  if (override && /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(override) && !override.includes('..')) return override;
  return IMAGE_SLOTS.find(s => s.slot === slot)?.default ?? '';
}
