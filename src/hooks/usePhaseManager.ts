import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSuggestionsWithVotes, startVotePhase, endRound, completeRoundAndAdvance } from '@/utils/roundLogic';
import { Table, Round, Suggestion, Vote } from '@/types';
import { isTimeExpired } from '@/utils';

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
        
        console.log(`Round ${currentRound.number}: ${uniqueVoters.size}/${totalParticipants} participants voted`);
        
        // End early if everyone has voted
        if (uniqueVoters.size >= totalParticipants && totalParticipants > 0) {
          console.log('All participants have voted - ending round early');
          return true;
        }
      }
      
      return false;
    };

    // Check if we need to advance the phase
    const hasEndTime = !!currentRound.ends_at;
    const isExpired = hasEndTime && isTimeExpired(currentRound.ends_at);
    const shouldAdvanceTimer = timeRemaining <= 0 && hasEndTime && isExpired;
    
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
      const shouldProcess = isHost || timeRemaining <= -2 || everyoneVoted; // Allow early processing if everyone voted
      
      if (!shouldProcess && retryCount === 0) {
        return;
      }
      setIsProcessing(true);
      setLastProcessedRound(currentRound.id);
      
      try {
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
        
        // Reset retry count on success
        setRetryCount(0);
        
        // Force a state refresh after phase change
        setTimeout(() => {
          onRefresh?.();
        }, 1000);
        
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

    // Shorter delays for faster transitions
    const timeout = setTimeout(handlePhaseAdvancement, isHost ? 500 : 1500);
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