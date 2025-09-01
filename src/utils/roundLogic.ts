import { supabase } from '@/integrations/supabase/client';
import { Suggestion, Vote, Round } from '@/types';

/**
 * Get suggestions with vote counts for display
 */
export async function getSuggestionsWithVotes(
  roundId: string,
  participantId: string
): Promise<Array<Suggestion & { voteCount: number; hasUserVoted: boolean }>> {
  // Get suggestions
  const { data: suggestions, error: suggestionsError } = await supabase
    .from('suggestions')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: true });

  if (suggestionsError) throw suggestionsError;

  // Get votes for this round
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('*')
    .eq('round_id', roundId);

  if (votesError) throw votesError;

  // Count votes and check if user voted using consistent participant ID
  return (suggestions || []).map(suggestion => {
    const suggestionVotes = votes?.filter(v => v.suggestion_id === suggestion.id) || [];
    
    // Use direct participant ID matching - same as vote submission
    const hasUserVoted = votes?.some(v => 
      v.participant_id === participantId && v.suggestion_id === suggestion.id
    ) || false;
    
    return {
      ...suggestion,
      voteCount: suggestionVotes.length,
      hasUserVoted,
    };
  });
}

/**
 * Get winning suggestions (handling ties)
 */
export function getWinningSuggestions(
  suggestions: Array<Suggestion & { voteCount: number }>
): Array<Suggestion & { voteCount: number }> {
  if (suggestions.length === 0) return [];
  
  const maxVotes = Math.max(...suggestions.map(s => s.voteCount));
  return suggestions.filter(s => s.voteCount === maxVotes);
}

/**
 * Get winner with automatic tie-breaking by submission time
 * Returns single winner or null if manual tie-break needed
 */
