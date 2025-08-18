import { useEffect, useRef } from 'react';
import { getFeatureFlags } from '@/config/flags';

interface PollingConfig {
  interval: number; // polling interval in milliseconds
  onPoll: () => void;
}

export function useLightPolling(
  isEnabled: boolean,
  currentPhase: string,
  config: PollingConfig
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const flags = getFeatureFlags();

  useEffect(() => {
    // Only poll when:
    // 1. Light polling is enabled in flags
    // 2. Realtime UI is disabled (fallback mode)
    // 3. Component wants polling enabled
    // 4. We're in an active phase
    const shouldPoll = flags.lightPolling && 
                      !flags.realtimeUI && 
                      isEnabled && 
                      ['suggest', 'vote', 'result'].includes(currentPhase);

    if (shouldPoll) {
      intervalRef.current = setInterval(() => {
        config.onPoll();
      }, config.interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [flags.lightPolling, flags.realtimeUI, isEnabled, currentPhase, config]);
}