import { describe, expect, it } from 'vitest';
import { timeAgo } from './relativeTime';

const now = new Date('2026-03-15T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('timeAgo', () => {
  it('says "just now" under a minute and for clock skew into the future', () => {
    expect(timeAgo(ago(20_000), now)).toBe('just now');
    expect(timeAgo(ago(-60_000), now)).toBe('just now');
  });

  it('counts minutes, hours and days', () => {
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5 min ago');
    expect(timeAgo(ago(3 * 3_600_000), now)).toBe('3 h ago');
    expect(timeAgo(ago(30 * 3_600_000), now)).toBe('yesterday');
    expect(timeAgo(ago(4 * 86_400_000), now)).toBe('4 days ago');
  });

  it('falls back to a calendar date after a week', () => {
    expect(timeAgo('2026-02-01T10:00:00Z', now)).toMatch(/Feb/);
  });

  it('returns an empty string for an unparseable date', () => {
    expect(timeAgo('not a date', now)).toBe('');
  });
});
