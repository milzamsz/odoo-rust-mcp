import '@testing-library/jest-dom/vitest';

const storageState = new Map<string, string>();

const storageMock: Storage = {
  get length() {
    return storageState.size;
  },
  clear() {
    storageState.clear();
  },
  getItem(key: string) {
    return storageState.has(key) ? storageState.get(key)! : null;
  },
  key(index: number) {
    return Array.from(storageState.keys())[index] ?? null;
  },
  removeItem(key: string) {
    storageState.delete(key);
  },
  setItem(key: string, value: string) {
    storageState.set(key, String(value));
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: storageMock,
  configurable: true,
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: ResizeObserverMock,
  configurable: true,
});

Object.defineProperty(window, 'visualViewport', {
  value: {
    addEventListener: () => {},
    removeEventListener: () => {},
  },
  configurable: true,
});
