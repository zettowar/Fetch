import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Force the shop client into demo mode regardless of any Shopify creds in the
// developer's local .env, so shop tests are deterministic. Runs before any test
// module (and thus before shop.ts reads import.meta.env).
vi.stubEnv('VITE_SHOPIFY_DOMAIN', '');
vi.stubEnv('VITE_SHOPIFY_STOREFRONT_TOKEN', '');

// Node 22+ provides a native `localStorage` that trips jsdom's own shim when
// invoked without a storage path. Replace it with a plain in-memory store so
// components that read/write localStorage during tests don't crash.
const memoryStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } satisfies Storage;
})();
Object.defineProperty(globalThis, 'localStorage', {
  value: memoryStorage,
  writable: true,
  configurable: true,
});
