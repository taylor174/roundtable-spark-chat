import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSuggestionsWithVotes, startVotePhase, endRound, completeRoundAndAdvance } from '@/utils/roundLogic';
import { Table, Round, Suggestion, Vote } from '@/types';
import { isTimeExpired } from '@/utils';
import { withRetry } from '@/utils/retryLogic';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export function usePhaseManager(
  table: Table | null,
  currentRound: Round | null,
  suggestions: Suggestion[],
  votes: Vote[],
  timeRemaining: number,
  clientId: string,
  isHost: boolean,
  onRefresh?: () => void,
  participants: any[] = []
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedRound, setLastProcessedRound] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { handleAsyncOperation } = useErrorHandler();

  useEffect(() => {
    if (!table || !currentRound || isProcessing || table.status !== 'running') {
      return;
    }

    // Only process if we're the host for more reliable phase management
    if (!isHost) {
      return;
    }

    // Reset retry count when round changes
    if (lastProcessedRound !== currentRound.id) {
      setRetryCount(0);
    }

    const checkVotingCompletion = async () => {
      // For voting phase, check if all participants have voted
      if (currentRound.status === 'vote') {
        const { data: roundVotes } = await supabase
          .from('votes')
          .select('participant_id')
          .eq('round_id', currentRound.id);
        
        const uniqueVoters = new Set(roundVotes?.map(v => v.participant_id) || []);
        const totalParticipants = participants.length;
        
        console.log('Vote completion check:', { 
          uniqueVoters: uniqueVoters.size, 
          totalParticipants,
          roundId: currentRound.id 
        });
        
        // End early if everyone has voted
        if (uniqueVoters.size >= totalParticipants && totalParticipants > 0) {
          return true;
        }
      }
      
      return false;
    };

    // Check if we need to advance the phase
    const hasEndTime = !!currentRound.ends_at;
    const isExpired = hasEndTime && isTimeExpired(currentRound.ends_at);
    const shouldAdvanceTimer = timeRemaining <= 0 && hasEndTime;
    
    const handlePhaseAdvancement = async () => {
      // Check if everyone has voted (for early termination)
      const everyoneVoted = await checkVotingCompletion();
      const shouldAdvance = shouldAdvanceTimer || everyoneVoted;
      
      console.log('Phase advancement check:', {
        shouldAdvanceTimer,
        everyoneVoted,
        shouldAdvance,
        timeRemaining,
        hasEndTime,
        roundStatus: currentRound.status,
        roundId: currentRound.id
      });
      
      if (!shouldAdvance) {
        return;
      }

      // Prevent processing the same round multiple times
      if (lastProcessedRound === currentRound.id && retryCount === 0 && !everyoneVoted) {
        console.log('Skipping duplicate processing for round:', currentRound.id);
        return;
      }

      console.log('Starting phase advancement for round:', currentRound.id);
      setIsProcessing(true);
      setLastProcessedRound(currentRound.id);
      
      try {
        // Use the enhanced atomic server-side advancement
        const { data, error } = await supabase.rpc('advance_phase_atomic_v2', {
          p_round_id: currentRound.id,
          p_table_id: table.id,
          p_client_id: clientId
        });

        if (error) {
          console.error('Phase advancement RPC error:', error);
          throw error;
        }

        const result = data as any;
        console.log('Phase advancement result:', result);
        
        if (result?.success) {
          // Reset retry count on success
          setRetryCount(0);
          
          // Trigger refresh after successful advancement
          setTimeout(() => {
            onRefresh?.();
          }, 200);
          
          return { success: true };
        } else {
          throw new Error(result?.error || 'Phase advancement failed');
        }

      } catch (error) {
        console.error(`Error advancing phase for round ${currentRound.id}:`, error);
        
        // Implement retry logic with exponential backoff
        const maxRetries = 2;
        if (retryCount < maxRetries) {
          // Reset processing state to allow retry
          setLastProcessedRound(null);
          setRetryCount(prev => prev + 1);
          
          console.log(`Retrying phase advancement, attempt ${retryCount + 1}`);
          
          // Schedule retry with backoff
          setTimeout(() => {
            setIsProcessing(false); // Allow retry
          }, 1000 * (retryCount + 1));
        } else {
          // Reset everything on final failure
          setLastProcessedRound(null);
          setRetryCount(0);
          console.error('Max retries reached for phase advancement');
        }
      } finally {
        if (retryCount === 0) {
          // Only reset if not retrying
          setIsProcessing(false);
        }
      }
    };

    // Immediate execution for hosts, slight delay for participants
    const delay = isHost ? 100 : 500;
    const timeout = setTimeout(handlePhaseAdvancement, delay);
    return () => clearTimeout(timeout);

  }, [table, currentRound, suggestions, votes, timeRemaining, clientId, isHost, isProcessing, lastProcessedRound, retryCount, onRefresh]);

  // Safety mechanism: Reset stuck processing state after 30 seconds
  useEffect(() => {
    if (isProcessing) {
      const timeout = setTimeout(() => {
        setIsProcessing(false);
        setLastProcessedRound(null);
        setRetryCount(0);
      }, 30000); // 30 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [isProcessing]);

  return { isProcessing };
}