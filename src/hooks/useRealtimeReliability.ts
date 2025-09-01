import { useEffect, useRef, useCallback, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface EventBuffer {
  sequenceNumber: number;
  timestamp: number;
  event: any;
  processed: boolean;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastHeartbeat: number;
  missedHeartbeats: number;
  reconnectAttempts: number;
}

export function useRealtimeReliability(tableId: string | null) {
  const eventBufferRef = useRef<Map<string, EventBuffer>>(new Map());
  const sequenceRef = useRef(0);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    isHealthy: true,
    lastHeartbeat: Date.now(),
    missedHeartbeats: 0,
    reconnectAttempts: 0
  });

  // Process buffered events in order
  const processEventBuffer = useCallback(() => {
    const events = Array.from(eventBufferRef.current.values())
      .filter(event => !event.processed)
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber);

    events.forEach(eventBuffer => {
      try {
        // Process the event (this would be handled by the calling component)
        console.log('📦 Processing buffered event:', eventBuffer.event);
        eventBuffer.processed = true;
      } catch (error) {
        console.error('❌ Error processing buffered event:', error);
      }
    });

    // Clean up old processed events (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 300000;
    for (const [key, event] of eventBufferRef.current.entries()) {
      if (event.processed && event.timestamp < fiveMinutesAgo) {
        eventBufferRef.current.delete(key);
      }
    }
  }, []);

  // Add event to buffer with sequence number
  const bufferEvent = useCallback((event: any, eventType: string) => {
    const sequence = sequenceRef.current++;
    const eventId = `${eventType}_${sequence}_${Date.now()}`;
    
    eventBufferRef.current.set(eventId, {
      sequenceNumber: sequence,
      timestamp: Date.now(),
      event,
      processed: false
    });

    // Process buffer immediately for real-time responsiveness
    setTimeout(processEventBuffer, 0);
  }, [processEventBuffer]);

  // Heartbeat mechanism to detect connection issues
  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    heartbeatRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastHeartbeat = now - connectionHealth.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > 30000) { // 30 seconds threshold
        setConnectionHealth(prev => ({
          ...prev,
          isHealthy: false,
          missedHeartbeats: prev.missedHeartbeats + 1
        }));

        // Attempt reconnection after multiple missed heartbeats
        if (connectionHealth.missedHeartbeats >= 3) {
          console.log('💔 Connection unhealthy, attempting recovery');
          attemptReconnection();
        }
      } else {
        setConnectionHealth(prev => ({
          ...prev,
          isHealthy: true,
          missedHeartbeats: 0,
          lastHeartbeat: now
        }));
      }
    }, 10000); // Check every 10 seconds
  }, [connectionHealth]);

  // Attempt to reconnect the realtime channel
  const attemptReconnection = useCallback(async () => {
    if (!tableId) return;

    console.log('🔄 Attempting realtime reconnection...');
    
    setConnectionHealth(prev => ({
      ...prev,
      reconnectAttempts: prev.reconnectAttempts + 1
    }));

    try {
      // Remove existing channel
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      // Create new channel with enhanced configuration
      const channel = supabase.channel(`table_${tableId}_enhanced`, {
        config: {
          presence: { key: tableId },
          broadcast: { self: true, ack: true }
        }
      });

      channelRef.current = channel;

      // Subscribe with enhanced error handling
      const subscription = await channel.subscribe((status, err) => {
        console.log('📡 Realtime subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          setConnectionHealth(prev => ({
            ...prev,
            isHealthy: true,
            missedHeartbeats: 0,
            lastHeartbeat: Date.now(),
            reconnectAttempts: 0
          }));
          console.log('✅ Realtime connection restored');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionHealth(prev => ({ ...prev, isHealthy: false }));
          console.error('❌ Realtime connection failed:', err);
        }
      });

      return channel;
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      
      // Exponential backoff for retry
      const delay = Math.min(1000 * Math.pow(2, connectionHealth.reconnectAttempts), 30000);
      setTimeout(attemptReconnection, delay);
    }
  }, [tableId, connectionHealth.reconnectAttempts]);

  // Initialize heartbeat on mount
  useEffect(() => {
    if (tableId) {
      startHeartbeat();
    }

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [tableId, startHeartbeat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, []);

  return {
    connectionHealth,
    bufferEvent,
    processEventBuffer,
    attemptReconnection,
    isReliable: connectionHealth.isHealthy && connectionHealth.missedHeartbeats === 0
  };
}