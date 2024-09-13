import { pipe, TE } from '@that-hatter/scrapi-factory/fp';

type Item<T> = {
  readonly value: T;
  readonly ttl?: number;
  lastAccessed: number;
};

export type Cache<T> = {
  readonly defaultTtl: number;
  readonly items: Map<string, Item<T>>;
};

const prune = <T>(cache: Cache<T>, fn: (item: Item<T>) => boolean) => {
  for (const [key, item] of cache.items) {
    if (!fn(item)) cache.items.delete(key);
  }
};

const pruneExpired = <T>(cache: Cache<T>, now: number) => {
  return prune(
    cache,
    (it) => now - it.lastAccessed < (it.ttl ?? cache.defaultTtl)
  );
};

export const put =
  <T>(cache: Cache<T>) =>
  (key: string) =>
  (item: T) =>
    TE.fromIO(() => {
      const now = Date.now();
      pruneExpired(cache, now);

      cache.items.set(key, { value: item, lastAccessed: now });
    });

export const get =
  <T>(cache: Cache<T>) =>
  (key: string) =>
    pipe(
      TE.fromIO(() => {
        const now = Date.now();

        const item = cache.items.get(key);
        if (item) {
          item.lastAccessed = now;
          pruneExpired(cache, now);
          return TE.right(item.value);
        }

        pruneExpired(cache, now);
        return TE.left('Item not found');
      }),
      TE.flatten
    );

export const getMatches =
  <T>(cache: Cache<T>) =>
  (fn: (val: T) => boolean) =>
    TE.fromIO(() => {
      const now = Date.now();
      const matches: T[] = [];

      cache.items.forEach((v) => {
        if (!fn(v.value)) return;
        v.lastAccessed = now;
        matches.push(v.value);
      });

      pruneExpired(cache, now);

      // disallow modification outside
      return matches as ReadonlyArray<T>;
    });

export const uncache =
  <T>(cache: Cache<T>) =>
  (key: string) =>
    TE.fromIO(() => {
      cache.items.delete(key);

      const now = Date.now();
      pruneExpired(cache, now);
    });

export const keep =
  <T>(cache: Cache<T>) =>
  (fn: (val: T) => boolean) =>
    TE.fromIO(() => {
      prune(cache, (it) => fn(it.value));

      const now = Date.now();
      pruneExpired(cache, now);
    });

export const create = <T>(defaultTtl: number): Cache<T> => ({
  defaultTtl,
  items: new Map(),
});
