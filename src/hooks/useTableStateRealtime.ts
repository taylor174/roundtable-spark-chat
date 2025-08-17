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

  // Track realtime events and set operation-specific fallback timer
  const trackRealtimeEvent = useCallback((eventType: string, operationType?: string) => {
    console.log(`✅ Realtime event received: ${eventType} (${operationType || 'general'})`);
    lastRealtimeEventRef.current = Date.now();
    
    // Clear existing fallback timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
    }
    
    // Set operation-specific fallback timeout
    fallbackTimerRef.current = setTimeout(() => {
      console.log(`⏰ Fallback triggered for ${operationType || 'general'}: No realtime events received`);
      loadTableData();
    }, 1500);
  }, []);

  const loadTableData = useCallback(async () => {
    if (!tableCode) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Load table data
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('code', tableCode)
        .single();

      if (tableError) throw tableError;
      if (!table) throw new Error('Table not found');

      tableIdRef.current = table.id;

      // Load participants
      const { data: participants = [], error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('table_id', table.id)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;

      // Load current round
      const { data: currentRound, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', table.current_round_id || '')
        .single();

      // If no current round, that's okay
      if (roundError && roundError.code !== 'PGRST116') {
        console.error('Round error:', roundError);
      }

      currentRoundIdRef.current = currentRound?.id || null;

      // Load suggestions for current round
      let suggestions = [];
      if (currentRound) {
        const { data: suggestionsData = [], error: suggestionsError } = await supabase
          .from('suggestions')
          .select('*')
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true });

        if (suggestionsError) throw suggestionsError;
        suggestions = suggestionsData;
      }

      // Load votes for current round
      let votes = [];
      if (currentRound) {
        const { data: votesData = [], error: votesError } = await supabase
          .from('votes')
          .select('*')
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true });

        if (votesError) throw votesError;
        votes = votesData;
      }

      // Load blocks
      const { data: blocks = [], error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .eq('table_id', table.id)
        .order('created_at', { ascending: true });

      if (blocksError) throw blocksError;

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

  // Set up realtime subscriptions
  useEffect(() => {
    if (!tableCode || !tableIdRef.current) return;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    console.log('Setting up realtime channel for table:', tableIdRef.current);

    // Create single channel per table
    const channel = supabase
      .channel(`table_${tableIdRef.current}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tables',
          filter: `id=eq.${tableIdRef.current}`
        },
        (payload) => {
          console.log('📋 Tables change event:', payload.eventType, payload);
          trackRealtimeEvent('table_update', 'table_change');
          
          // Broadcast phase transition for immediate UI updates
          if (payload.new && payload.old && 
              (payload.new as any).status && (payload.old as any).status && 
              (payload.new as any).status !== (payload.old as any).status) {
            channel.send({
              type: 'broadcast',
              event: 'phase_transition',
              payload: { 
                tableId: tableIdRef.current, 
                phase: (payload.new as any).status, 
                roundId: (payload.new as any).current_round_id 
              }
            });
          }
          
          loadTableData();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'participants',
          filter: `table_id=eq.${tableIdRef.current}`
        },
        (payload) => {
          console.log('👥 Participants change event:', payload.eventType, payload);
          trackRealtimeEvent('participant_update', 'participant_change');
          loadTableData();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'rounds',
          filter: `table_id=eq.${tableIdRef.current}`
        },
        (payload) => {
          console.log('🔄 Rounds change event:', payload.eventType, payload);
          trackRealtimeEvent('round_update', 'round_change');
          
          // Clean re-subscription for round-specific data
          const newRoundId = payload.new && (payload.new as any).id ? (payload.new as any).id : null;
          if (newRoundId && newRoundId !== currentRoundIdRef.current) {
            console.log('🔄 Round changed from', currentRoundIdRef.current, 'to', newRoundId);
            currentRoundIdRef.current = newRoundId;
            
            // Clean up existing round subscriptions and add new ones
            setupRoundSubscriptions(channel, newRoundId);
            
            // Broadcast round change
            channel.send({
              type: 'broadcast',
              event: 'round_change',
              payload: { tableId: tableIdRef.current, roundId: newRoundId }
            });
          }
          
          loadTableData();
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'blocks',
          filter: `table_id=eq.${tableIdRef.current}`
        },
        (payload) => {
          console.log('🧱 Blocks change event:', payload.eventType, payload);
          trackRealtimeEvent('block_update', 'block_change');
          loadTableData();
        }
      )
      .on('broadcast', { event: 'phase_transition' }, (payload) => {
        console.log('📢 Received phase transition broadcast:', payload);
        trackRealtimeEvent('phase_transition_broadcast', 'phase_transition');
      })
      .on('broadcast', { event: 'round_change' }, (payload) => {
        console.log('📢 Received round change broadcast:', payload);
        trackRealtimeEvent('round_change_broadcast', 'round_change');
      });

    // Function to set up round-specific subscriptions
    const setupRoundSubscriptions = (channel: any, roundId: string) => {
      if (!roundId) return;
      
      console.log('🎯 Setting up round-specific subscriptions for round:', roundId);
      
      // Add suggestions subscription with INSERT and UPDATE handling
      channel.on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'suggestions',
          filter: `round_id=eq.${roundId}`
        },
        (payload) => {
          console.log('💡 Suggestions change event:', payload.eventType, payload);
          trackRealtimeEvent('suggestion_update', 'suggestion_change');
          loadTableData();
        }
      );
      
      // Add votes subscription with INSERT and UPDATE handling
      channel.on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'votes',
          filter: `round_id=eq.${roundId}`
        },
        (payload) => {
          console.log('🗳️ Votes change event:', payload.eventType, payload);
          trackRealtimeEvent('vote_update', 'vote_change');
          loadTableData();
        }
      );
      
      subscriptionStateRef.current.suggestions = true;
      subscriptionStateRef.current.votes = true;
    };

    // Set up initial round subscriptions if we have a current round
    if (currentRoundIdRef.current) {
      setupRoundSubscriptions(channel, currentRoundIdRef.current);
    }

    // Subscribe to channel
    channel.subscribe((status) => {
      console.log('📡 Realtime subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to table changes');
        subscriptionStateRef.current.tables = true;
        subscriptionStateRef.current.participants = true;
        subscriptionStateRef.current.rounds = true;
        subscriptionStateRef.current.blocks = true;
        trackRealtimeEvent('subscription_ready', 'initial_subscribe');
        logSubscriptionState();
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [tableCode, loadTableData, trackRealtimeEvent]);

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