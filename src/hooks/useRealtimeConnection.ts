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
  const { handleError } = useErrorHandler();

  const cleanup = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
          
          // Attempt reconnection
          connectionManager.current.handleConnectionError(
            new Error(`Connection ${status.toLowerCase()}`),
            setupConnection
          ).catch((error) => {
            handleError(error, {
              operation: 'realtime connection',
              component: 'useRealtimeConnection',
              userMessage: 'Lost connection to server. Some features may not work properly.'
            });
            
            setConnectionState(prev => ({ 
              ...prev, 
              lastError: error,
              reconnectAttempts: prev.reconnectAttempts + 1
            }));
          });
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