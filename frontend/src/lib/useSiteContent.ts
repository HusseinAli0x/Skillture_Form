import { useLanguageStore, type Locale } from '../context/LanguageStore';
import { useSiteStore } from '../context/SiteStore';
import { applyOverrides, imageFor, type ImageSlot, type SiteSettings, type TextOverrides } from './siteContent';
import { siteStrings, type SiteStrings } from './siteStrings';
import { translations, type Translations } from './translations';
import { brandAssets, logoAssets } from '../components/brand/assets';

/**
 * Hooks that give components the site's wording and images with the admin's
 * edits applied. Components used to read `siteStrings[locale]` directly; they
 * call these instead, so an edit in the dashboard reaches every page.
 *
 * Merging walks the whole string table, so the result is cached per overrides
 * object: the store replaces that object when content reloads, which is also
 * what invalidates the cache.
 */

type Merged = { site?: SiteStrings; core?: Translations };
const cache = new WeakMap<TextOverrides, Partial<Record<Locale, Merged>>>();

function merged(text: TextOverrides, locale: Locale): Merged {
  let byLocale = cache.get(text);
  if (!byLocale) {
    byLocale = {};
    cache.set(text, byLocale);
  }
  let entry = byLocale[locale];
  if (!entry) {
    entry = {
      site: applyOverrides(siteStrings[locale], text[locale], 'site'),
      core: applyOverrides(translations[locale], text[locale], 'core'),
    };
    byLocale[locale] = entry;
  }
  return entry;
}

/** The public pages' strings (Our Work, Team, workshop page, homepage sections…). */
export function useSiteStrings(): SiteStrings {
  const locale = useLanguageStore(s => s.locale);
  const text = useSiteStore(s => s.text);
  return merged(text, locale).site as SiteStrings;
}

/** The core homepage and menu strings. */
export function useTranslations(): Translations {
  const locale = useLanguageStore(s => s.locale);
  const text = useSiteStore(s => s.text);
  return merged(text, locale).core as Translations;
}

/** A section photo, with the admin's replacement if there is one. */
export function useBrandAsset(key: Exclude<ImageSlot, 'logo_full' | 'logo_icon'>): string {
  const images = useSiteStore(s => s.images);
  return imageFor(images, key) || brandAssets[key];
}

/** The logo file for a variant, with the admin's replacement if there is one. */
export function useLogoSrc(variant: 'full' | 'icon'): string {
  const images = useSiteStore(s => s.images);
  return imageFor(images, variant === 'full' ? 'logo_full' : 'logo_icon') || logoAssets[variant];
}

/** Contact email and social links. */
export function useSiteSettings(): SiteSettings {
  return useSiteStore(s => s.settings);
}
