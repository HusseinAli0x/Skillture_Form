/**
 * Long date for the public site ("12 March 2026"). -u-nu-latn keeps Western
 * digits in the Arabic locale too (ar-EG defaults to Eastern Arabic-Indic
 * numerals), matching the Western digits used in the stats — one numeral
 * convention across the site.
 */
export function formatDate(isoDate: string, locale: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** True when the ISO date (YYYY-MM-DD) is before today in the viewer's timezone. */
export function isPastDate(isoDate: string): boolean {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return isoDate < todayIso;
}
