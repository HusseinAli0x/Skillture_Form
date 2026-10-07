import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHostKey, HOST_KEY_STORAGE, resetHostKeyMemory } from './hostKey';

describe('getHostKey', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHostKeyMemory();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a 43-character base64url key and stores it', () => {
    const key = getHostKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(localStorage.getItem(HOST_KEY_STORAGE)).toBe(key);
  });

  it('returns the same key on every call', () => {
    expect(getHostKey()).toBe(getHostKey());
  });

  it('reuses a valid stored key', () => {
    const stored = 'a'.repeat(43);
    localStorage.setItem(HOST_KEY_STORAGE, stored);
    expect(getHostKey()).toBe(stored);
  });

  it('replaces a stored value the server would reject', () => {
    localStorage.setItem(HOST_KEY_STORAGE, 'short');
    const key = getHostKey();
    expect(key).not.toBe('short');
    expect(key).toMatch(/^[A-Za-z0-9_-]{32,128}$/);
    expect(localStorage.getItem(HOST_KEY_STORAGE)).toBe(key);
  });

  it('generates different keys for different browsers', () => {
    const a = getHostKey();
    localStorage.clear();
    expect(getHostKey()).not.toBe(a);
  });

  it('falls back to an in-memory key when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const key = getHostKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(getHostKey()).toBe(key);
  });
});
