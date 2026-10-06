import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, isPastDate } from './formatDate';

describe('formatDate', () => {
  it('formats a long English date', () => {
    expect(formatDate('2026-03-14', 'en')).toBe('March 14, 2026');
  });

  it('keeps Western digits in Arabic, matching the rest of the site', () => {
    const out = formatDate('2026-03-14', 'ar');
    expect(out).toMatch(/14/);
    expect(out).toMatch(/2026/);
    expect(out).not.toMatch(/[٠-٩]/); // no Eastern Arabic-Indic digits
  });

  it('returns the input unchanged when it is not a date', () => {
    expect(formatDate('not-a-date', 'en')).toBe('not-a-date');
  });
});

describe('isPastDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats earlier days as past and today or later as not past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0)); // 15 June 2026, local time

    expect(isPastDate('2026-06-14')).toBe(true);
    expect(isPastDate('2026-06-15')).toBe(false); // today is not yet "past"
    expect(isPastDate('2026-06-16')).toBe(false);
  });

  it('compares across month and year boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 30, 0));

    expect(isPastDate('2025-12-31')).toBe(true);
    expect(isPastDate('2026-01-01')).toBe(false);
  });
});
