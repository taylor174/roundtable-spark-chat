import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableState, Participant, Round, Suggestion, Vote, Block, Table } from '@/types';
import { calculateTimeRemaining, getCurrentPhase } from '@/utils';
import { getOrCreateClientId, getHostSecret } from '@/utils/clientId';

export function useTableState(tableCode: string) {
  const clientId = getOrCreateClientId();
  const hostSecret = getHostSecret(tableCode);
  
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

  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  // Load initial data
  const loadTableData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Get table
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('code', tableCode)
        .single();

      if (tableError) throw tableError;

      // Get participants
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('table_id', table.id)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;

      // Get current round
      let currentRound = null;
      if (table.current_round_id) {
        const { data, error: roundError } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', table.current_round_id)
          .single();

        if (!roundError) currentRound = data;
      }

      // Get suggestions for current round
      let suggestions: Suggestion[] = [];
      if (currentRound) {
        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('suggestions')
          .select('*')
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true });

        if (suggestionsError) throw suggestionsError;
        suggestions = suggestionsData || [];
      }

      // Get votes for current round
      let votes: Vote[] = [];
      if (currentRound) {
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('*')
          .eq('round_id', currentRound.id);

        if (votesError) throw votesError;
        votes = votesData || [];
      }

      // Get blocks (timeline)
      const { data: blocks, error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .eq('table_id', table.id)
        .order('created_at', { ascending: true });

      if (blocksError) throw blocksError;

      // Determine current participant and host status
      const isHost = hostSecret === table.host_secret;
      const currentParticipant = participants.find(p => p.client_id === clientId) || null;

      setState({
        table,
        participants: participants || [],
        currentRound: currentRound || null,
        suggestions,
        votes: votes || [],
        blocks: blocks || [],
        currentParticipant,
        clientId,
        isHost,
        timeRemaining: 0,
        loading: false,
        error: null,
      });

    } catch (error) {
      console.error('Error loading table data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load table data',
      }));
    }
  }, [tableCode, clientId, hostSecret]);

  // Update timer
  const updateTimer = useCallback(() => {
    setState(prev => {
      if (!prev.currentRound?.ends_at) return prev;
      
      const remaining = calculateTimeRemaining(prev.currentRound.ends_at);
      return { ...prev, timeRemaining: remaining };
    });
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!state.table?.id) return;

    const channel = supabase
      .channel(`table_${state.table.id}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tables', filter: `id=eq.${state.table.id}` },
        (payload) => {
          setState(prev => ({ ...prev, table: payload.new as Table }));
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `table_id=eq.${state.table.id}` },
        () => loadTableData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `table_id=eq.${state.table.id}` },
        () => loadTableData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'suggestions' },
        () => loadTableData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'votes' },
        () => loadTableData()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'blocks', filter: `table_id=eq.${state.table.id}` },
        () => loadTableData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.table?.id, loadTableData]);

  // Set up timer interval
  useEffect(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    const interval = setInterval(updateTimer, 1000);
    setTimerInterval(interval);
    updateTimer(); // Initial update

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [updateTimer]);

  // Load data on mount
  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  return {
    ...state,
    refresh: loadTableData,
    currentPhase: getCurrentPhase(
      state.table?.status || 'lobby',
      state.currentRound?.status || null,
      state.timeRemaining
    ),
  };
}