import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableState, Participant, Round, Suggestion, Vote, Block, Table } from '@/types';
import { calculateTimeRemaining, getCurrentPhase } from '@/utils';
import { getOrCreateClientId, getHostSecret } from '@/utils/clientId';
import { useErrorHandler } from './useErrorHandler';
import { useCleanupTimer } from './useCleanupTimer';
import { debounce } from '@/utils/retryLogic';

export function useOptimizedTableState(tableCode: string) {
  const clientId = getOrCreateClientId();
  const hostSecret = getHostSecret(tableCode);
  const { handleError, handleAsyncOperation } = useErrorHandler();
  
  const [state, setState] = useState<TableState>({
    table: null,
    participants: [],
    currentRound: null,
    suggestions: [],
    votes: [],
    blocks: [],
    currentParticipant: null,
    clientId,
    isHost: false,
    timeRemaining: 0,
    loading: true,
    error: null,
  });

  const channelRef = useRef<any>(null);
  const mountedRef = useRef(true);
  
  // Debounced refresh to prevent excessive calls
  const debouncedRefresh = useRef(debounce(() => {
    if (mountedRef.current) {
      loadTableData();
    }
  }, 300));

  // Safe state updater that checks if component is still mounted
  const safeSetState = useCallback((updater: (prev: TableState) => TableState) => {
    if (mountedRef.current) {
      setState(updater);
    }
  }, []);

  // Load table data with proper error handling
  const loadTableData = useCallback(async () => {
    if (!tableCode || !mountedRef.current) return;

    const result = await handleAsyncOperation(async () => {
      safeSetState(prev => ({ ...prev, loading: true, error: null }));

      // Get table data
      const { data: tableDataArray, error: tableError } = await supabase
        .rpc('get_safe_table_data', { p_table_code: tableCode });

      if (tableError) throw tableError;
      if (!tableDataArray || tableDataArray.length === 0) {
        throw new Error(`Table with code "${tableCode}" not found`);
      }
      
      const tableData = tableDataArray[0];

      // Check host status
      let isHostCheck = false;
      let table = { ...tableData, host_secret: '' };
      
      if (hostSecret) {
        const { data: hostData, error: hostError } = await supabase
          .rpc('get_table_host_data_secure', { 
            p_table_code: tableCode, 
            p_host_secret: hostSecret 
          });
        
        if (!hostError && hostData && hostData.length > 0) {
          isHostCheck = true;
          table = hostData[0];
        }
      }

      // Load all related data in parallel
      const [participantsResult, roundResult, suggestionsResult, votesResult, blocksResult] = await Promise.allSettled([
        supabase.from('participants').select('*').eq('table_id', table.id).order('joined_at', { ascending: true }),
        table.current_round_id ? supabase.from('rounds').select('*').eq('id', table.current_round_id).single() : Promise.resolve({ data: null }),
        table.current_round_id ? supabase.from('suggestions').select('*').eq('round_id', table.current_round_id).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
        table.current_round_id ? supabase.from('votes').select('*').eq('round_id', table.current_round_id) : Promise.resolve({ data: [] }),
        supabase.from('blocks').select('*').eq('table_id', table.id).order('created_at', { ascending: true })
      ]);

      const participants = participantsResult.status === 'fulfilled' ? participantsResult.value.data || [] : [];
      const currentRound = roundResult.status === 'fulfilled' ? roundResult.value.data : null;
      const suggestions = suggestionsResult.status === 'fulfilled' ? suggestionsResult.value.data || [] : [];
      const votes = votesResult.status === 'fulfilled' ? votesResult.value.data || [] : [];
      const blocks = blocksResult.status === 'fulfilled' ? blocksResult.value.data || [] : [];

      const currentParticipant = participants.find(p => p.client_id === clientId) || null;

      return {
        table,
        participants,
        currentRound,
        suggestions,
        votes,
        blocks,
        currentParticipant,
        clientId,
        isHost: isHostCheck,
        timeRemaining: 0,
        loading: false,
        error: null,
      };
    }, {
      operation: 'load table data',
      component: 'useOptimizedTableState',
      userMessage: 'Failed to load table data. Please refresh the page.'
    });

    if (result && mountedRef.current) {
      setState(result);
    }
  }, [tableCode, clientId, hostSecret, handleAsyncOperation, safeSetState]);

  // Optimized state updaters with mount check
  const updateTable = useCallback((newTable: Table) => {
    safeSetState(prev => ({ ...prev, table: newTable }));
  }, [safeSetState]);

  const updateParticipants = useCallback((newParticipants: Participant[]) => {
    safeSetState(prev => {
      const currentParticipant = newParticipants.find(p => p.client_id === clientId) || null;
      return { ...prev, participants: newParticipants, currentParticipant };
    });
  }, [clientId, safeSetState]);

  const updateRound = useCallback((newRound: Round) => {
    safeSetState(prev => ({ ...prev, currentRound: newRound }));
  }, [safeSetState]);

  const updateSuggestions = useCallback((newSuggestions: Suggestion[]) => {
    safeSetState(prev => ({ ...prev, suggestions: newSuggestions }));
  }, [safeSetState]);

  const updateVotes = useCallback((newVotes: Vote[]) => {
    safeSetState(prev => ({ ...prev, votes: newVotes }));
  }, [safeSetState]);

  const updateBlocks = useCallback((newBlocks: Block[]) => {
    safeSetState(prev => ({ ...prev, blocks: newBlocks }));
  }, [safeSetState]);

  // Timer update with cleanup
  const updateTimer = useCallback(() => {
    safeSetState(prev => {
      if (!prev.currentRound?.ends_at) return prev;
      
      const remaining = calculateTimeRemaining(prev.currentRound.ends_at);
      return { ...prev, timeRemaining: remaining };
    });
  }, [safeSetState]);

  // Use cleanup timer for better timer management
  useCleanupTimer({
    callback: updateTimer,
    delay: 1000,
    dependencies: [state.currentRound?.ends_at],
    enabled: !!state.currentRound?.ends_at
  });

  // Set up real-time subscriptions with cleanup
  useEffect(() => {
    if (!state.table?.id || !mountedRef.current) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`table_${state.table.id}_optimized`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${state.table.id}` },
        (payload) => {
          const newTable = payload.new as Table;
          updateTable(newTable);
          
          if (newTable.status === 'running' && state.table?.status !== 'running') {
            debouncedRefresh.current();
          }
          
          if (newTable.current_round_id !== state.table?.current_round_id) {
            setTimeout(() => debouncedRefresh.current(), 100);
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRound = payload.new as Round;
            if (state.table?.current_round_id === newRound.id) {
              updateRound(newRound);
            }
          }
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newParticipant = payload.new as Participant;
            safeSetState(prev => ({
              ...prev,
              participants: [...prev.participants, newParticipant],
              currentParticipant: newParticipant.client_id === clientId ? newParticipant : prev.currentParticipant
            }));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [state.table?.id, updateTable, updateRound, clientId, safeSetState]);

  // Initial load and cleanup
  useEffect(() => {
    mountedRef.current = true;
    loadTableData();
    
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadTableData]);

  const refresh = useCallback(() => {
    if (mountedRef.current) {
      loadTableData();
    }
  }, [loadTableData]);

  const currentPhase = getCurrentPhase(
    state.table?.status || 'lobby',
    state.currentRound?.status || null,
    state.timeRemaining
  );

  return {
    ...state,
    refresh,
    currentPhase,
  };
}