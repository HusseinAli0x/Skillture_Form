import { describe, expect, it, vi } from 'vitest';
import { newId } from './id';

describe('newId', () => {
  it('does not collide across a long editing session', () => {
    // The replaced implementation was Math.random().toString(36).substring(2, 9)
    // — about 36^7 values, where a collision means two React rows share a key
    // or a toast timer removes the wrong toast.
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(newId());
    expect(ids.size).toBe(10_000);
  });

  it('falls back when crypto.randomUUID is unavailable', () => {
    // Older jsdom has no randomUUID; the fallback exists so tests do not throw.
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', {});
    try {
      const id = newId();
      expect(id).toMatch(/^id-/);
      expect(newId()).not.toBe(id);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });
});
