import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ConnectionQuality {
  level: 'excellent' | 'good' | 'poor' | 'disconnected';
  latency: number;
  lastCheck: Date;
  warnings: string[];
}

export function useConnectionQuality() {
  const [quality, setQuality] = useState<ConnectionQuality>({
    level: 'excellent',
    latency: 0,
    lastCheck: new Date(),
    warnings: []
  });
  const { toast } = useToast();

  const checkConnection = useCallback(async () => {
    const start = Date.now();
    const warnings: string[] = [];

    try {
      // Use a small, fast endpoint to test connection
      const response = await fetch('/favicon.png', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = Date.now() - start;
      
      let level: ConnectionQuality['level'] = 'excellent';
      
      if (!response.ok) {
        level = 'disconnected';
        warnings.push('Cannot reach server');
      } else if (latency > 2000) {
        level = 'poor';
        warnings.push('High latency detected');
      } else if (latency > 500) {
        level = 'good';
        warnings.push('Moderate latency');
      }

      // Check if navigator is online
      if (!navigator.onLine) {
        level = 'disconnected';
        warnings.push('Device offline');
      }

      const newQuality: ConnectionQuality = {
        level,
        latency,
        lastCheck: new Date(),
        warnings
      };

      setQuality(prev => {
        // Show toast if quality degraded significantly
        if (prev.level === 'excellent' && level === 'poor') {
          toast({
            title: "Connection Quality Warning",
            description: "Your connection seems slow. Game synchronization may be affected.",
            variant: "default"
          });
        } else if (prev.level !== 'disconnected' && level === 'disconnected') {
          toast({
            title: "Connection Lost",
            description: "You appear to be disconnected. Attempting to reconnect...",
            variant: "destructive"
          });
        }

        return newQuality;
      });

    } catch (error) {
      // Connection quality check failed silently
      setQuality({
        level: 'disconnected',
        latency: 0,
        lastCheck: new Date(),
        warnings: ['Connection check failed']
      });
    }
  }, [toast]);

  useEffect(() => {
    checkConnection();
    
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    
    // Listen for online/offline events
    const handleOnline = () => checkConnection();
    const handleOffline = () => setQuality(prev => ({
      ...prev,
      level: 'disconnected',
      warnings: ['Device offline']
    }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return { quality, checkConnection };
}