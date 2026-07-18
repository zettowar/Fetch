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

// jsdom has no ResizeObserver; NavBar uses one to publish the tab bar height
// as --tab-bar-h. A no-op keeps components mountable (heights are 0 in jsdom
// anyway, so there is nothing meaningful to observe).
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
