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
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    const handleTableUpdate = async (payload: any) => {
      console.log('📊 [REAL-TIME] Table update received:', payload.new);
      const newTable = payload.new as Table;
      
      // IMMEDIATE STATE UPDATE - No dependencies on round data
      setState(prev => {
        const newState = { ...prev, table: newTable };
        
        console.log('🎯 [CRITICAL] IMMEDIATE table update:', {
          oldStatus: prev.table?.status,
          newStatus: newTable.status,
          hasCurrentRound: !!prev.currentRound,
          currentPhase: getCurrentPhase(newTable.status, prev.currentRound?.status || null, prev.timeRemaining)
        });
        
        return newState;
      });
      
      // CRITICAL: If table started, immediately fetch round data without debounce
      if (newTable.status === 'running' && newTable.current_round_id) {
        console.log('🚨 [EMERGENCY] Table started - fetching round data immediately');
        
        // IMMEDIATE fetch without debounce for critical transitions
        fetchCurrentRoundData(newTable.current_round_id).then(() => {
          console.log('✅ [SUCCESS] Emergency round data loaded for table start');
        }).catch(error => {
          console.error('❌ [ERROR] Emergency round data fetch failed:', error);
          // Fallback to full refresh if targeted fetch fails
          loadTableData();
        });
      }
    };

    const handleRoundUpdate = async (payload: any) => {
      console.log('⚡ [REAL-TIME] Round update received:', payload);
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newRound = payload.new as Round;
        
        // IMMEDIATE and ATOMIC round state update with phase calculation
        setState(prev => {
          const newState = {
            ...prev,
            currentRound: newRound,
            timeRemaining: newRound.ends_at ? calculateTimeRemaining(newRound.ends_at) : 0
          };
          
          const currentPhase = getCurrentPhase(
            prev.table?.status || 'waiting', 
            newRound.status, 
            newState.timeRemaining
          );
          
          console.log('✅ [ROUND UPDATE] Immediate state update:', {
            roundId: newRound.id,
            roundStatus: newRound.status,
            tableStatus: prev.table?.status,
            timeRemaining: newState.timeRemaining,
            currentPhase: currentPhase
          });
          
          return newState;
        });
        
        // For INSERT events (new rounds), immediately clear old suggestions/votes
        if (payload.eventType === 'INSERT') {
          setState(prev => ({
            ...prev,
            suggestions: [],
            votes: []
          }));
          console.log('🆕 [NEW ROUND] Cleared old suggestions and votes for new round');
        }
        
        // Fetch associated data only for active phases
        if (newRound.status === 'suggest' || newRound.status === 'vote') {
          try {
            const [suggestionsResult, votesResult] = await Promise.all([
              supabase.from('suggestions').select('*').eq('round_id', newRound.id).order('created_at'),
              supabase.from('votes').select('*').eq('round_id', newRound.id)
            ]);
            
            setState(prev => ({
              ...prev,
              suggestions: suggestionsResult.data || [],
              votes: votesResult.data || []
            }));
            
            console.log('📝 [ROUND DATA] Loaded suggestions and votes:', {
              suggestions: suggestionsResult.data?.length || 0,
              votes: votesResult.data?.length || 0
            });
          } catch (error) {
            console.error('❌ [ERROR] Failed to fetch round data:', error);
          }
        }
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

  // Enhanced emergency state synchronization guard for critical transitions
  useEffect(() => {
    // CRITICAL: Emergency sync for state inconsistencies during table start
    const tableStatus = state.table?.status;
    const hasCurrentRound = !!state.currentRound;
    const tableId = state.table?.id;
    
    if (tableStatus === 'running' && !hasCurrentRound && tableId) {
      console.log('🚨 [EMERGENCY] Critical state inconsistency detected:', {
        tableStatus,
        hasCurrentRound,
        tableId,
        currentRoundId: state.table?.current_round_id
      });
      
      // Clear any existing timeout
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      // IMMEDIATE emergency sync for critical situations
      syncTimeoutRef.current = setTimeout(() => {
        console.log('⚡ [EMERGENCY] Executing immediate state synchronization');
        
        // Try targeted round fetch first, then full refresh as fallback
        if (state.table?.current_round_id) {
          fetchCurrentRoundData(state.table.current_round_id).catch(() => {
            console.log('🔄 [FALLBACK] Targeted fetch failed, doing full refresh');
            loadTableData();
          });
        } else {
          loadTableData();
        }
      }, 100); // Minimal delay to avoid excessive calls
    }
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [state.table?.status, state.currentRound?.id, state.table?.current_round_id, fetchCurrentRoundData, loadTableData]);

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

  // Calculate current phase with enhanced logging for debugging
  const currentPhase = getCurrentPhase(
    state.table?.status || 'lobby',
    state.currentRound?.status || null,
    state.timeRemaining
  );
  
  // Debug phase calculation during critical transitions
  useEffect(() => {
    if (state.table?.status === 'running') {
      console.log('🎯 [PHASE] Current phase calculation:', {
        tableStatus: state.table.status,
        roundStatus: state.currentRound?.status,
        timeRemaining: state.timeRemaining,
        calculatedPhase: currentPhase,
        hasRound: !!state.currentRound,
        roundId: state.currentRound?.id
      });
    }
  }, [state.table?.status, state.currentRound?.status, state.timeRemaining, currentPhase, state.currentRound?.id]);

  // EMERGENCY STATE CONSISTENCY CHECK
  useEffect(() => {
    // If table is running but we think we're in lobby, emergency refresh
    if (state.table?.status === 'running' && currentPhase === 'lobby' && !state.loading) {
      console.error('🚨 [EMERGENCY] Participant out of sync - table running but showing lobby!');
      console.log('📊 [EMERGENCY] Debug state:', {
        tableStatus: state.table?.status,
        roundStatus: state.currentRound?.status,
        timeRemaining: state.timeRemaining,
        currentPhase,
        hasCurrentRound: !!state.currentRound
      });
      
      // Force immediate refresh
      setTimeout(() => {
        console.log('⚡ [EMERGENCY] Forcing state refresh...');
        loadTableData();
      }, 100);
    }
  }, [state.table?.status, currentPhase, state.loading, state.currentRound, state.timeRemaining, loadTableData]);

  return {
    ...state,
    refresh: loadTableData,
    refreshBlocks,
    currentPhase,
  };
}