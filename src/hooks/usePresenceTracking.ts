import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function usePresenceTracking(tableId: string | null, clientId: string) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!tableId) return;

    // Update presence every 30 seconds
    const updatePresence = async () => {
      try {
        await supabase.rpc('update_participant_presence', {
          p_table_id: tableId,
          p_client_id: clientId
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to update presence:', error);
        }
      }
    };

    // Initial presence update
    updatePresence();

    // Set up heartbeat
    heartbeatRef.current = setInterval(updatePresence, 30000);

    // Update presence before page unload
    const handleBeforeUnload = async () => {
      try {
        // Mark as offline when leaving the page
        await supabase.rpc('mark_participant_offline', {
          p_participant_id: clientId
        });
      } catch (error) {
        // Ignore errors on page unload
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tableId, clientId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, []);
}