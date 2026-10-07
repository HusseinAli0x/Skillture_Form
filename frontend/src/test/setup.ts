import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not unmount between tests on its own, so without this a query
// like getByRole would match elements left behind by an earlier test.
afterEach(cleanup);

// Node's own localStorage is gated behind --localstorage-file and resolves to
// undefined, which shadows the jsdom implementation. AuthStore reads it at
// module scope, so without this any test that imports the store throws on
// import rather than failing an assertion.
if (!globalThis.localStorage) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

// jsdom implements neither. HomePage's scroll-journey effect (lib/
// scrollJourney.ts) calls both unconditionally on mount, so any test that
// renders it — including the App routing smoke test — would throw on mount
// without these.
if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// A plain-object stand-in rather than `implements IntersectionObserver` —
// that interface has picked up new required members across TS/DOM-lib
// versions (e.g. scrollMargin), and this only needs to satisfy `new
// IntersectionObserver(cb, opts)` at the two call sites that use it.
if (!globalThis.IntersectionObserver) {
  function NoopIntersectionObserver() {
    return { observe() {}, unobserve() {}, disconnect() {}, takeRecords: () => [] };
  }
  globalThis.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver;
}
