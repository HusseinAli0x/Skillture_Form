/**
 * The API reports a validation failure as one sentence in `error`
 * ("registration_url must be an http(s) URL"), not as a per-field map. To show
 * it beside the offending input, find which known field name the sentence is
 * about: the earliest whole-word match wins ("a workshop gallery holds at most
 * 12 images" -> gallery). Unmatched messages return null and the caller shows
 * them in the form-level banner instead.
 */

export type FieldErrors = Record<string, string>;

/**
 * @param message  the server's error string
 * @param fields   server wording -> form field key, e.g. { registration_url: 'registration_url', name: 'name_en' }
 */
export function fieldForServerMessage(message: string, fields: Record<string, string>): string | null {
  const lower = message.toLowerCase();
  let best: { index: number; field: string } | null = null;
  for (const [word, field] of Object.entries(fields)) {
    const m = new RegExp(`(^|[^a-z_])${word.toLowerCase()}([^a-z_]|$)`).exec(lower);
    if (!m) continue;
    const index = m.index + m[1].length;
    if (!best || index < best.index) best = { index, field };
  }
  return best ? best.field : null;
}

/** Capitalise the first letter so a bare server sentence reads as a message. */
export function sentence(message: string): string {
  return message ? message.charAt(0).toUpperCase() + message.slice(1) : message;
}
