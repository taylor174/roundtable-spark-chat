import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSuggestionsWithVotes, getWinningSuggestions, endRound, completeRoundAndAdvance } from '@/utils/roundLogic';
import { Table, Round, Suggestion, Vote } from '@/types';
import { isTimeExpired } from '@/utils';

export function usePhaseManager(
  table: Table | null,
  currentRound: Round | null,
  suggestions: Suggestion[],
  votes: Vote[],
  timeRemaining: number,
  clientId: string,
  onRefresh?: () => void
) {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!table || !currentRound || isProcessing || table.status !== 'running') {
      return;
    }

    // Check if we need to advance the phase
    const shouldAdvance = timeRemaining === 0 && currentRound.ends_at && isTimeExpired(currentRound.ends_at);
    
    if (!shouldAdvance) return;

    const handlePhaseAdvancement = async () => {
      setIsProcessing(true);
      
      try {
        if (currentRound.status === 'suggest') {
          // Move to voting phase if there are suggestions
          if (suggestions.length > 0) {
            const votingTime = table.default_vote_sec;
            const endsAt = new Date(Date.now() + votingTime * 1000).toISOString();
            
            await supabase
              .from('rounds')
              .update({
                status: 'vote',
                ends_at: endsAt,
              })
              .eq('id', currentRound.id);
          } else {
            // No suggestions, end the round
            await endRound(currentRound.id, table.id, 'No suggestions submitted');
          }
        } else if (currentRound.status === 'vote') {
          // Use atomic round completion with auto-advancement
          const result = await completeRoundAndAdvance(
            currentRound.id,
            table.id,
            currentRound.number,
            table.default_suggest_sec,
            clientId
          );
          
          if (!result) {
            // Either no suggestions/votes, or tie needs manual resolution
            // completeRoundAndAdvance already handled the database updates
            console.log('Round completed without auto-advancement (tie or no votes)');
          } else {
            console.log(`Round completed with winner: ${result.winner}. Next round started.`);
          }
        }

        onRefresh?.();
      } catch (error) {
        console.error('Error advancing phase:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    // Small delay to prevent race conditions
    const timeout = setTimeout(handlePhaseAdvancement, 1000);
    return () => clearTimeout(timeout);

  }, [table, currentRound, suggestions, votes, timeRemaining, clientId, isProcessing, onRefresh]);

  return { isProcessing };
}