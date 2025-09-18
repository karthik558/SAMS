const DEFAULT_TTL = 60_000; // 1 minute cache by default

type CacheEntry<T> = {
  value?: T;
  expiry: number;
  promise?: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

function now() {
  return Date.now();
}

export type CacheOptions = {
  ttlMs?: number;
  force?: boolean;
};

export async function getCachedValue<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions,
): Promise<T> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL;
  const current = store.get(key) as CacheEntry<T> | undefined;
  const timestamp = now();

  if (!options?.force && current) {
    if (current.promise) {
      return current.promise;
    }
    if (current.value !== undefined && current.expiry > timestamp) {
      return Promise.resolve(current.value);
    }
  }

  const pending = fetcher()
    .then((result) => {
      store.set(key, { value: result, expiry: now() + ttl });
      return result;
    })
    .catch((error) => {
      store.delete(key);
      throw error;
    });

  store.set(key, { value: current?.value, expiry: current?.expiry ?? 0, promise: pending });
  return pending;
}

export function invalidateCache(key: string) {
  store.delete(key);
}

export function invalidateCacheByPrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

export function peekCachedValue<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (entry.value === undefined) return undefined;
  if (entry.expiry <= now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function clearCache() {
  store.clear();
}
