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
  const tableChannelRef = useRef<any>(null);
  const roundChannelRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentRoundIdRef = useRef<string | null>(null);

  // Clean optimistic updates
  const optimisticUpdate = useCallback((updates: Partial<TableState> | ((prev: TableState) => Partial<TableState>)) => {
    setState(prevState => {
      const newUpdates = typeof updates === 'function' ? updates(prevState) : updates;
      return { ...prevState, ...newUpdates };
    });
  }, []);

  // Load initial table data
  const loadTableData = useCallback(async () => {
    if (!tableCode) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Load table data
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('*')
        .eq('code', tableCode)
        .maybeSingle();

      if (tableError) throw tableError;
      if (!table) throw new Error('Table not found');

      // Load participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('table_id', table.id)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;
      const participants = participantsData || [];

      // Load current round - guard against null current_round_id
      let currentRound = null;
      if (table.current_round_id) {
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .select('*')
          .eq('id', table.current_round_id)
          .maybeSingle();

        if (roundError) throw roundError;
        currentRound = roundData;
      }

      currentRoundIdRef.current = currentRound?.id || null;

      // Load suggestions for current round
      let suggestions: any[] = [];
      if (currentRound) {
        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('suggestions')
          .select('*')
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true });

        if (suggestionsError) throw suggestionsError;
        suggestions = suggestionsData || [];
      }

      // Load votes for current round
      let votes: any[] = [];
      if (currentRound) {
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('*')
          .eq('round_id', currentRound.id)
          .order('created_at', { ascending: true });

        if (votesError) throw votesError;
        votes = votesData || [];
      }

      // Load blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .eq('table_id', table.id)
        .order('created_at', { ascending: true });

      if (blocksError) throw blocksError;
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

  // Setup Table Channel (always active for table, participants, blocks)
  useEffect(() => {
    if (!tableCode) return;

    const setupTableChannel = async () => {
      // Get table ID first
      const { data: table } = await supabase
        .from('tables')
        .select('id')
        .eq('code', tableCode)
        .maybeSingle();

      if (!table) return;

      // Clean up existing table channel
      if (tableChannelRef.current) {
        supabase.removeChannel(tableChannelRef.current);
      }

      console.log('🔌 Setting up table channel for:', table.id);

      const tableChannel = supabase
        .channel(`table_${table.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `id=eq.${table.id}`
        }, (payload) => {
          console.log('📋 Table update:', payload);
          if (payload.new) {
            const newTable = payload.new as any;
            setState(prev => {
              // Optimistic update for session start
              if (newTable.status === 'running' && prev.table?.status !== 'running') {
                console.log('🚀 Session started - optimistic update');
                optimisticUpdate({ table: newTable });
                // Trigger full reload to get current round
                setTimeout(() => loadTableData(), 100);
                return prev;
              }
              return { ...prev, table: newTable };
            });
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `table_id=eq.${table.id}`
        }, (payload) => {
          const newParticipant = payload.new as any;
          console.log('👤 Participant joined:', newParticipant.display_name);
          setState(prev => {
            const exists = prev.participants.some(p => p.id === newParticipant.id);
            if (!exists) {
              if (!newParticipant.is_host) {
                toast({
                  title: `${newParticipant.display_name} joined`,
                  description: "New participant joined the session",
                });
              }
              return {
                ...prev,
                participants: [...prev.participants, newParticipant],
                currentParticipant: newParticipant.client_id === prev.clientId ? newParticipant : prev.currentParticipant
              };
            }
            return prev;
          });
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'participants',
          filter: `table_id=eq.${table.id}`
        }, (payload) => {
          setState(prev => ({
            ...prev,
            participants: prev.participants.filter(p => p.id !== (payload.old as any).id)
          }));
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `table_id=eq.${table.id}`
        }, (payload) => {
          const updatedParticipant = payload.new as any;
          setState(prev => ({
            ...prev,
            participants: prev.participants.map(p => p.id === updatedParticipant.id ? updatedParticipant : p),
            currentParticipant: updatedParticipant.client_id === prev.clientId ? updatedParticipant : prev.currentParticipant
          }));
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `table_id=eq.${table.id}`
        }, (payload) => {
          console.log('🔄 Round update:', payload);
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newRound = payload.new as any;
            setState(prev => ({ ...prev, currentRound: newRound }));
            
            // Update round ref for round channel setup
            if (newRound.id !== currentRoundIdRef.current) {
              currentRoundIdRef.current = newRound.id;
            }
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'blocks',
          filter: `table_id=eq.${table.id}`
        }, (payload) => {
          const newBlock = payload.new as any;
          setState(prev => {
            const exists = prev.blocks.some(b => b.id === newBlock.id);
            return exists ? prev : { ...prev, blocks: [...prev.blocks, newBlock] };
          });
        })
        .subscribe();

      tableChannelRef.current = tableChannel;
    };

    setupTableChannel();

    return () => {
      if (tableChannelRef.current) {
        supabase.removeChannel(tableChannelRef.current);
        tableChannelRef.current = null;
      }
    };
  }, [tableCode, toast, optimisticUpdate, loadTableData]);

  // Setup Round Channel (dynamic based on current_round_id)
  useEffect(() => {
    const roundId = currentRoundIdRef.current;
    
    if (!roundId) {
      // Clean up round channel if no active round
      if (roundChannelRef.current) {
        console.log('🧹 Cleaning up round channel - no active round');
        supabase.removeChannel(roundChannelRef.current);
        roundChannelRef.current = null;
      }
      return;
    }

    // Clean up existing round channel before setting up new one
    if (roundChannelRef.current) {
      console.log('🧹 Cleaning up old round channel');
      supabase.removeChannel(roundChannelRef.current);
    }

    console.log('🎯 Setting up round channel for:', roundId);

    const roundChannel = supabase
      .channel(`round_${roundId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'suggestions',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        console.log('💡 Suggestion added:', payload);
        const newSuggestion = payload.new as any;
        setState(prev => {
          const exists = prev.suggestions.some(s => s.id === newSuggestion.id);
          if (!exists) {
            return { ...prev, suggestions: [...prev.suggestions, newSuggestion] };
          }
          return prev;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'suggestions',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        console.log('💡 Suggestion updated:', payload);
        const updatedSuggestion = payload.new as any;
        setState(prev => {
          const existingIndex = prev.suggestions.findIndex(s => s.id === updatedSuggestion.id);
          if (existingIndex >= 0) {
            const newSuggestions = [...prev.suggestions];
            newSuggestions[existingIndex] = updatedSuggestion;
            return { ...prev, suggestions: newSuggestions };
          } else {
            // Handle race condition: UPDATE received before INSERT
            return { ...prev, suggestions: [...prev.suggestions, updatedSuggestion] };
          }
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'votes',
        filter: `round_id=eq.${roundId}`
      }, (payload) => {
        console.log('🗳️ Vote added:', payload);
        const newVote = payload.new as any;
        setState(prev => {
          const exists = prev.votes.some(v => v.id === newVote.id);
          if (!exists) {
            return { ...prev, votes: [...prev.votes, newVote] };
          }
          return prev;
        });
      })
      .subscribe();

    roundChannelRef.current = roundChannel;

    return () => {
      if (roundChannelRef.current) {
        supabase.removeChannel(roundChannelRef.current);
        roundChannelRef.current = null;
      }
    };
  }, [currentRoundIdRef.current]);

  // Timer effect
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    const timer = setInterval(() => {
      setState(prevState => {
        if (!prevState.currentRound?.ends_at || prevState.table?.status !== 'running') {
          return prevState;
        }

        const endTime = new Date(prevState.currentRound.ends_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

        if (remaining !== prevState.timeRemaining) {
          return { ...prevState, timeRemaining: remaining };
        }
        return prevState;
      });
    }, 1000);

    timerRef.current = timer;

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state.currentRound?.ends_at, state.table?.status]);

  // Load initial data
  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  // Determine current phase
  const currentPhase: PhaseType = (() => {
    if (!state.table) return 'lobby';
    
    if (state.table.status === 'lobby' || state.table.status === 'waiting') {
      return 'lobby';
    }
    
    if (!state.currentRound) return 'lobby';
    
    if (state.currentRound.status === 'suggestions') return 'suggest';
    if (state.currentRound.status === 'voting') return 'vote';
    if (state.currentRound.status === 'results') return 'result';
    
    return 'lobby';
  })();

  return {
    ...state,
    currentPhase,
    refresh: loadTableData,
    optimisticUpdate,
  };
}