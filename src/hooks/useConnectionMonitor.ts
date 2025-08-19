import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastSeen?: Date;
  quality: 'good' | 'poor' | 'offline';
}

export function useConnectionMonitor() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator.onLine,
    isConnected: true,
    quality: navigator.onLine ? 'good' : 'offline'
  });
  
  const { toast } = useToast();

  useEffect(() => {
    let pingInterval: NodeJS.Timeout;
    let lastToastTime = 0;

    const updateConnectionQuality = (responseTime: number) => {
      const quality: ConnectionStatus['quality'] = 
        responseTime < 1000 ? 'good' : 
        responseTime < 3000 ? 'poor' : 'offline';
      
      setStatus(prev => ({
        ...prev,
        quality,
        isConnected: quality !== 'offline',
        lastSeen: new Date()
      }));
    };

    const checkConnection = async () => {
      if (!navigator.onLine) {
        setStatus(prev => ({ ...prev, quality: 'offline', isConnected: false }));
        return;
      }

      const startTime = Date.now();
      try {
        // Use a simple fetch to check connectivity
        const response = await fetch('/favicon.png', { 
          method: 'HEAD',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          const responseTime = Date.now() - startTime;
          updateConnectionQuality(responseTime);
        } else {
          throw new Error('Network response not ok');
        }
      } catch (error) {
        setStatus(prev => ({ 
          ...prev, 
          quality: 'offline', 
          isConnected: false 
        }));
      }
    };

    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      
      // Show reconnection toast (debounced)
      const now = Date.now();
      if (now - lastToastTime > 5000) {
        toast({
          title: "Back Online",
          description: "Connection restored. Syncing data...",
        });
        lastToastTime = now;
      }
      
      checkConnection();
    };

    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false, 
        isConnected: false, 
        quality: 'offline' 
      }));
      
      // Show offline toast (debounced)
      const now = Date.now();
      if (now - lastToastTime > 5000) {
        toast({
          title: "Connection Lost",
          description: "You're offline. Some features may not work.",
          variant: "destructive",
        });
        lastToastTime = now;
      }
    };

    // Set up event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start periodic connection checking
    pingInterval = setInterval(checkConnection, 10000); // Check every 10 seconds
    
    // Initial check
    checkConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, [toast]);

  return status;
}