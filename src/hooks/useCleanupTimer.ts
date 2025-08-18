import { useEffect, useRef } from 'react';

interface UseCleanupTimerProps {
  callback: () => void;
  delay: number;
  dependencies?: React.DependencyList;
  enabled?: boolean;
}

/**
 * Custom hook for managing timers with automatic cleanup
 */
export function useCleanupTimer({ 
  callback, 
  delay, 
  dependencies = [], 
  enabled = true 
}: UseCleanupTimerProps) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Keep callback ref current
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      return;
    }

    // Clear existing timer
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set new timer
    intervalRef.current = setInterval(() => {
      callbackRef.current();
    }, delay);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [delay, enabled, ...dependencies]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    clear: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }
  };
}
