// Simple in-memory cache fallback (no Redis dependency required)
// For production with Redis, install ioredis and replace this implementation

interface CacheValue {
  value: any;
  expiry: number;
}

class MemoryCache {
  private store: Map<string, CacheValue> = new Map();

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl: number): Promise<void> {
    this.store.set(key, {
      value,
      expiry: Date.now() + (ttl * 1000),
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(pattern: string): Promise<void> {
    // Simple pattern matching (supports * wildcard at end)
    const regex = new RegExp('^' + pattern.replace('*', '.*'));
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
}

export const cache = new MemoryCache();

console.log('⚠️ Using in-memory cache (install ioredis for Redis support)');

export default null;
