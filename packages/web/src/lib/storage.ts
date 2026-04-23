type StorageLike = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

const memoryStorage = new Map<string, string>();

const fallbackStorage: StorageLike = {
  getItem: (name) => memoryStorage.get(name) ?? null,
  setItem: (name, value) => {
    memoryStorage.set(name, value);
  },
  removeItem: (name) => {
    memoryStorage.delete(name);
  },
};

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = '__sm_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

export function getSafeStorage(): StorageLike {
  return getBrowserStorage() ?? fallbackStorage;
}

export function safeGetItem(name: string): string | null {
  return getSafeStorage().getItem(name);
}

export function safeSetItem(name: string, value: string): void {
  getSafeStorage().setItem(name, value);
}

export function safeRemoveItem(name: string): void {
  getSafeStorage().removeItem(name);
}
