import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_LIMITS } from '@/constants';

interface SystemCapacity {
  can_create_table: boolean;
  running_tables: number;
  max_tables: number;
  active_participants: number;
  max_participants: number;
  table_capacity_pct: number;
  participant_capacity_pct: number;
  at_capacity: boolean;
}

interface UseSystemCapacityOptions {
  enablePolling?: boolean;
  pollingInterval?: number;
}

export const useSystemCapacity = (options: UseSystemCapacityOptions = {}) => {
  const { enablePolling = false, pollingInterval = 60000 } = options;
  const [capacity, setCapacity] = useState<SystemCapacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkCapacity = async () => {
    try {
      const { data, error } = await supabase.rpc('check_system_capacity');
      if (error) throw error;
      
      setCapacity(data as unknown as SystemCapacity);
      setError(null);
    } catch (err) {
      console.error('Failed to check system capacity:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkCapacity();

    if (enablePolling) {
      const interval = setInterval(checkCapacity, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [enablePolling, pollingInterval]);

  const isApproachingCapacity = () => {
    if (!capacity) return false;
    return (
      capacity.table_capacity_pct >= SYSTEM_LIMITS.CAPACITY_WARNING_THRESHOLD * 100 ||
      capacity.participant_capacity_pct >= SYSTEM_LIMITS.CAPACITY_WARNING_THRESHOLD * 100
    );
  };

  const getCapacityWarning = () => {
    if (!capacity) return null;

    if (capacity.at_capacity) {
      return {
        type: 'error' as const,
        title: 'System at Full Capacity',
        message: 'The system is currently at maximum capacity. Please try again later.',
      };
    }

    if (isApproachingCapacity()) {
      return {
        type: 'warning' as const,
        title: 'System Approaching Capacity',
        message: `System is at ${Math.max(capacity.table_capacity_pct, capacity.participant_capacity_pct).toFixed(1)}% capacity.`,
      };
    }

    return null;
  };

  return {
    capacity,
    loading,
    error,
    checkCapacity,
    isApproachingCapacity,
    getCapacityWarning,
    canCreateTable: capacity?.can_create_table ?? false,
  };
};