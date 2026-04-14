import '@testing-library/jest-dom';

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
