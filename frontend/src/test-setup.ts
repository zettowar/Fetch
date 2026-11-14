import { vi } from 'vitest';
import axios, { AxiosError } from 'axios';
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

// jsdom does not implement scrolling. ScrollToTop calls window.scrollTo on
// every route change, and jsdom answers each call with a "Not implemented"
// error on stderr.
window.scrollTo = (() => {}) as typeof window.scrollTo;

// No test talks to a real server. Anything a test does not mock used to go
// out anyway: axios through jsdom's XMLHttpRequest to its default origin
// (localhost:3000, where nothing listens — a stack trace per request on
// stderr), and fetch to the real internet (the IP-geolocation lookup).
// Failing them here, quietly and immediately, is what the app code already
// saw — a network error — without the noise or the outbound calls. Tests
// that need a response mock the API module, as they already do.
axios.defaults.adapter = (config) =>
  Promise.reject(new AxiosError('Network access is disabled in tests', 'ERR_NETWORK', config));
globalThis.fetch = (() =>
  Promise.reject(new TypeError('Network access is disabled in tests'))) as typeof fetch;