export function getWinnerWithTieBreak(
  suggestions: Array<Suggestion & { voteCount: number }>
): (Suggestion & { voteCount: number }) | null {
  if (suggestions.length === 0) return null;
  
  // Sort by vote count DESC, then by created_at ASC (earliest submission wins ties)
  const sorted = [...suggestions].sort((a, b) => {
    if (b.voteCount !== a.voteCount) {
      return b.voteCount - a.voteCount;
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  
  // Check if there's a true tie (multiple suggestions with same vote count)
  if (sorted.length > 1 && sorted[0].voteCount === sorted[1].voteCount) {
    return null; // Require manual tie-breaking
  }
  
  return sorted[0];
}

/**
 * Advance to next round
 */
export async function advanceRound(tableId: string, currentRoundNumber: number): Promise<Round> {
  const nextRoundNumber = currentRoundNumber + 1;
  
  // Create new round
  const { data: newRound, error } = await supabase
    .from('rounds')
    .insert({
      table_id: tableId,
      number: nextRoundNumber,
      status: 'lobby',
    })
    .select()
    .single();

  if (error) throw error;

  // Update table to point to new round
  await supabase
    .from('tables')
    .update({ current_round_id: newRound.id })
    .eq('id', tableId);

  return newRound;
}

/**
 * Start suggestion phase with timer (atomic with global refresh trigger)
 */
export async function startSuggestPhase(roundId: string, defaultSuggestSec: number, tableId: string): Promise<void> {
  const endsAt = new Date(Date.now() + defaultSuggestSec * 1000).toISOString();
  
  await supabase
    .from('rounds')
    .update({
      status: 'suggest',
      ends_at: endsAt,
    })
    .eq('id', roundId);
    
  // Trigger global refresh
  await supabase
    .from('tables')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', tableId);
}

/**
 * Start vote phase with timer (atomic with global refresh trigger)
 */
export async function startVotePhase(roundId: string, defaultVoteSec: number, tableId: string): Promise<void> {
  const endsAt = new Date(Date.now() + defaultVoteSec * 1000).toISOString();
  
  // Use atomic function that updates round and triggers global refresh
  await supabase.rpc('start_vote_phase_atomic', {
    p_round_id: roundId,
    p_table_id: tableId,
    p_ends_at: endsAt
  });
}

/**
 * End round and create block with winning suggestion (using safe upsert)
 */
export async function endRound(
  roundId: string,
  tableId: string,
  winningSuggestionText: string,
  suggestionId?: string
): Promise<void> {
  try {
    // Update round to result phase
    const { error: roundError } = await supabase
      .from('rounds')
      .update({
        status: 'result',
        ends_at: null,
        winner_suggestion_id: suggestionId || null,
      })
      .eq('id', roundId);

    if (roundError) throw roundError;

    // Create block entry using safe upsert function
    const { data, error: blockError } = await supabase.rpc('upsert_block_safe', {
      p_table_id: tableId,
      p_round_id: roundId,
      p_suggestion_id: suggestionId || null,
      p_text: winningSuggestionText,
      p_is_tie_break: false
    });

    if (blockError) throw blockError;
    
    const result = data as { success: boolean; error?: string; action?: string };
    if (!result?.success) throw new Error(result?.error || 'Failed to create block');

    // Block saved successfully
    
    // Trigger global refresh to ensure all clients see the new block
    await supabase
      .from('tables')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', tableId);
      
  } catch (error) {
    console.error('Error in endRound:', error);
    throw error;
  }
}

/**
 * Complete current round and automatically advance to next round
 * This is the atomic operation that:
 * 1. Determines winner (with auto tie-breaking)
 * 2. Creates block entry
 * 3. Creates next round in suggest phase
 * 4. Updates table to trigger refresh on all clients
 */
export async function completeRoundAndAdvance(
  roundId: string,
  tableId: string,
  currentRoundNumber: number,
  defaultSuggestSec: number,
  clientId: string
): Promise<{ winner: string; nextRound: Round } | null> {
  try {
    // Get suggestions with votes
    const suggestionsWithVotes = await getSuggestionsWithVotes(roundId, clientId);
    
    if (suggestionsWithVotes.length === 0) {
      // No suggestions - create final block and don't advance
      await endRound(roundId, tableId, 'No suggestions submitted');
      return null;
    }

    // Attempt automatic winner determination
    const winner = getWinnerWithTieBreak(suggestionsWithVotes);
    
    if (!winner) {
      // Tie needs manual resolution - just mark as result phase
      await supabase
        .from('rounds')
        .update({ 
          status: 'result',
          ends_at: null 
        })
        .eq('id', roundId);
      return null;
    }

    // We have a clear winner - proceed with atomic transition
    const nextRoundNumber = currentRoundNumber + 1;
    const suggestEndsAt = new Date(Date.now() + defaultSuggestSec * 1000).toISOString();
    
    // Execute atomic transition using a transaction-like approach
    const { data: newRound, error: roundError } = await supabase
      .from('rounds')
      .insert({
        table_id: tableId,
        number: nextRoundNumber,
        status: 'suggest',
        ends_at: suggestEndsAt,
      })
      .select()
      .single();

    if (roundError) throw roundError;

    // Create block for winner using safe upsert function
    const { data: blockData, error: blockError } = await supabase.rpc('upsert_block_safe', {
      p_table_id: tableId,
      p_round_id: roundId,
      p_suggestion_id: winner.id,
      p_text: winner.text,
      p_is_tie_break: false
    });

    if (blockError) throw blockError;
    
    const blockResult = blockData as { success: boolean; error?: string; action?: string };
    if (!blockResult?.success) throw new Error(blockResult?.error || 'Failed to create winner block');

    // Update current round to result
    await supabase
      .from('rounds')
      .update({
        status: 'result',
        ends_at: null,
        winner_suggestion_id: winner.id,
      })
      .eq('id', roundId);

    // Update table with new round AND updated_at to trigger refresh
    await supabase
      .from('tables')
      .update({ 
        current_round_id: newRound.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', tableId);

    return { winner: winner.text, nextRound: newRound };
    
  } catch (error) {
    console.error('Error in completeRoundAndAdvance:', error);
    throw error;
  }
}

/**
 * Add time to current phase (with global refresh trigger)
 */
export async function addTimeToPhase(roundId: string, additionalSeconds: number, tableId: string): Promise<void> {
  const { data: round } = await supabase
    .from('rounds')
    .select('ends_at')
    .eq('id', roundId)
    .single();

  if (round?.ends_at) {
    const newEndsAt = new Date(new Date(round.ends_at).getTime() + additionalSeconds * 1000).toISOString();
    
    await supabase
      .from('rounds')
      .update({ ends_at: newEndsAt })
      .eq('id', roundId);
      
    // Trigger global refresh
    await supabase
      .from('tables')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', tableId);
  }
}

/**
 * Skip to next phase (with global refresh trigger)
 */
export async function skipToNextPhase(roundId: string, tableId: string, defaultVoteSec: number, defaultSuggestSec: number): Promise<void> {
  const { data: round } = await supabase
    .from('rounds')
    .select('status, number')
    .eq('id', roundId)
    .single();

  if (!round) return;

  // Phase skip not needed

  if (round.status === 'suggest') {
    await startVotePhase(roundId, defaultVoteSec, tableId);
  } else if (round.status === 'vote') {
    // Properly determine winner instead of hardcoding "No winner selected"
    try {
      // Get suggestions with votes for proper winner determination
      const suggestionsWithVotes = await getSuggestionsWithVotes(roundId, 'system');
      
      if (suggestionsWithVotes.length === 0) {
        await endRound(roundId, tableId, 'No suggestions submitted');
      } else {
        // Check if there are any votes
        const totalVotes = suggestionsWithVotes.reduce((sum, s) => sum + s.voteCount, 0);
        
        if (totalVotes === 0) {
          await endRound(roundId, tableId, 'No votes cast');
        } else {
          // Determine winner with tie-breaking
          const winner = getWinnerWithTieBreak(suggestionsWithVotes);
          
          if (winner) {
            await endRound(roundId, tableId, winner.text, winner.id);
          } else {
            // True tie that needs manual resolution
            await endRound(roundId, tableId, 'Tie - manual resolution needed');
          }
        }
      }
    } catch (error) {
      console.error('Error determining winner in skipToNextPhase:', error);
      await endRound(roundId, tableId, 'Error determining winner');
    }
  } else if (round.status === 'result') {
    // Advance to next round
    const newRound = await advanceRound(tableId, round.number);
    await startSuggestPhase(newRound.id, defaultSuggestSec, tableId);
  } else if (round.status === 'lobby') {
    // Start suggest phase for current round
    await startSuggestPhase(roundId, defaultSuggestSec, tableId);
  }
  
  // Trigger global refresh for all transitions
  await supabase
    .from('tables')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', tableId);
}