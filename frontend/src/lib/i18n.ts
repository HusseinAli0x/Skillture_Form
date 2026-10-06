/**
 * Helpers for the multilingual JSONB fields the API returns.
 *
 * Titles, labels, descriptions and question text all arrive as
 * `{"en": "...", "ar": "..."}`. Pages were each unpacking that inline with a
 * different fallback chain — `f.title?.en`, `typeof f.title === 'string' ? ...`,
 * `opt.en || opt.value || key` — and one of them forgot entirely and rendered
 * "[object Object]".
 */

export type Localized = Record<string, string> | string | null | undefined;

/** Preferred language, then English, then any other translation present. */
export function localized(value: Localized, fallback = '', lang = 'en'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value || fallback;

  const preferred = value[lang];
  if (preferred) return preferred;

  const english = value.en;
  if (english) return english;

  const first = Object.values(value).find(v => typeof v === 'string' && v !== '');
  return first ?? fallback;
}

/** Wraps a plain string for sending back to the API. */
export function toLocalized(text: string, lang = 'en'): Record<string, string> {
  return { [lang]: text };
}

/**
 * Label of a single option from a form field's `options` map.
 *
 * The builder writes `{opt_0: {label: "..."}}` while some readers only looked
 * for `en`/`value`, so users saw the raw keys `opt_0`, `opt_1` on the public
 * form. All known shapes are handled here.
 */
export function optionLabel(
  option: { label?: string; value?: string; en?: string; ar?: string } | string | undefined,
  key: string
): string {
  if (typeof option === 'string') return option || key;
  if (!option) return key;
  return option.label || option.en || option.value || option.ar || key;
}
