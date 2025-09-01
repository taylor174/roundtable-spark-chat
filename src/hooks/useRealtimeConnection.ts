import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionManager } from '@/utils/retryLogic';
import { useErrorHandler } from './useErrorHandler';

interface ConnectionState {
  isConnected: boolean;
  reconnectAttempts: number;
  lastError?: Error;
}

export function useRealtimeConnection(tableId: string) {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    isConnected: false,
    reconnectAttempts: 0,
  });
  
  const connectionManager = useRef(new ConnectionManager());
  const channelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { handleError } = useErrorHandler();

  const cleanup = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const setupConnection = () => {
    if (!tableId) return;

    cleanup();

    const channel = supabase.channel(`table_${tableId}_connection`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        setConnectionState(prev => ({ 
          ...prev, 
          isConnected: true, 
          lastError: undefined 
        }));
        connectionManager.current.resetReconnectAttempts();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState(prev => ({ 
            ...prev, 
            isConnected: true,
            lastError: undefined 
          }));
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionState(prev => ({ 
            ...prev, 
            isConnected: false 
          }));
          
          // Implement exponential backoff for reconnection
          const backoffDelay = Math.min(1000 * Math.pow(2, connectionState.reconnectAttempts), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectionManager.current.handleConnectionError(
              new Error(`Connection ${status.toLowerCase()}`),
              setupConnection
            ).catch((error) => {
              setConnectionState(prev => ({ 
                ...prev, 
                lastError: error,
                reconnectAttempts: Math.min(prev.reconnectAttempts + 1, 5) // Reduce max attempts
              }));
            });
          }, backoffDelay);
        }
      });

    channelRef.current = channel;
  };

  useEffect(() => {
    setupConnection();
    
    // Cleanup on unmount
    return cleanup;
  }, [tableId]);

  // Manual reconnection function
  const reconnect = () => {
    connectionManager.current.resetReconnectAttempts();
    setupConnection();
  };

  return {
    ...connectionState,
    reconnect,
  };
}