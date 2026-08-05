/**
 * Client-side identifier for rows that do not exist on the server yet.
 *
 * `Math.random().toString(36).substring(2, 9)` was copy-pasted into
 * FormBuilder, FormQuizBuilder and ToastStore. It yields ~36^7 values, so
 * collisions are reachable in a long editing session — and a collision means
 * two React rows share a key, or a toast timer removes the wrong toast.
 */
export function newId(): string {
  // Available in every browser this app targets, but not in older jsdom, so
  // fall back rather than throwing in tests.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
