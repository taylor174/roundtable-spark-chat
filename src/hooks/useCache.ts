import { useRef, useCallback } from 'react';
import { LRUCache } from '@/utils/performance';

/**
 * Hook for caching expensive computations or API results
 */
export function useCache<K, V>(maxSize: number = 50) {
  const cacheRef = useRef(new LRUCache<K, V>(maxSize));

  const get = useCallback((key: K): V | undefined => {
    return cacheRef.current.get(key);
  }, []);

  const set = useCallback((key: K, value: V): void => {
    cacheRef.current.set(key, value);
  }, []);

  const clear = useCallback((): void => {
    cacheRef.current.clear();
  }, []);

  const size = useCallback((): number => {
    return cacheRef.current.size();
  }, []);

  return { get, set, clear, size };
}

/**
 * Hook for memoizing expensive computations with caching
 */
export function useMemoizedComputation<T, Args extends any[]>(
  computeFn: (...args: Args) => T,
  keyFn: (...args: Args) => string,
  maxCacheSize: number = 20
) {
  const cache = useCache<string, T>(maxCacheSize);

  return useCallback((...args: Args): T => {
    const key = keyFn(...args);
    const cached = cache.get(key);
    
    if (cached !== undefined) {
      return cached;
    }

    const result = computeFn(...args);
    cache.set(key, result);
    return result;
  }, [cache, computeFn, keyFn]);
}