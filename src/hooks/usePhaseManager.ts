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
        
        if (import.meta.env.DEV) {
          console.log(`Round ${currentRound.number}: ${uniqueVoters.size}/${totalParticipants} participants voted`);
        }
        
        // End early if everyone has voted
        if (uniqueVoters.size >= totalParticipants && totalParticipants > 0) {
          if (import.meta.env.DEV) {
            console.log('All participants have voted - ending round early');
          }
          return true;
        }
      }
      
      return false;
    };

    // Check if we need to advance the phase
    const hasEndTime = !!currentRound.ends_at;
    const isExpired = hasEndTime && isTimeExpired(currentRound.ends_at);
    const shouldAdvanceTimer = timeRemaining <= 0 && hasEndTime && isExpired;
    
    // Special handling for first round - be more aggressive about checking
    const isFirstRound = currentRound.number === 1;
    
    const handlePhaseAdvancement = async () => {
      // Check if everyone has voted (for early termination)
      const everyoneVoted = await checkVotingCompletion();
      const shouldAdvance = shouldAdvanceTimer || everyoneVoted;
      
      if (!shouldAdvance) {
        return;
      }

      // Prevent processing the same round multiple times (unless retrying or everyone voted)
      if (lastProcessedRound === currentRound.id && retryCount === 0 && !everyoneVoted) {
        return;
      }

      // Single Authority Pattern: Prefer host, but allow any client after timeout
      // For first round, be more aggressive about processing
      const shouldProcess = isHost || timeRemaining <= -2 || everyoneVoted || (isFirstRound && timeRemaining <= -1);
      
      if (!shouldProcess && retryCount === 0) {
        return;
      }
      setIsProcessing(true);
      setLastProcessedRound(currentRound.id);
      
      try {
        // Try enhanced atomic server-side advancement first (v2)
        try {
          const { data, error } = await supabase.rpc('advance_phase_atomic_v2', {
            p_round_id: currentRound.id,
            p_table_id: table.id,
            p_client_id: clientId
          });

          if (error) throw error;
          const result = data as any;
          if (result?.success) {
            console.log('Enhanced atomic phase advancement successful:', result);
            
            // Handle automatic round advancement for clear winners
            if (result.action === 'completed_and_advanced') {
              console.log('Round automatically advanced to next round:', result.new_round_id);
              // Force immediate refresh to show new round
              setTimeout(() => {
                onRefresh?.();
              }, 1000);
            }
            
            return { success: true };
          } else {
            console.warn('Enhanced atomic advancement failed, falling back to client-side:', result?.error);
          }
        } catch (serverError) {
          console.warn('Enhanced atomic advancement error, falling back to client-side:', serverError);
        }

        // Fallback to client-side advancement with retry logic
        await withRetry(async () => {
          if (currentRound.status === 'suggest') {
            // Query database directly for accurate suggestion count
            const { data: dbSuggestions, error } = await supabase
              .from('suggestions')
              .select('id')
              .eq('round_id', currentRound.id);
            
            if (error) {
              throw error;
            }
            
            // Move to voting phase if there are suggestions in database
            if (dbSuggestions && dbSuggestions.length > 0) {
              await startVotePhase(currentRound.id, table.default_vote_sec, table.id);
            } else {
              // No suggestions, end the round and trigger refresh
              await endRound(currentRound.id, table.id, 'No suggestions submitted');
              await supabase
                .from('tables')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', table.id);
            }
          } else if (currentRound.status === 'vote') {
            // Double-check round is still in vote phase before processing
            const { data: freshRound } = await supabase
              .from('rounds')
              .select('status')
              .eq('id', currentRound.id)
              .single();
            
            if (freshRound?.status !== 'vote') {
              return;
            }
            
            // Complete the round and advance
            const result = await completeRoundAndAdvance(
              currentRound.id,
              table.id,
              currentRound.number,
              table.default_suggest_sec,
              clientId
            );
            
            if (!result) {
              // Ensure global refresh is triggered for ties/no votes
              await supabase
                .from('tables')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', table.id);
            }
          }
          
          return { success: true };
        }, {
          maxAttempts: 3,
          delay: 1000,
          backoffMultiplier: 2,
          retryCondition: (error) => 
            error?.message?.includes('network') || 
            error?.message?.includes('timeout') ||
            error?.message?.includes('constraint') ||
            error?.code === 'PGRST301' ||
            error?.code === 'PGRST116'
        });
        
        // Reset retry count on success
        setRetryCount(0);
        
        // Force a state refresh after phase change - longer delay to prevent flicker
        setTimeout(() => {
          onRefresh?.();
        }, 2500);
        
      } catch (error) {
        console.error(`Error advancing phase for round ${currentRound.id}:`, error);
        
        // Implement retry logic with exponential backoff
        const maxRetries = 3;
        if (retryCount < maxRetries) {
          // Reset processing state to allow retry
          setLastProcessedRound(null);
          setRetryCount(prev => prev + 1);
          
          // Schedule retry with exponential backoff
          setTimeout(() => {
            // This will trigger the useEffect again
          }, 2000 * (retryCount + 1));
        } else {
          // Reset everything on final failure
          setLastProcessedRound(null);
          setRetryCount(0);
        }
      } finally {
        setIsProcessing(false);
      }
    };

    // Shorter delays for faster transitions, even shorter for first round
    const delay = isFirstRound ? (isHost ? 250 : 750) : (isHost ? 500 : 1500);
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