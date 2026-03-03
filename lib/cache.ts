type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      return null;
    }

    return entry.value as T;
  }

  getStale<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let removed = 0;

    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }

    return removed;
  }

  clear(): void {
    this.store.clear();
  }
}

declare global {
  var __META_DASHBOARD_CACHE__: MemoryCache | undefined;
}

const cache = globalThis.__META_DASHBOARD_CACHE__ ?? new MemoryCache();

if (!globalThis.__META_DASHBOARD_CACHE__) {
  globalThis.__META_DASHBOARD_CACHE__ = cache;
}

export { cache };
