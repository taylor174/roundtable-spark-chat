import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';

interface SessionValidationResult {
  valid: boolean;
  error?: string;
  table_status?: string;
  message?: string;
}

export function useSessionValidator(tableId: string | null, clientId: string) {
  const { handleAsyncOperation } = useErrorHandler();

  const validateSession = useCallback(async (): Promise<SessionValidationResult | null> => {
    if (!tableId) return null;

    return await handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('validate_table_session', {
        p_table_id: tableId,
        p_client_id: clientId
      });

      if (error) throw error;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid response format');
      return data as unknown as SessionValidationResult;
    }, {
      operation: 'session validation',
      component: 'useSessionValidator'
    });
  }, [tableId, clientId, handleAsyncOperation]);

  // Validate session periodically
  useEffect(() => {
    if (!tableId) return;

    validateSession();

    const interval = setInterval(validateSession, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [tableId, validateSession]);

  return { validateSession };
}