import type { ChipTone } from './StatusChip';

/**
 * Chip tone for a form or quiz status. Both enums are int16 with the same
 * shape: 0 = draft, 1 = live to the audience, 2 = finished (closed / archived).
 */
export function statusTone(status: number | undefined): ChipTone {
  if (status === 1) return 'brand';
  if (status === 2) return 'neutral';
  return 'warning';
}

/** Index to focus after an arrow/Home/End key, wrapping at the ends. */
export function nextTabIndex(key: string, current: number, length: number): number | null {
  if (length === 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (current + 1) % length;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (current - 1 + length) % length;
    case 'Home':
      return 0;
    case 'End':
      return length - 1;
    default:
      return null;
  }
}
