import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableState, Participant, Round, Suggestion, Vote, Block, Table } from '@/types';
import { calculateTimeRemaining, getCurrentPhase } from '@/utils';
import { getOrCreateClientId, getHostSecret } from '@/utils/clientId';
import { useToast } from '@/hooks/use-toast';
import { useErrorHandler } from './useErrorHandler';
import { useRealtimeConnection } from './useRealtimeConnection';
import { withRetry, debounce } from '@/utils/retryLogic';

export function useTableState(tableCode: string) {
  const clientId = getOrCreateClientId();
  const hostSecret = getHostSecret(tableCode);
  const { toast } = useToast();
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

  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);
  const connection = useRealtimeConnection(state.table?.id || '');
  
  // Debounced refresh to prevent excessive calls and flicker
  const debouncedRefresh = useRef(debounce(() => {
    loadTableData();
  }, 500));

  // Debounced state updates to batch changes
  const debouncedStateUpdate = useRef(debounce((updater: (prev: TableState) => TableState) => {
    setState(updater);
  }, 100));

  // Load initial data with retry logic
  const loadTableData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Use the new secure function to get table data
      const { data: tableDataArray, error: tableError } = await supabase
        .rpc('get_safe_table_data', { p_table_code: tableCode });

      if (tableError) throw tableError;
      if (!tableDataArray || tableDataArray.length === 0) {
        throw new Error(`Table with code ${tableCode} not found`);
      }
      
      const tableData = tableDataArray[0];

      
      
      // Check host status using secure host function if host secret provided
      let isHostCheck = false;
      let table = { ...tableData, host_secret: '' };
      
      if (hostSecret) {
        try {
          const { data: hostData, error: hostError } = await supabase
            .rpc('get_table_host_data_secure', { 
              p_table_code: tableCode, 
              p_host_secret: hostSecret 
            });
          
          if (!hostError && hostData && hostData.length > 0) {
            isHostCheck = true;
            table = hostData[0];
          }
        } catch (error) {
          console.log('Host verification failed:', error);
          // Continue as non-host user
        }
      }

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

      // Get blocks (timeline) with winner names
      const { data: blocks, error: blocksError } = await supabase
        .from('blocks')
        .select(`
          *,
          suggestions!blocks_suggestion_id_fkey(
            participants!suggestions_participant_id_fkey(display_name)
          )
        `)
        .eq('table_id', table.id)
        .order('created_at', { ascending: true });

      if (blocksError) throw blocksError;

      // Determine current participant and host status  
      const isHost = isHostCheck;
      const currentParticipant = participants.find(p => p.client_id === clientId) || null;

      // Process blocks to add winner names
      const processedBlocks = (blocks || []).map(block => ({
        ...block,
        winnerName: (block as any).suggestions?.participants?.display_name || undefined
      }));

      setState({
        table,
        participants: participants || [],
        currentRound: currentRound || null,
        suggestions,
        votes: votes || [],
        blocks: processedBlocks,
        currentParticipant,
        clientId,
        isHost,
        timeRemaining: 0,
        loading: false,
        error: null,
      });

    } catch (error) {
      handleError(error, { 
        operation: 'load table data', 
        component: 'useTableState',
        userMessage: 'Failed to load table data. Please refresh the page.' 
      });
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load table data',
      }));
    }
  }, [tableCode, clientId, hostSecret, handleError]);

  // Optimized state updaters
  const updateTable = useCallback((newTable: Table) => {
    setState(prev => ({ ...prev, table: newTable }));
  }, []);

  const updateParticipants = useCallback((newParticipants: Participant[]) => {
    setState(prev => {
      const currentParticipant = newParticipants.find(p => p.client_id === clientId) || null;
      return { ...prev, participants: newParticipants, currentParticipant };
    });
  }, [clientId]);

  const updateRound = useCallback((newRound: Round) => {
    setState(prev => ({ ...prev, currentRound: newRound }));
  }, []);

  const updateSuggestions = useCallback((newSuggestions: Suggestion[]) => {
    setState(prev => {
      // Deduplicate by id
      const uniqueSuggestions = newSuggestions.reduce((acc, current) => {
        const exists = acc.find(item => item.id === current.id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, [...prev.suggestions.filter(s => !newSuggestions.some(ns => ns.id === s.id))]);
      
      return { ...prev, suggestions: uniqueSuggestions };
    });
  }, []);

  const updateVotes = useCallback((newVotes: Vote[]) => {
    setState(prev => {
      // Deduplicate by id
      const uniqueVotes = newVotes.reduce((acc, current) => {
        const exists = acc.find(item => item.id === current.id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, [...prev.votes.filter(v => !newVotes.some(nv => nv.id === v.id))]);
      
      return { ...prev, votes: uniqueVotes };
    });
  }, []);

  const updateBlocks = useCallback((newBlocks: Block[]) => {
    setState(prev => ({ ...prev, blocks: newBlocks }));
  }, []);

  // Force refresh blocks data - useful after winner selection
  const refreshBlocks = useCallback(async () => {
    if (!state.table?.id) return;
    
    try {
      const { data: blocks, error } = await supabase
        .from('blocks')
        .select('*')
        .eq('table_id', state.table.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      updateBlocks(blocks || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error refreshing blocks:', error);
      }
    }
  }, [state.table?.id, updateBlocks]);

  // Update timer
  const updateTimer = useCallback(() => {
    setState(prev => {
      if (!prev.currentRound?.ends_at) return prev;
      
      const remaining = calculateTimeRemaining(prev.currentRound.ends_at);
      return { ...prev, timeRemaining: remaining };
    });
  }, []);

  // Set up real-time subscriptions with optimized updates
  useEffect(() => {
    if (!state.table?.id) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Setting up realtime subscriptions

    const channel = supabase
      .channel(`table_${state.table.id}`)
      // Table updates - critical for detecting when table starts
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${state.table.id}` },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('Table update received:', payload);
          }
          const newTable = payload.new as Table;
          updateTable(newTable);
          
          // Check if table just started running - trigger immediate state refresh
          if (newTable.status === 'running' && state.table?.status !== 'running') {
            if (import.meta.env.DEV) {
              console.log('Table started - triggering immediate state refresh');
            }
            debouncedRefresh.current();
          }
          
          // Check if current_round_id changed - trigger full refresh to get new round data
          if (newTable.current_round_id !== state.table?.current_round_id) {
            if (import.meta.env.DEV) {
              console.log('Current round changed - triggering data refresh');
            }
            setTimeout(() => debouncedRefresh.current(), 100); // Small delay to ensure round exists
          }
        }
      )
      // Round updates - critical for phase transitions (listen to ALL rounds for this table)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('Round update received:', payload);
          }
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRound = payload.new as Round;
            
            // Only update if this is the current round
            if (state.table?.current_round_id === newRound.id) {
              if (import.meta.env.DEV) {
                console.log('Current round updated - updating state');
              }
              updateRound(newRound);
              
              // If round just transitioned to vote phase, add small delay for sync
              if (newRound.status === 'vote' && state.currentRound?.status !== 'vote') {
                if (import.meta.env.DEV) {
                  console.log('Vote phase started - ensuring UI sync');
                }
                setTimeout(() => {
                  updateRound(newRound);
                }, 200);
              }
            } else if (payload.eventType === 'INSERT') {
              if (import.meta.env.DEV) {
                console.log('New round created - may need to refresh if it becomes current');
              }
              // The table update will handle the refresh when current_round_id changes
            }
          }
        }
      )
      // Participant changes
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'participants', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          const newParticipant = payload.new as Participant;
          setState(prev => {
            const updated = [...prev.participants, newParticipant];
            const currentParticipant = updated.find(p => p.client_id === clientId) || null;
            
            // Show join toast
            if (!newParticipant.is_host) {
              toast({
                title: `${newParticipant.display_name} joined`,
                description: "New participant joined the session",
              });
            }
            
            return { ...prev, participants: updated, currentParticipant };
          });
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'participants', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          setState(prev => {
            const updated = prev.participants.filter(p => p.id !== payload.old.id);
            const currentParticipant = updated.find(p => p.client_id === clientId) || null;
            return { ...prev, participants: updated, currentParticipant };
          });
        }
      )
      // Suggestion changes
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'suggestions' },
        (payload) => {
          const newSuggestion = payload.new as Suggestion;
          if (state.currentRound && newSuggestion.round_id === state.currentRound.id) {
            setState(prev => ({
              ...prev,
              suggestions: [...prev.suggestions, newSuggestion]
            }));
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'suggestions' },
        (payload) => {
          const updatedSuggestion = payload.new as Suggestion;
          if (state.currentRound && updatedSuggestion.round_id === state.currentRound.id) {
            setState(prev => ({
              ...prev,
              suggestions: prev.suggestions.map(s => 
                s.id === updatedSuggestion.id ? updatedSuggestion : s
              )
            }));
          }
        }
      )
      // Vote changes
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          const newVote = payload.new as Vote;
          if (state.currentRound && newVote.round_id === state.currentRound.id) {
            setState(prev => ({
              ...prev,
              votes: [...prev.votes, newVote]
            }));
          }
        }
      )
      // Block changes - listen to all changes for immediate timeline updates
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'blocks', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('Block insert received:', payload);
          }
          setState(prev => ({
            ...prev,
            blocks: [...prev.blocks, payload.new as Block]
          }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'blocks', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          if (import.meta.env.DEV) {
            console.log('Block update received:', payload);
          }
          setState(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => 
              b.id === payload.new.id ? payload.new as Block : b
            )
          }));
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
  }, [state.table?.id, state.currentRound?.id, clientId, updateTable, updateRound, toast, loadTableData]);

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
    refreshBlocks,
    currentPhase: getCurrentPhase(
      state.table?.status || 'lobby',
      state.currentRound?.status || null,
      state.timeRemaining
    ),
  };
}