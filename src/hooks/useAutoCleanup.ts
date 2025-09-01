import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cleanupExpiredRounds } from '@/utils/cleanup';

interface AutoCleanupOptions {
  interval?: number; // minutes
  enabled?: boolean;
}

/**
 * Hook to automatically cleanup expired rounds and stuck phases
 */
export function useAutoCleanup(options: AutoCleanupOptions = {}) {
  const { interval = 5, enabled = true } = options;
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastCleanupRef = useRef<number>(0);

  const performCleanup = useCallback(async () => {
    const now = Date.now();
    
    // Prevent too frequent cleanups
    if (now - lastCleanupRef.current < 30000) { // 30 seconds minimum
      return;
    }
    
    lastCleanupRef.current = now;
    
    try {
      const success = await cleanupExpiredRounds();
      
      if (!success) {
        console.warn('Cleanup operation failed');
      }
      
      // Also run the database cleanup function
      await supabase.rpc('force_cleanup_expired_rounds');
      
    } catch (error) {
      console.error('Auto-cleanup error:', error);
    }
  }, []);

  const manualCleanup = useCallback(async () => {
    try {
      const success = await cleanupExpiredRounds();
      
      if (success) {
        toast({
          title: "Cleanup Complete",
          description: "Expired rounds have been cleaned up.",
        });
      } else {
        toast({
          title: "Cleanup Failed",
          description: "Unable to cleanup expired rounds.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Cleanup operation encountered an error.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (!enabled) return;

    // Initial cleanup after a short delay
    const initialTimeout = setTimeout(performCleanup, 5000);

    // Set up periodic cleanup
    intervalRef.current = setInterval(performCleanup, interval * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, enabled, performCleanup]);

  return {
    manualCleanup,
    isEnabled: enabled,
  };
}