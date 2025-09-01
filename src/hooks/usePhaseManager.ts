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
        
        // End early if everyone has voted
        if (uniqueVoters.size >= totalParticipants && totalParticipants > 0) {
          return true;
        }
      }
      
      return false;
    };

    // Improved timing checks with better safeguards
    const hasEndTime = !!currentRound.ends_at;
    const isExpired = hasEndTime && isTimeExpired(currentRound.ends_at);
    const shouldAdvanceTimer = timeRemaining <= 0 && hasEndTime;
    
    // Safety check: Prevent advancing too soon after round creation
    const roundAge = currentRound.started_at ? 
      Date.now() - new Date(currentRound.started_at).getTime() : 0;
    const minRoundAge = 10000; // 10 seconds minimum
    
    // Additional safety: Check if timer is actually expired (not just showing 0)
    const actualTimeRemaining = hasEndTime ? 
      Math.max(0, new Date(currentRound.ends_at!).getTime() - Date.now()) : 0;
    const isActuallyExpired = actualTimeRemaining <= 5000; // 5 second buffer
    const isRoundTooYoung = roundAge < minRoundAge;
    
    // Don't advance if ends_at is null or undefined (invalid state)
    if (!hasEndTime) {
      console.log('⏰ Round has no end time, not advancing:', currentRound.id);
      return;
    }
    
    // Log timing information for debugging
    console.log('⏰ Phase timing check:', {
      roundId: currentRound.id,
      status: currentRound.status,
      timeRemaining,
      isExpired,
      shouldAdvanceTimer,
      isRoundTooYoung,
      roundAge: Math.floor(roundAge / 1000) + 's',
      endsAt: currentRound.ends_at
    });
    
    const handlePhaseAdvancement = async () => {
      // Don't advance if round is too young
      if (isRoundTooYoung) {
        console.log('⏰ Round too young to advance, waiting...', Math.floor(roundAge / 1000) + 's');
        return;
      }
      
      // Check if everyone has voted (for early termination)
      const everyoneVoted = await checkVotingCompletion();
      
      // More robust advancement conditions
      const shouldAdvance = (shouldAdvanceTimer && isActuallyExpired) || everyoneVoted;
      
      if (!shouldAdvance) {
        return;
      }

      // Prevent processing the same round multiple times
      if (lastProcessedRound === currentRound.id && retryCount === 0 && !everyoneVoted) {
        console.log('⏰ Already processed this round, skipping:', currentRound.id);
        return;
      }

      
      setIsProcessing(true);
      setLastProcessedRound(currentRound.id);
      
      try {
        // Use the enhanced atomic server-side advancement
        console.log('🔄 Attempting phase advancement:', {
          roundId: currentRound.id,
          tableId: table.id,
          currentStatus: currentRound.status,
          reason: everyoneVoted ? 'everyone_voted' : 'timer_expired'
        });
        
        const { data, error } = await supabase.rpc('advance_phase_atomic_v2', {
          p_round_id: currentRound.id,
          p_table_id: table.id,
          p_client_id: clientId
        });

        if (error) {
          console.error('❌ Phase advancement RPC error:', error);
          throw error;
        }

        const result = data as any;
        console.log('✅ Phase advancement result:', result);
        
        if (result?.success) {
          // Reset retry count on success
          setRetryCount(0);
          
          // Trigger refresh after successful advancement
          setTimeout(() => {
            onRefresh?.();
          }, 300); // Slightly longer delay for better sync
          
          return { success: true };
        } else {
          // Log the specific error from the database function
          console.warn('⚠️ Phase advancement blocked:', result?.error);
          
          // If it's a "too young" or "not expired" error, don't treat as failure
          if (result?.error?.includes('too young') || result?.error?.includes('not expired')) {
            return { success: true }; // Don't retry these
          }
          
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

  }, [table?.current_round_id, currentRound?.status, currentRound?.id, timeRemaining, isHost, participants.length]);

  // Safety mechanism: Reset stuck processing state after 15 seconds
  useEffect(() => {
    if (isProcessing) {
      const timeout = setTimeout(() => {
        // Phase manager processing timeout - resetting state
        setIsProcessing(false);
        setLastProcessedRound(null);
        setRetryCount(0);
      }, 15000); // 15 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [isProcessing]);

  return { isProcessing };
}