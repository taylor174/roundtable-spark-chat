import { supabase } from '@/integrations/supabase/client';
import { Suggestion, Vote, Round } from '@/types';

/**
 * Get suggestions with vote counts for display
 */
export async function getSuggestionsWithVotes(
  roundId: string,
  clientId: string
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

  // Count votes and check if user voted (handle both participant IDs and host IDs)
  return (suggestions || []).map(suggestion => {
    const suggestionVotes = votes?.filter(v => v.suggestion_id === suggestion.id) || [];
    
    // More robust user vote detection - check both clientId and actual participant ID
    const hasUserVoted = votes?.some(v => {
      const voteParticipantId = v.participant_id;
      return (voteParticipantId === clientId || // Direct clientId match
              voteParticipantId.includes(clientId) || // clientId contained in participantId
              (voteParticipantId.startsWith('host_') && clientId.startsWith('host_'))) && // Both are hosts
             v.suggestion_id === suggestion.id;
    }) || false;
    
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
  
  // If top two have same votes AND same timestamp (extremely rare), manual resolution needed
  if (sorted.length > 1 && 
      sorted[0].voteCount === sorted[1].voteCount && 
      sorted[0].created_at === sorted[1].created_at) {
    return null;
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
 * End round and create block with winning suggestion
 */
export async function endRound(
  roundId: string,
  tableId: string,
  winningSuggestionText: string
): Promise<void> {
  // Update round to result phase
  await supabase
    .from('rounds')
    .update({
      status: 'result',
      ends_at: null,
    })
    .eq('id', roundId);

  // Create block entry
  await supabase
    .from('blocks')
    .insert({
      table_id: tableId,
      round_id: roundId,
      text: winningSuggestionText,
    });
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

    // Create block for winner (idempotent with unique constraint on table_id, round_id)
    await supabase
      .from('blocks')
      .upsert({
        table_id: tableId,
        round_id: roundId,
        text: winner.text,
        suggestion_id: winner.id,
      }, {
        onConflict: 'table_id,round_id'
      });

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
export async function skipToNextPhase(roundId: string, tableId: string, defaultVoteSec: number): Promise<void> {
  const { data: round } = await supabase
    .from('rounds')
    .select('status')
    .eq('id', roundId)
    .single();

  if (!round) return;

  if (round.status === 'suggest') {
    await startVotePhase(roundId, defaultVoteSec, tableId);
  } else if (round.status === 'vote') {
    await endRound(roundId, tableId, 'No winner selected');
    // Trigger global refresh
    await supabase
      .from('tables')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', tableId);
  }
}