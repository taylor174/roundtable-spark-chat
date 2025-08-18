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
  onRefresh?: () => void
) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedRound, setLastProcessedRound] = useState<string | null>(null);

  useEffect(() => {
    if (!table || !currentRound || isProcessing || table.status !== 'running') {
      return;
    }

    // Prevent processing the same round multiple times
    if (lastProcessedRound === currentRound.id) {
      return;
    }

    // Check if we need to advance the phase
    const shouldAdvance = timeRemaining === 0 && currentRound.ends_at && isTimeExpired(currentRound.ends_at);
    
    if (!shouldAdvance) return;

    // Single Authority Pattern: Prefer host, but allow any client after timeout
    const shouldProcess = isHost || timeRemaining <= -5; // 5 second fallback for non-hosts
    
    if (!shouldProcess) return;

    const handlePhaseAdvancement = async () => {
      setIsProcessing(true);
      setLastProcessedRound(currentRound.id);
      
      try {
        if (currentRound.status === 'suggest') {
          // Move to voting phase if there are suggestions
          if (suggestions.length > 0) {
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
          // Check if there are any votes before completing
          if (votes.length === 0) {
            await endRound(currentRound.id, table.id, 'No votes cast');
            await supabase
              .from('tables')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', table.id);
          } else {
            // Use atomic round completion with auto-advancement
            const result = await completeRoundAndAdvance(
              currentRound.id,
              table.id,
              currentRound.number,
              table.default_suggest_sec,
              clientId
            );
            
            if (!result) {
              // Tie needs manual resolution
              // Ensure global refresh is triggered even for ties
              await supabase
                .from('tables')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', table.id);
              console.log('Round completed without auto-advancement (tie needs manual resolution)');
            } else {
              console.log(`Round completed with winner: ${result.winner}. Next round started.`);
            }
          }
        }

        // Force a state refresh after phase change
        setTimeout(() => {
          onRefresh?.();
        }, 500);
        
      } catch (error) {
        console.error('Error advancing phase:', error);
        // Reset to allow retry
        setLastProcessedRound(null);
      } finally {
        setIsProcessing(false);
      }
    };

    // Small delay to prevent race conditions and allow for authority coordination
    const timeout = setTimeout(handlePhaseAdvancement, isHost ? 500 : 2000);
    return () => clearTimeout(timeout);

  }, [table, currentRound, suggestions, votes, timeRemaining, clientId, isHost, isProcessing, lastProcessedRound, onRefresh]);

  return { isProcessing };
}