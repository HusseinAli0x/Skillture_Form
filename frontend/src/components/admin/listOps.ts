/** Pure helpers for reordering lists in the admin editors. */

/** A copy of `list` with the item at `from` moved to `to` (both clamped). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/**
 * After reordering a list whose items carry a numeric `sort_order`, the
 * changes that need saving: every item whose position no longer equals its
 * stored order. Orders are renumbered 0..n-1, which also untangles ties (a
 * freshly seeded group is often all zeros, where "move up" would otherwise do
 * nothing visible).
 */
export function renumber<T extends { id: string; sort_order: number }>(
  ordered: readonly T[]
): { id: string; sort_order: number }[] {
  return ordered.flatMap((item, index) => (item.sort_order === index ? [] : [{ id: item.id, sort_order: index }]));
}
