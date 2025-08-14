import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { advanceRound, getWinningProposals, getProposalsWithVotes } from '@/utils/roundLogic';
import { Table, Round, Proposal, Vote } from '@/types';
import { isTimeExpired } from '@/utils';

export function usePhaseManager(
  table: Table | null,
  currentRound: Round | null,
  proposals: Proposal[],
  votes: Vote[],
  timeRemaining: number,
  onRefresh?: () => void
) {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!table || !currentRound || isProcessing || table.status !== 'active') {
      return;
    }

    // Check if we need to advance the phase
    const shouldAdvance = timeRemaining === 0 && table.phase_ends_at && isTimeExpired(table.phase_ends_at);
    
    if (!shouldAdvance) return;

    const handlePhaseAdvancement = async () => {
      setIsProcessing(true);
      
      try {
        if (currentRound.status === 'suggestions') {
          // Move to voting phase if there are proposals
          if (proposals.length > 0) {
            await advanceRound(table.id, currentRound);
          } else {
            // No proposals, end the round
            await supabase
              .from('rounds')
              .update({ 
                status: 'results',
                ended_at: new Date().toISOString(),
              })
              .eq('id', currentRound.id);

            await supabase
              .from('tables')
              .update({ phase_ends_at: null })
              .eq('id', table.id);
          }
        } else if (currentRound.status === 'voting') {
          // Determine winner and move to results
          const proposalsWithVotes = getProposalsWithVotes(proposals, votes);
          const winningProposals = getWinningProposals(proposalsWithVotes);
          
          if (winningProposals.length === 1) {
            // Clear winner, advance automatically
            await advanceRound(table.id, currentRound, winningProposals[0].id);
          } else if (winningProposals.length > 1) {
            // Tie - wait for host to break it
            await supabase
              .from('rounds')
              .update({ status: 'results' })
              .eq('id', currentRound.id);

            await supabase
              .from('tables')
              .update({ phase_ends_at: null })
              .eq('id', table.id);
          } else {
            // No votes, end round
            await supabase
              .from('rounds')
              .update({ 
                status: 'results',
                ended_at: new Date().toISOString(),
              })
              .eq('id', currentRound.id);

            await supabase
              .from('tables')
              .update({ phase_ends_at: null })
              .eq('id', table.id);
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

  }, [table, currentRound, proposals, votes, timeRemaining, isProcessing, onRefresh]);

  return { isProcessing };
}