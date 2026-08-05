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
