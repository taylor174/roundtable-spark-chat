import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getFeatureFlags } from '@/config/flags';

interface WatchdogConfig {
  staleThreshold: number; // seconds without updates before considered stale
  panicThreshold: number; // seconds before showing panic options
  onStaleConnection: () => void;
  onPanicMode: () => void;
}

export function useConnectionWatchdog(
  isActive: boolean,
  currentPhase: string,
  config: WatchdogConfig
) {
  const { toast } = useToast();
  const lastUpdateRef = useRef<number>(Date.now());
  const [isStale, setIsStale] = useState(false);
  const [isPanicMode, setIsPanicMode] = useState(false);
  const flags = getFeatureFlags();

  // Reset watchdog when new data arrives
  const markActive = () => {
    lastUpdateRef.current = Date.now();
    if (isStale) {
      setIsStale(false);
      setIsPanicMode(false);
    }
  };

  useEffect(() => {
    if (!flags.connectionWatchdog || !isActive) {
      return;
    }

    // Only monitor during active phases
    if (!['suggest', 'vote'].includes(currentPhase)) {
      return;
    }

    const interval = setInterval(() => {
      const timeSinceLastUpdate = (Date.now() - lastUpdateRef.current) / 1000;

      if (timeSinceLastUpdate > config.panicThreshold && !isPanicMode) {
        setIsPanicMode(true);
        config.onPanicMode();
        
        toast({
          title: "Connection Issues Detected",
          description: "No updates received. Use the Panic Refresh button if needed.",
          variant: "destructive",
          duration: 10000,
        });
      } else if (timeSinceLastUpdate > config.staleThreshold && !isStale) {
        setIsStale(true);
        config.onStaleConnection();
        
        toast({
          title: "Connection Stale",
          description: "Attempting to refresh data...",
          variant: "destructive",
          duration: 5000,
        });
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [isActive, currentPhase, config, isStale, isPanicMode, toast, flags.connectionWatchdog]);

  return {
    markActive,
    isStale,
    isPanicMode,
  };
}