/**
 * Performance utilities for optimization
 */

/**
 * Throttle function calls to limit frequency
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;
  
  return ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }) as T;
}

/**
 * Create a batch processor for database operations
 */
export function createBatchProcessor<T>(
  processor: (items: T[]) => Promise<void>,
  batchSize: number = 10,
  delay: number = 100
) {
  let batch: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const processBatch = async () => {
    if (batch.length === 0) return;
    
    const currentBatch = [...batch];
    batch = [];
    timeoutId = null;
    
    try {
      await processor(currentBatch);
    } catch (error) {
      console.error('Batch processing error:', error);
    }
  };

  return {
    add: (item: T) => {
      batch.push(item);
      
      if (batch.length >= batchSize) {
        // Process immediately if batch is full
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        processBatch();
      } else if (!timeoutId) {
        // Schedule processing after delay
        timeoutId = setTimeout(processBatch, delay);
      }
    },
    flush: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      return processBatch();
    }
  };
}

/**
 * Memory-efficient data cache with LRU eviction
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}