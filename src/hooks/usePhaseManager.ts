import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSuggestionsWithVotes, getWinningSuggestions, endRound } from '@/utils/roundLogic';
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
          // Determine winner and move to results
          const suggestionsWithVotes = await getSuggestionsWithVotes(currentRound.id, clientId);
          const winningSuggestions = getWinningSuggestions(suggestionsWithVotes);
          
          if (winningSuggestions.length === 1) {
            // Clear winner, advance automatically
            await endRound(currentRound.id, table.id, winningSuggestions[0].text);
          } else if (winningSuggestions.length > 1) {
            // Tie - wait for host to break it
            await supabase
              .from('rounds')
              .update({ 
                status: 'result',
                ends_at: null 
              })
              .eq('id', currentRound.id);
          } else {
            // No votes, end round
            await endRound(currentRound.id, table.id, 'No votes received');
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