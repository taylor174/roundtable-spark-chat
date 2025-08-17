import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TableState, PhaseType } from '@/types';
import { getOrCreateClientId, getHostSecret } from '@/utils/clientId';

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

  const channelRef = useRef<any>(null);

  // Load initial data
  const loadTableData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Get table
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('code', tableCode)
        .maybeSingle();

      if (tableError || !table) {
        setState(prev => ({ ...prev, error: 'Table not found', loading: false }));
        return;
      }

      // Get participants
      const { data: participants = [] } = await supabase
        .from('participants')
        .select('*')
        .eq('table_id', table.id)
        .order('joined_at', { ascending: true });

      // Get current round
      let currentRound = null;
      if (table.current_round_id) {
        const { data: roundData } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', table.current_round_id)
          .maybeSingle();
        currentRound = roundData;
      }

      // Get suggestions, votes, and blocks for current round
      let suggestions: any[] = [];
      let votes: any[] = [];
      let blocks: any[] = [];

      if (currentRound) {
        const [suggestionsResult, votesResult, blocksResult] = await Promise.all([
          supabase.from('suggestions').select('*').eq('round_id', currentRound.id).order('created_at', { ascending: true }),
          supabase.from('votes').select('*').eq('round_id', currentRound.id).order('created_at', { ascending: true }),
          supabase.from('blocks').select('*').eq('round_id', currentRound.id).order('created_at', { ascending: true }),
        ]);

        suggestions = suggestionsResult.data || [];
        votes = votesResult.data || [];
        blocks = blocksResult.data || [];
      }

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

      console.log('✅ Initial data loaded:', { 
        table: table.title, 
        participants: participants.length,
        round: currentRound?.number,
        suggestions: suggestions.length,
        votes: votes.length 
      });

    } catch (error) {
      console.error('❌ Error loading table data:', error);
      setState(prev => ({ ...prev, error: 'Failed to load table data', loading: false }));
    }
  }, [tableCode]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!tableCode) return;

    console.log('🔄 Setting up real-time subscriptions for table code:', tableCode);

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel - use table code initially, will update with ID later
    const channel = supabase.channel(`table-code-${tableCode}`, {
      config: { presence: { key: state.clientId } }
    });

    // Function to set up table-specific subscriptions when we have the table ID
    const setupTableSubscriptions = (tableId: string) => {
      console.log('📋 Setting up table subscriptions for ID:', tableId);

      // Subscribe to table changes
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tables',
        filter: `id=eq.${tableId}`
      }, (payload) => {
        console.log('📋 Table update:', payload);
        if (payload.new) {
          setState(prev => ({ ...prev, table: payload.new as any }));
        }
      });

      // Subscribe to participants
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        console.log('👥 Participants update:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          setState(prev => {
            const exists = prev.participants.some(p => p.id === payload.new.id);
            if (!exists) {
              return { 
                ...prev, 
                participants: [...prev.participants, payload.new as any],
                currentParticipant: (payload.new as any).client_id === prev.clientId ? payload.new as any : prev.currentParticipant
              };
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setState(prev => ({
            ...prev,
            participants: prev.participants.filter(p => p.id !== payload.old.id)
          }));
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setState(prev => ({
            ...prev,
            participants: prev.participants.map(p => 
              p.id === payload.new.id ? payload.new as any : p
            ),
            currentParticipant: (payload.new as any).client_id === prev.clientId ? payload.new as any : prev.currentParticipant
          }));
        }
      });

      // Subscribe to rounds
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `table_id=eq.${tableId}`
      }, (payload) => {
        console.log('🎯 Round update:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          setState(prev => ({ 
            ...prev, 
            currentRound: payload.new as any,
            suggestions: [], // Clear suggestions for new round
            votes: [], // Clear votes for new round
            blocks: [] // Clear blocks for new round
          }));
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setState(prev => ({ ...prev, currentRound: payload.new as any }));
        }
      });
    };

    // Function to set up round-specific subscriptions
    const setupRoundSubscriptions = (roundId: string) => {
      console.log('🎯 Setting up round subscriptions for ID:', roundId);

      // Subscribe to suggestions for current round
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'suggestions',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        console.log('💡 Suggestion update:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          setState(prev => {
            const exists = prev.suggestions.some(s => s.id === payload.new.id);
            if (!exists) {
              console.log('✅ Adding new suggestion:', payload.new.text);
              return { ...prev, suggestions: [...prev.suggestions, payload.new as any] };
            }
            return prev;
          });
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          setState(prev => ({
            ...prev,
            suggestions: prev.suggestions.map(s => 
              s.id === payload.new.id ? payload.new as any : s
            )
          }));
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setState(prev => ({
            ...prev,
            suggestions: prev.suggestions.filter(s => s.id !== payload.old.id)
          }));
        }
      });

      // Subscribe to votes for current round
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'votes',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        console.log('🗳️ Vote update:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          setState(prev => {
            const exists = prev.votes.some(v => v.id === payload.new.id);
            if (!exists) {
              console.log('✅ Adding new vote');
              return { ...prev, votes: [...prev.votes, payload.new as any] };
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setState(prev => ({
            ...prev,
            votes: prev.votes.filter(v => v.id !== payload.old.id)
          }));
        }
      });

      // Subscribe to blocks for current round
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'blocks',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        console.log('🚫 Block update:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new) {
          setState(prev => {
            const exists = prev.blocks.some(b => b.id === payload.new.id);
            if (!exists) {
              return { ...prev, blocks: [...prev.blocks, payload.new as any] };
            }
            return prev;
          });
        }
      });
    };

    // Set up subscriptions when we have the data
    if (state.table?.id) {
      setupTableSubscriptions(state.table.id);
    }
    if (state.currentRound?.id) {
      setupRoundSubscriptions(state.currentRound.id);
    }

    // Subscribe to channel
    channel.subscribe((status) => {
      console.log('📡 Subscription status:', status);
      
      // Set up subscriptions when channel is ready and we have data
      if (status === 'SUBSCRIBED') {
        if (state.table?.id) {
          console.log('🔄 Channel subscribed, setting up table subscriptions');
          setupTableSubscriptions(state.table.id);
        }
        if (state.currentRound?.id) {
          console.log('🔄 Channel subscribed, setting up round subscriptions');
          setupRoundSubscriptions(state.currentRound.id);
        }
      }
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tableCode, state.table?.id, state.currentRound?.id, state.clientId]);

  // Timer effect
  useEffect(() => {
    if (!state.currentRound?.ends_at || state.table?.status !== 'running') {
      setState(prev => ({ ...prev, timeRemaining: 0 }));
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const endTime = new Date(state.currentRound!.ends_at!).getTime();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setState(prev => ({ ...prev, timeRemaining: remaining }));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [state.currentRound?.ends_at, state.table?.status]);

  // Load data on mount
  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  // Determine current phase
  const currentPhase: PhaseType = (() => {
    if (!state.table || !state.currentRound) return 'lobby';
    if (state.table.status === 'waiting') return 'lobby';
    if (state.currentRound.status === 'suggestions') return 'suggest';
    if (state.currentRound.status === 'voting') return 'vote';
    if (state.currentRound.status === 'results') return 'result';
    return 'lobby';
  })();

  // Optimistic update function
  const optimisticUpdate = useCallback((updates: Partial<TableState> | ((prev: TableState) => Partial<TableState>)) => {
    setState(prev => {
      const newUpdates = typeof updates === 'function' ? updates(prev) : updates;
      console.log('⚡ Optimistic update applied:', newUpdates);
      return { ...prev, ...newUpdates };
    });
  }, []);

  return {
    state,
    currentPhase,
    refresh: loadTableData,
    optimisticUpdate,
  };
}