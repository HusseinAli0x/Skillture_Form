/**
 * The anonymous host identity.
 *
 * Anyone can create and host a quiz without an account. The browser keeps a
 * random key and sends it as `X-Host-Key` on every API request; the server
 * scopes a visitor's quizzes and sessions to it. It is a capability, not a
 * login: whoever holds the key can manage those games, so it lives only in
 * this browser's localStorage and is never put in a URL.
 */

export const HOST_KEY_STORAGE = 'skillture.hostKey';

/** 32 random bytes as base64url is 43 characters; the server accepts 32 to 128. */
const KEY_BYTES = 32;
const KEY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

let memoryKey: string | null = null;

function randomKey(): string {
  const bytes = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * This browser's host key, created on first use.
 *
 * Storage can be blocked (private windows, strict privacy settings); the key
 * then lives in memory for the session, so hosting still works until the tab
 * closes. A stored value that is not a valid key is replaced.
 */
export function getHostKey(): string {
  try {
    const stored = localStorage.getItem(HOST_KEY_STORAGE);
    if (stored && KEY_PATTERN.test(stored)) return stored;
    const key = memoryKey ?? randomKey();
    localStorage.setItem(HOST_KEY_STORAGE, key);
    memoryKey = null;
    return key;
  } catch {
    memoryKey ??= randomKey();
    return memoryKey;
  }
}

/** Test hook: forget the in-memory fallback. */
export function resetHostKeyMemory(): void {
  memoryKey = null;
}
