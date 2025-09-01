import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableState, Participant, Round, Suggestion, Vote, Block, Table } from '@/types';
import { calculateTimeRemaining, getCurrentPhase } from '@/utils';
import { getOrCreateClientId, getHostSecret, removeHostSecret } from '@/utils/clientId';
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
    if (!tableCode) {
      setState(prev => ({ ...prev, loading: false, error: 'No table code provided' }));
      return;
    }

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        // Use the new secure function to get table data with better error handling
        const { data: tableDataArray, error: tableError } = await supabase
          .rpc('get_safe_table_data', { p_table_code: tableCode });

        if (tableError) {
          handleError(tableError, { 
            operation: 'load table data', 
            component: 'useTableState',
            userMessage: `Failed to load table "${tableCode}". ${tableError.message.includes('permission') ? 'Access denied.' : 'Please try again.'}`
          });
          throw new Error(`Failed to load table: ${tableError.message}`);
        }

        if (!tableDataArray || tableDataArray.length === 0) {
          const notFoundError = new Error(`Table with code "${tableCode}" not found`);
          handleError(notFoundError, { 
            operation: 'find table', 
            component: 'useTableState',
            userMessage: `Table "${tableCode}" not found. Please check the code and try again.`
          });
          throw notFoundError;
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

      // Get blocks (timeline) - simplified approach to avoid relationship issues
      const { data: blocks, error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .eq('table_id', table.id)
        .order('created_at', { ascending: true });

      if (blocksError) throw blocksError;

      // Enrich blocks with winner names using separate queries
      let enrichedBlocks = blocks || [];
      if (blocks && blocks.length > 0) {
        for (const block of blocks) {
          if (block.suggestion_id) {
            try {
              const { data: suggestionData } = await supabase
                .from('suggestions')
                .select(`
                  text,
                  participants!suggestions_participant_id_fkey(display_name)
                `)
                .eq('id', block.suggestion_id)
                .single();
              
              if (suggestionData?.participants) {
                (block as any).winnerName = suggestionData.participants.display_name;
              }
            } catch (err) {
              // Silent fail for winner name lookup
            }
          }
        }
      }

      // Determine current participant and host status  
      const isHost = isHostCheck;
      const currentParticipant = participants.find(p => p.client_id === clientId) || null;

      // Use enriched blocks directly
      const processedBlocks = enrichedBlocks;

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


        return; // Success, exit retry loop

      } catch (error: any) {
        attempt++;
        
        if (attempt >= maxRetries) {
          const errorMessage = error.message || 'Failed to load table data';
          
          handleError(error, { 
            operation: 'load table data', 
            component: 'useTableState',
            userMessage: 'Failed to load table data. Please refresh the page.' 
          });
          
          setState(prev => ({
            ...prev,
            loading: false,
            error: errorMessage,
          }));

        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
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

  const updateRound = useCallback((newRound: Round | null) => {
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
      // Silent fail for blocks refresh
    }
  }, [state.table?.id, updateBlocks]);

  // Update timer with better debugging and validation
  const updateTimer = useCallback(() => {
    setState(prev => {
      if (!prev.currentRound?.ends_at) {
        // No end time set, return 0
        return { ...prev, timeRemaining: 0 };
      }
      
      const remaining = calculateTimeRemaining(prev.currentRound.ends_at);
      
      // Debug timer calculations
      if (remaining <= 0 && prev.timeRemaining > 0) {
        console.log('⏰ Timer expired for round:', {
          roundId: prev.currentRound.id,
          status: prev.currentRound.status,
          endsAt: prev.currentRound.ends_at,
          remaining,
          previousRemaining: prev.timeRemaining
        });
      }
      
      return { ...prev, timeRemaining: Math.max(0, remaining) };
    });
  }, []);

  // Targeted round data fetching without destroying subscriptions
  const fetchCurrentRoundData = useCallback(async (roundId: string | null) => {
    if (!roundId) {
      updateRound(null);
      updateSuggestions([]);
      updateVotes([]);
      return;
    }

    try {
      const [roundResult, suggestionsResult, votesResult] = await Promise.all([
        supabase.from('rounds').select('*').eq('id', roundId).single(),
        supabase.from('suggestions').select('*').eq('round_id', roundId).order('created_at'),
        supabase.from('votes').select('*').eq('round_id', roundId)
      ]);

      if (roundResult.data) updateRound(roundResult.data);
      if (suggestionsResult.data) updateSuggestions(suggestionsResult.data);
      if (votesResult.data) updateVotes(votesResult.data);
    } catch (error) {
      console.error('Error fetching round data:', error);
    }
  }, [updateRound, updateSuggestions, updateVotes]);

  // Set up real-time subscriptions - CRITICAL: Keep dependencies MINIMAL to prevent reconnection
  useEffect(() => {
    if (!state.table?.id) return;

    console.log('🔄 [REAL-TIME] Setting up subscription for table:', state.table.id);

    // Clean up existing channel
    if (channelRef.current) {
      console.log('🧹 [REAL-TIME] Cleaning up existing channel');
      supabase.removeChannel(channelRef.current);
    }

    // Create stable functions to avoid recreating subscriptions
    const handleTableUpdate = (payload: any) => {
      console.log('📊 [REAL-TIME] Table update received:', payload.new);
      const newTable = payload.new as Table;
      
      // IMMEDIATE STATE UPDATE - don't wait for callbacks
      setState(prev => ({ ...prev, table: newTable }));
      
      // CRITICAL: Detect table status change to 'running'
      if (newTable.status === 'running') {
        console.log('🎯 [CRITICAL] Table started! Force refreshing all data...');
        
        // Force immediate data refresh for ALL participants
        setTimeout(async () => {
          try {
            console.log('🔄 [CRITICAL] Loading fresh table data after start...');
            
            // Fetch current round data
            if (newTable.current_round_id) {
              const { data: roundData, error: roundError } = await supabase
                .from('rounds')
                .select('*')
                .eq('id', newTable.current_round_id)
                .single();
              
              if (!roundError && roundData) {
                console.log('✅ [CRITICAL] Fresh round data loaded:', roundData);
                setState(prev => ({ ...prev, currentRound: roundData }));
              }
              
              // Fetch suggestions for this round
              const { data: suggestionsData } = await supabase
                .from('suggestions')
                .select('*')
                .eq('round_id', newTable.current_round_id);
              
              if (suggestionsData) {
                console.log('✅ [CRITICAL] Fresh suggestions loaded:', suggestionsData.length);
                setState(prev => ({ ...prev, suggestions: suggestionsData }));
              }
              
              // Fetch votes for this round
              const { data: votesData } = await supabase
                .from('votes')
                .select('*')
                .eq('round_id', newTable.current_round_id);
              
              if (votesData) {
                console.log('✅ [CRITICAL] Fresh votes loaded:', votesData.length);
                setState(prev => ({ ...prev, votes: votesData }));
              }
            }
          } catch (error) {
            console.error('❌ [CRITICAL] Failed to refresh data after table start:', error);
          }
        }, 100); // Very quick refresh
      }
    };

    const handleRoundUpdate = (payload: any) => {
      console.log('⚡ [REAL-TIME] Round update received:', payload);
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newRound = payload.new as Round;
        console.log('✅ [REAL-TIME] Updating round state:', newRound);
        setState(prev => ({ ...prev, currentRound: newRound }));
      }
    };

    const channel = supabase
      .channel(`table_${state.table.id}_stable`)
      // Table updates - CRITICAL for detecting when table starts
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'tables', filter: `id=eq.${state.table.id}` },
        handleTableUpdate
      )
      // Round updates - critical for phase transitions
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'rounds', filter: `table_id=eq.${state.table.id}` },
        handleRoundUpdate
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
          setState(prev => {
            if (prev.currentRound && newSuggestion.round_id === prev.currentRound.id) {
              return { ...prev, suggestions: [...prev.suggestions, newSuggestion] };
            }
            return prev;
          });
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'suggestions' },
        (payload) => {
          const updatedSuggestion = payload.new as Suggestion;
          setState(prev => {
            if (prev.currentRound && updatedSuggestion.round_id === prev.currentRound.id) {
              return {
                ...prev,
                suggestions: prev.suggestions.map(s => 
                  s.id === updatedSuggestion.id ? updatedSuggestion : s
                )
              };
            }
            return prev;
          });
        }
      )
      // Vote changes
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'votes' },
        (payload) => {
          const newVote = payload.new as Vote;
          setState(prev => {
            if (prev.currentRound && newVote.round_id === prev.currentRound.id) {
              return { ...prev, votes: [...prev.votes, newVote] };
            }
            return prev;
          });
        }
      )
      // Block changes - listen to all changes for immediate timeline updates
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'blocks', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          setState(prev => ({
            ...prev,
            blocks: [...prev.blocks, payload.new as Block]
          }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'blocks', filter: `table_id=eq.${state.table.id}` },
        (payload) => {
          setState(prev => ({
            ...prev,
            blocks: prev.blocks.map(b => 
              b.id === payload.new.id ? payload.new as Block : b
            )
          }));
        }
      )
      .subscribe((status) => {
        console.log('📡 [REAL-TIME] Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REAL-TIME] Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REAL-TIME] Subscription error - will retry');
          // Don't use loadTableData here as it can cause infinite loops
        } else if (status === 'CLOSED') {
          console.warn('⚠️ [REAL-TIME] Subscription closed');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('🧹 [REAL-TIME] Cleaning up real-time subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [state.table?.id]); // CRITICAL: Only depend on table ID - nothing else!

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