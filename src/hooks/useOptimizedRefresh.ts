import { useCallback, useRef } from 'react';

interface RefreshOptions {
  immediate?: boolean;
  delay?: number;
}

/**
 * Optimized refresh hook that prevents duplicate calls and provides smooth UX
 */
export function useOptimizedRefresh(refreshCallback: () => void | Promise<void>) {
  const isRefreshing = useRef(false);
  const lastRefreshTime = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const refresh = useCallback(async (options: RefreshOptions = {}) => {
    const { immediate = false, delay = 100 } = options;
    const now = Date.now();
    
    // Prevent rapid successive calls
    if (!immediate && (now - lastRefreshTime.current) < 1000) {
      return;
    }

    // Clear any pending refresh
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const performRefresh = async () => {
      if (isRefreshing.current) return;
      
      isRefreshing.current = true;
      lastRefreshTime.current = Date.now();
      
      try {
        await refreshCallback();
      } catch (error) {
        console.error('Refresh error:', error);
      } finally {
        isRefreshing.current = false;
      }
    };

    if (immediate) {
      await performRefresh();
    } else {
      timeoutRef.current = setTimeout(performRefresh, delay);
    }
  }, [refreshCallback]);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return { refresh, cleanup, isRefreshing: () => isRefreshing.current };
}