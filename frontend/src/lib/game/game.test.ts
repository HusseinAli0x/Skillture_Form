import { describe, expect, it, vi } from 'vitest';
import { ANSWER_STYLES, answerStyle } from './answers';
import { randomNickname } from './names';
import { isMuted, setMuted, subscribeMuted } from './sound';
import { gameStrings, pick } from './strings';

// Shape of a value: object keys recursively, functions as 'fn', arrays as the
// element shape. Two locales with the same shape cannot be missing a string.
function shape(value: unknown): unknown {
  if (typeof value === 'function') return 'fn';
  if (Array.isArray(value)) return ['array', value.length > 0];
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, shape(v)]),
    );
  }
  return typeof value;
}

describe('game strings', () => {
  it('English and Arabic define exactly the same copy', () => {
    expect(shape(gameStrings.ar)).toEqual(shape(gameStrings.en));
  });

  it('every message pool has something to say', () => {
    const pools: string[][] = [];
    const walk = (v: unknown) => {
      if (Array.isArray(v)) pools.push(v as string[]);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(gameStrings);
    expect(pools.length).toBeGreaterThan(5);
    for (const pool of pools) {
      expect(pool.length).toBeGreaterThan(1); // one line would repeat every round
      expect(pool.every(line => line.trim().length > 0)).toBe(true);
    }
  });

  it('formats counts and ranks in both languages', () => {
    expect(gameStrings.en.common.players(1)).toBe('1 player');
    expect(gameStrings.en.common.players(3)).toBe('3 players');
    expect(gameStrings.en.common.rank(1)).toBe('1st');
    expect(gameStrings.en.common.rank(2)).toBe('2nd');
    expect(gameStrings.en.common.rank(3)).toBe('3rd');
    expect(gameStrings.en.common.rank(11)).toBe('11th'); // not "11st"
    expect(gameStrings.en.common.rank(22)).toBe('22nd');
    expect(gameStrings.ar.common.players(1)).toBe('لاعب واحد');
    expect(gameStrings.ar.player.finalPlace(2)).toContain('2');
  });
});

describe('pick', () => {
  it('returns an entry from the pool', () => {
    const pool = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) expect(pool).toContain(pick(pool));
  });

  it('is deterministic for a seed, and handles negative seeds', () => {
    const pool = ['a', 'b', 'c'];
    expect(pick(pool, 4)).toBe('b');
    expect(pick(pool, -4)).toBe('b');
  });
});

describe('randomNickname', () => {
  it('builds an adjective + noun in English', () => {
    const name = randomNickname('en', () => 0);
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });

  it('builds a noun + adjective in Arabic', () => {
    const name = randomNickname('ar', () => 0);
    expect(name.split(' ')).toHaveLength(2);
    expect(name).toMatch(/[؀-ۿ]/);
  });

  it('varies, and stays within the 24-character name limit the lobby displays', () => {
    const names = new Set(Array.from({ length: 60 }, () => randomNickname('en')));
    expect(names.size).toBeGreaterThan(10);
    for (const n of names) expect(n.length).toBeLessThanOrEqual(24);
  });
});

describe('answer styles', () => {
  it('are four distinct shapes with distinct colours', () => {
    expect(ANSWER_STYLES).toHaveLength(4);
    expect(new Set(ANSWER_STYLES.map(s => s.shape)).size).toBe(4);
    expect(new Set(ANSWER_STYLES.map(s => s.hex)).size).toBe(4);
  });

  it('wrap around, including for negative indexes', () => {
    expect(answerStyle(0)).toBe(ANSWER_STYLES[0]);
    expect(answerStyle(4)).toBe(ANSWER_STYLES[0]);
    expect(answerStyle(5)).toBe(ANSWER_STYLES[1]);
    expect(answerStyle(-1)).toBe(ANSWER_STYLES[3]);
  });
});

describe('sound muting', () => {
  it('remembers the choice and tells subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMuted(listener);

    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem('skillture-game-muted')).toBe('1');
    expect(listener).toHaveBeenCalledTimes(1);

    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setMuted(true);
    expect(listener).toHaveBeenCalledTimes(2); // unsubscribed
    setMuted(false);
  });
});
