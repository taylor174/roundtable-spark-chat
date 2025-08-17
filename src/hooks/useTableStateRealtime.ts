import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateClientId, getHostSecret } from '@/utils/clientId';
import { TableState, PhaseType } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function useTableStateRealtime(tableCode: string) {
  const [state, setState] = useState<TableState>({
    table: null,
    participants: [],
    currentRound: null,
    suggestions: [],
    votes: [],
    blocks: [],
    currentParticipant: null,
    clientId: getOrCreateClientId(),
    isHost: false,
    timeRemaining: 0,
    loading: true,
    error: null,
  });

  const { toast } = useToast();
  const channelRef = useRef<any>(null);
  const lastRealtimeEventRef = useRef<number>(0);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tableIdRef = useRef<string | null>(null);
  const currentRoundIdRef = useRef<string | null>(null);
  const subscriptionStateRef = useRef<{[key: string]: boolean}>({});
  const roundSubscriptionsRef = useRef<string | null>(null); // Track which round has active subscriptions

  // Debug logging helper
  const logSubscriptionState = useCallback(() => {
    const channels = supabase.getChannels?.().map(c => ({
      topic: c.topic,
      state: c.state
    })) || [];
    
    console.log('🔌 Subscription Debug:', {
      tableCode,
      tableId: tableIdRef.current,
      currentRoundId: currentRoundIdRef.current,
      channels,
      activeSubscriptions: subscriptionStateRef.current,
      lastEvent: new Date(lastRealtimeEventRef.current).toISOString()
    });
  }, [tableCode]);

  // Optimistic state updates
  const optimisticUpdate = useCallback((updates: Partial<TableState> | ((prev: TableState) => Partial<TableState>)) => {
    setState(prevState => {
      const newUpdates = typeof updates === 'function' ? updates(prevState) : updates;
      console.log('⚡ Optimistic update applied:', newUpdates);
      return { ...prevState, ...newUpdates };
    });
  }, []);

  // Track realtime events (simplified)
  const trackRealtimeEvent = useCallback((eventType: string) => {
    console.log(`✅ Realtime event received: ${eventType}`);
    lastRealtimeEventRef.current = Date.now();
  }, []);

  const loadTableData = useCallback(async () => {
    if (!tableCode) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Load table data with protection against malformed queries
      let selectQuery = '*';
      if (!selectQuery || selectQuery.includes('s*')) {
        selectQuery = '*';
      }
      console.log('[REFETCH]', { table: 'tables', select: selectQuery });
      
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select(selectQuery)
        .eq('code', tableCode)
        .maybeSingle() as { data: any; error: any };

      if (tableError) {
        console.error('Refetch error', { table: 'tables', tableCode, error: tableError });
        throw tableError;
      }
      if (!table) throw new Error('Table not found');

      tableIdRef.current = table.id;

      // Load participants with protection
      selectQuery = '*';
      if (!selectQuery || selectQuery.includes('s*')) {
        selectQuery = '*';
      }
      console.log('[REFETCH]', { table: 'participants', select: selectQuery });
      
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select(selectQuery)
        .eq('table_id', table.id)
        .order('joined_at', { ascending: true }) as { data: any[]; error: any };

      if (participantsError) {
        console.error('Refetch error', { table: 'participants', tableId: table.id, error: participantsError });
        throw participantsError;
      }
      
      const participants = participantsData || [];

      // Load current round with protection - guard against null round_id
      let currentRound = null;
      if (table.current_round_id) {
        selectQuery = '*';
        if (!selectQuery || selectQuery.includes('s*')) {
          selectQuery = '*';
        }
        console.log('[REFETCH]', { table: 'rounds', select: selectQuery, roundId: table.current_round_id });
        
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .select(selectQuery)
          .eq('id', table.current_round_id)
          .maybeSingle() as { data: any; error: any };

        if (roundError) {
          console.error('Refetch error', { table: 'rounds', roundId: table.current_round_id, error: roundError });
          throw roundError;
        }
        currentRound = roundData;
      } else {
        console.log('[REFETCH] Skipping rounds query - table.current_round_id is null (lobby state)');
      }

      currentRoundIdRef.current = currentRound?.id || null;

      // Load suggestions for current round with protection
      let suggestions: any[] = [];
      if (currentRound) {
        selectQuery = '*';
        if (!selectQuery || selectQuery.includes('s*')) {
          selectQuery = '*';
        }
        console.log('[REFETCH]', { table: 'suggestions', select: selectQuery });
        
        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('suggestions')
          .select(selectQuery)
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true }) as { data: any[]; error: any };

        if (suggestionsError) {
          console.error('Refetch error', { table: 'suggestions', roundId: currentRound.id, error: suggestionsError });
          throw suggestionsError;
        }
        suggestions = suggestionsData || [];
      }

      // Load votes for current round with protection
      let votes: any[] = [];
      if (currentRound) {
        selectQuery = '*';
        if (!selectQuery || selectQuery.includes('s*')) {
          selectQuery = '*';
        }
        console.log('[REFETCH]', { table: 'votes', select: selectQuery });
        
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select(selectQuery)
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true }) as { data: any[]; error: any };

        if (votesError) {
          console.error('Refetch error', { table: 'votes', roundId: currentRound.id, error: votesError });
          throw votesError;
        }
        votes = votesData || [];
      }

      // Load blocks with protection
      selectQuery = '*';
      if (!selectQuery || selectQuery.includes('s*')) {
        selectQuery = '*';
      }
      console.log('[REFETCH]', { table: 'blocks', select: selectQuery });
      
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select(selectQuery)
        .eq('table_id', table.id)
        .order('created_at', { ascending: true }) as { data: any[]; error: any };

      if (blocksError) {
        console.error('Refetch error', { table: 'blocks', tableId: table.id, error: blocksError });
        throw blocksError;
      }
      
      const blocks = blocksData || [];

      // Determine if user is host and find current participant
      const clientId = getOrCreateClientId();
      const hostSecret = getHostSecret(tableCode);
      const isHost = hostSecret === table.host_secret;

      const currentParticipant = participants.find(p => p.client_id === clientId) || null;

      // Calculate time remaining
      let timeRemaining = 0;
      if (currentRound?.ends_at && table.status === 'running') {
        const endTime = new Date(currentRound.ends_at).getTime();
        const now = Date.now();
        timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
      }

      setState({
        table,
        participants,
        currentRound,
        suggestions,
        votes,
        blocks,
        currentParticipant,
        clientId,
        isHost,
        timeRemaining,
        loading: false,
        error: null,
      });

    } catch (error: any) {
      console.error('Error loading table data:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load table data',
      }));
    }
  }, [tableCode]);

  // Set up realtime subscriptions - trigger when table data is available
  useEffect(() => {
    if (!tableCode || !state.table?.id) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const tableId = state.table.id;
    tableIdRef.current = tableId;
    console.log('Setting up realtime channel for table:', tableId);

    // Create single channel per table
    const channel = supabase
      .channel(`table_${tableId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tables',
          filter: `id=eq.${tableId}`
        },
        (payload) => {
          console.log('📋 Tables change event:', payload.eventType, payload);
          trackRealtimeEvent('table_update');
          
          // Direct state update for table changes
          if (payload.new) {
            setState(prev => ({ ...prev, table: payload.new as any }));
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'participants',
          filter: `table_id=eq.${tableId}`
        },
        (payload) => {
          console.log('👥 Participants change event:', payload.eventType, payload);
          trackRealtimeEvent('participant_update');
          
          // Direct state update for participants
          if (payload.eventType === 'INSERT' && payload.new) {
            setState(prev => {
              const newParticipant = payload.new as any;
              const exists = prev.participants.some(p => p.id === newParticipant.id);
              if (!exists) {
                toast({
                  title: "New participant joined",
                  description: `${newParticipant.display_name} has joined the table`,
                });
                return {
                  ...prev,
                  participants: [...prev.participants, newParticipant],
                  currentParticipant: newParticipant.client_id === prev.clientId ? newParticipant : prev.currentParticipant
                };
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE' && payload.old) {
            setState(prev => ({
              ...prev,
              participants: prev.participants.filter(p => p.id !== (payload.old as any).id)
            }));
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setState(prev => ({
              ...prev,
              participants: prev.participants.map(p => p.id === (payload.new as any).id ? payload.new as any : p),
              currentParticipant: (payload.new as any).client_id === prev.clientId ? payload.new as any : prev.currentParticipant
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'rounds',
          filter: `table_id=eq.${tableId}`
        },
        (payload) => {
          console.log('🔄 Rounds change event:', payload.eventType, payload);
          trackRealtimeEvent('round_update');
          
          // Direct state update for rounds
          if (payload.new) {
            const newRound = payload.new as any;
            setState(prev => ({ ...prev, currentRound: newRound }));
            
            // Update round ref for immediate use
            const newRoundId = newRound.id;
            if (newRoundId && newRoundId !== currentRoundIdRef.current) {
              console.log('🔄 Round changed from', currentRoundIdRef.current, 'to', newRoundId);
              currentRoundIdRef.current = newRoundId;
              
              // Set up round subscriptions immediately
              if (roundSubscriptionsRef.current !== newRoundId) {
                console.log('🎯 Setting up round subscriptions for new round:', newRoundId);
                
                // Add suggestions subscription
                channel.on(
                  'postgres_changes',
                  { 
                    event: '*', 
                    schema: 'public', 
                    table: 'suggestions',
                    filter: `round_id=eq.${newRoundId}`
                  },
        (payload) => {
          console.log('💡 Suggestions change event:', payload.eventType, payload.table, payload);
          
          // Validate this is actually a suggestions table event
          if (payload.table !== 'suggestions') {
            console.warn('❌ Suggestions handler received event for wrong table:', payload.table);
            return;
          }
          
          trackRealtimeEvent('suggestion_update');
          
          if (payload.eventType === 'INSERT' && payload.new) {
            setState(prev => {
              const newSuggestion = payload.new as any;
              const exists = prev.suggestions.some(s => s.id === newSuggestion.id);
              if (!exists) {
                console.log('✅ Adding new suggestion to state:', newSuggestion.text);
                return { ...prev, suggestions: [...prev.suggestions, newSuggestion] };
              }
              return prev;
            });
          } else if (payload.eventType === 'UPDATE' && payload.new) {
            setState(prev => {
              const updatedSuggestion = payload.new as any;
              const existingIndex = prev.suggestions.findIndex(s => s.id === updatedSuggestion.id);
              if (existingIndex >= 0) {
                console.log('✅ Updating existing suggestion:', updatedSuggestion.text);
                const newSuggestions = [...prev.suggestions];
                newSuggestions[existingIndex] = updatedSuggestion;
                return { ...prev, suggestions: newSuggestions };
              } else {
                // Handle race condition: UPDATE received before INSERT
                console.log('✅ Adding suggestion via UPDATE (race condition):', updatedSuggestion.text);
                return { ...prev, suggestions: [...prev.suggestions, updatedSuggestion] };
              }
            });
          }
        }
                );
                
                // Add votes subscription
                channel.on(
                  'postgres_changes',
                  { 
                    event: '*', 
                    schema: 'public', 
                    table: 'votes',
                    filter: `round_id=eq.${newRoundId}`
                  },
        (payload) => {
          console.log('🗳️ Votes change event:', payload.eventType, payload.table, payload);
          
          // Validate this is actually a votes table event
          if (payload.table !== 'votes') {
            console.warn('❌ Votes handler received event for wrong table:', payload.table);
            return;
          }
          
          trackRealtimeEvent('vote_update');
          
          if (payload.eventType === 'INSERT' && payload.new) {
            setState(prev => {
              const newVote = payload.new as any;
              const exists = prev.votes.some(v => v.id === newVote.id);
              if (!exists) {
                console.log('✅ Adding new vote to state:', newVote);
                return { ...prev, votes: [...prev.votes, newVote] };
              }
              return prev;
            });
          }
        }
                );
                
                roundSubscriptionsRef.current = newRoundId;
                subscriptionStateRef.current.suggestions = true;
                subscriptionStateRef.current.votes = true;
                console.log('✅ Round subscriptions ready for round:', newRoundId);
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'blocks',
          filter: `table_id=eq.${tableId}`
        },
        (payload) => {
          console.log('🧱 Blocks change event:', payload.eventType, payload);
          trackRealtimeEvent('block_update');
          
          // Direct state update for blocks
          if (payload.eventType === 'INSERT' && payload.new) {
            setState(prev => {
              const newBlock = payload.new as any;
              const exists = prev.blocks.some(b => b.id === newBlock.id);
              return exists ? prev : { ...prev, blocks: [...prev.blocks, newBlock] };
            });
          }
        }
      );

    // Note: Round-specific subscriptions are now handled dynamically in the rounds handler above
    // No initial subscriptions to avoid duplicates

    // Subscribe to channel
    channel.subscribe((status) => {
      console.log('📡 Realtime subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to table changes');
        trackRealtimeEvent('subscription_ready');
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      roundSubscriptionsRef.current = null;
    };
  }, [tableCode, state.table?.id, trackRealtimeEvent, toast]);

  // Timer for countdown
  useEffect(() => {
    if (!state.currentRound?.ends_at || state.table?.status !== 'running') {
      return;
    }

    const updateTimer = () => {
      const endTime = new Date(state.currentRound!.ends_at!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      
      setState(prev => ({ ...prev, timeRemaining: remaining }));
    };

    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [state.currentRound?.ends_at, state.table?.status]);

  // Initial data load
  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  const currentPhase: PhaseType = (() => {
    if (!state.table || state.table.status === 'waiting') return 'lobby';
    if (!state.currentRound) return 'lobby';
    
    const status = state.currentRound.status;
    if (status === 'suggest') return 'suggest';
    if (status === 'vote') return 'vote';
    if (status === 'result') return 'result';
    
    return 'lobby';
  })();

  return {
    ...state,
    currentPhase,
    refresh: loadTableData,
    optimisticUpdate,
    logSubscriptionState
  };
}