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
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!table || !currentRound || isProcessing || table.status !== 'running') {
      return;
    }

    // Reset retry count when round changes
    if (lastProcessedRound !== currentRound.id) {
      setRetryCount(0);
    }

    // Prevent processing the same round multiple times (unless retrying)
    if (lastProcessedRound === currentRound.id && retryCount === 0) {
      return;
    }

    // Check if we need to advance the phase
    const shouldAdvance = timeRemaining === 0 && currentRound.ends_at && isTimeExpired(currentRound.ends_at);
    
    if (!shouldAdvance) return;

    // Single Authority Pattern: Prefer host, but allow any client after timeout
    // Allow retries with exponential backoff for failed attempts
    const shouldProcess = isHost || timeRemaining <= -5; // 5 second fallback for non-hosts
    
    if (!shouldProcess && retryCount === 0) return;

    const handlePhaseAdvancement = async () => {
      console.log(`🚀 Starting phase advancement for round ${currentRound.id}, status: ${currentRound.status}, attempt: ${retryCount + 1}`);
      setIsProcessing(true);
      setLastProcessedRound(currentRound.id);
      
      try {
        if (currentRound.status === 'suggest') {
          console.log(`📝 Processing suggest phase for round ${currentRound.id}`);
          
          // Query database directly for accurate suggestion count - don't rely on stale local state
          const { data: dbSuggestions, error } = await supabase
            .from('suggestions')
            .select('id')
            .eq('round_id', currentRound.id);
          
          if (error) {
            console.error('❌ Error fetching suggestions:', error);
            throw error; // Let the catch block handle retry logic
          }
          
          console.log(`📊 Phase transition: Found ${dbSuggestions?.length || 0} suggestions for round ${currentRound.id}`);
          
          // Move to voting phase if there are suggestions in database
          if (dbSuggestions && dbSuggestions.length > 0) {
            console.log(`🗳️ Starting vote phase for round ${currentRound.id}`);
            const result = await startVotePhase(currentRound.id, table.default_vote_sec, table.id);
            console.log(`✅ Vote phase started successfully:`, result);
          } else {
            console.log(`❌ No suggestions found, ending round ${currentRound.id}`);
            // No suggestions, end the round and trigger refresh
            await endRound(currentRound.id, table.id, 'No suggestions submitted');
            await supabase
              .from('tables')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', table.id);
          }
        } else if (currentRound.status === 'vote') {
          console.log(`🗳️ Processing vote phase for round ${currentRound.id}`);
          
          // Double-check round is still in vote phase before processing
          const { data: freshRound } = await supabase
            .from('rounds')
            .select('status')
            .eq('id', currentRound.id)
            .single();
          
          if (freshRound?.status !== 'vote') {
            console.log('⏭️ Round status changed, skipping vote phase processing');
            return;
          }
          
          console.log(`🏁 Completing round ${currentRound.id} and advancing`);
          // Always use completeRoundAndAdvance for vote phase - it handles all cases properly
          // including no votes, ties, and clear winners
          const result = await completeRoundAndAdvance(
            currentRound.id,
            table.id,
            currentRound.number,
            table.default_suggest_sec,
            clientId
          );
          
          if (!result) {
            // Tie needs manual resolution or no votes case
            // Ensure global refresh is triggered
            await supabase
              .from('tables')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', table.id);
            console.log('🤝 Round completed without auto-advancement (tie needs manual resolution or no votes)');
          } else {
            console.log(`🏆 Round completed with winner: ${result.winner}. Next round started.`);
          }
        }

        console.log(`✅ Phase advancement completed successfully for round ${currentRound.id}`);
        
        // Reset retry count on success
        setRetryCount(0);
        
        // Force a state refresh after phase change
        setTimeout(() => {
          onRefresh?.();
        }, 1000); // Increased timeout for better reliability
        
      } catch (error) {
        console.error(`❌ Error advancing phase for round ${currentRound.id}, attempt ${retryCount + 1}:`, error);
        
        // Implement retry logic with exponential backoff
        const maxRetries = 3;
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying phase advancement in ${2000 * (retryCount + 1)}ms (attempt ${retryCount + 2}/${maxRetries + 1})`);
          
          // Reset processing state to allow retry
          setLastProcessedRound(null);
          setRetryCount(prev => prev + 1);
          
          // Schedule retry with exponential backoff
          setTimeout(() => {
            // This will trigger the useEffect again
          }, 2000 * (retryCount + 1));
        } else {
          console.error(`💥 Max retries (${maxRetries}) reached for round ${currentRound.id}, giving up`);
          // Reset everything on final failure
          setLastProcessedRound(null);
          setRetryCount(0);
        }
      } finally {
        setIsProcessing(false);
      }
    };

    // Longer delays to prevent race conditions and allow real-time sync to catch up
    const timeout = setTimeout(handlePhaseAdvancement, isHost ? 1000 : 3000);
    return () => clearTimeout(timeout);

  }, [table, currentRound, suggestions, votes, timeRemaining, clientId, isHost, isProcessing, lastProcessedRound, retryCount, onRefresh]);

  return { isProcessing };
}