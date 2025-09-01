import { useEffect, useRef, useState } from 'react';
import { logger } from '@/utils/logger';

/**
 * Advanced performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCountRef = useRef(0);
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0
  });

  useEffect(() => {
    const startTime = performance.now();
    renderCountRef.current += 1;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setMetrics(prev => ({
        renderCount: renderCountRef.current,
        lastRenderTime: renderTime,
        averageRenderTime: (prev.averageRenderTime * (renderCountRef.current - 1) + renderTime) / renderCountRef.current
      }));

      // Log performance issues in development
      if (renderTime > 16) {
        logger.warn(`Slow render detected: ${renderTime.toFixed(2)}ms`, { renderTime }, componentName);
      }
    };
  });

  return metrics;
}

/**
 * Hook to detect memory leaks from unmounted components
 */
export function useMemoryLeakDetection(componentName: string) {
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetState = (setter: Function) => {
    return (...args: any[]) => {
      if (mountedRef.current) {
        setter(...args);
      } else {
        logger.warn(`Attempted state update on unmounted component`, null, componentName);
      }
    };
  };

  return { isMounted: () => mountedRef.current, safeSetState };
}

/**
 * Hook for monitoring network requests and their performance
 */
export function useNetworkMonitor() {
  const [networkStats, setNetworkStats] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    isOnline: navigator.onLine
  });

  useEffect(() => {
    const handleOnline = () => setNetworkStats(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setNetworkStats(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const trackRequest = (responseTime: number, success: boolean) => {
    setNetworkStats(prev => {
      const newTotalRequests = prev.totalRequests + 1;
      const newSuccessful = success ? prev.successfulRequests + 1 : prev.successfulRequests;
      const newFailed = success ? prev.failedRequests : prev.failedRequests + 1;
      const newAverageResponseTime = (prev.averageResponseTime * prev.totalRequests + responseTime) / newTotalRequests;

      return {
        totalRequests: newTotalRequests,
        successfulRequests: newSuccessful,
        failedRequests: newFailed,
        averageResponseTime: newAverageResponseTime,
        isOnline: prev.isOnline
      };
    });
  };

  return { networkStats, trackRequest };
}

/**
 * Hook for efficient bundle size monitoring
 */
export function useBundleAnalytics() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Report bundle metrics
      const bundleInfo = {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      };

      logger.debug('Bundle Analytics', bundleInfo);
    }
  }, []);
}