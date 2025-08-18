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

  // Count votes and check if user voted (include host votes)
  return (suggestions || []).map(suggestion => {
    const suggestionVotes = votes?.filter(v => v.suggestion_id === suggestion.id) || [];
    const hasUserVoted = votes?.some(v => 
      (v.participant_id === clientId || v.participant_id.startsWith('host_')) && 
      v.suggestion_id === suggestion.id
    ) || false;
    
    return {
      ...suggestion,
      voteCount: suggestionVotes.length,
      hasUserVoted,
    };
  });
}

/**
 * Get winning suggestions with automatic tie-breaking by submission time
 */
export function getWinningSuggestions(
  suggestions: Array<Suggestion & { voteCount: number }>
): Array<Suggestion & { voteCount: number }> {
  if (suggestions.length === 0) return [];
  
  const maxVotes = Math.max(...suggestions.map(s => s.voteCount));
  const topSuggestions = suggestions.filter(s => s.voteCount === maxVotes);
  
  // If tied, return the one submitted earliest (automatic tie-breaking)
  if (topSuggestions.length > 1) {
    const earliest = topSuggestions.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];
    return [earliest];
  }
  
  return topSuggestions;
}

/**
 * Get winning suggestions without automatic tie-breaking (for manual resolution)
 */
export function getWinningSuggestionsWithTies(
  suggestions: Array<Suggestion & { voteCount: number }>
): Array<Suggestion & { voteCount: number }> {
  if (suggestions.length === 0) return [];
  
  const maxVotes = Math.max(...suggestions.map(s => s.voteCount));
  return suggestions.filter(s => s.voteCount === maxVotes);
}

/**
 * Advance to next round and automatically start suggestions
 */
export async function advanceRound(tableId: string, currentRoundNumber: number, defaultSuggestSec: number): Promise<Round> {
  const nextRoundNumber = currentRoundNumber + 1;
  const endsAt = new Date(Date.now() + defaultSuggestSec * 1000).toISOString();
  
  // Create new round directly in suggest phase
  const { data: newRound, error } = await supabase
    .from('rounds')
    .insert({
      table_id: tableId,
      number: nextRoundNumber,
      status: 'suggest',
      ends_at: endsAt,
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
 * Start suggestion phase with timer
 */
export async function startSuggestPhase(roundId: string, defaultSuggestSec: number): Promise<void> {
  const endsAt = new Date(Date.now() + defaultSuggestSec * 1000).toISOString();
  
  await supabase
    .from('rounds')
    .update({
      status: 'suggest',
      ends_at: endsAt,
    })
    .eq('id', roundId);
}

/**
 * Start vote phase with timer
 */
export async function startVotePhase(roundId: string, defaultVoteSec: number): Promise<void> {
  const endsAt = new Date(Date.now() + defaultVoteSec * 1000).toISOString();
  
  await supabase
    .from('rounds')
    .update({
      status: 'vote',
      ends_at: endsAt,
    })
    .eq('id', roundId);
}

/**
 * End round and create block with winning suggestion, with brief result display
 */
export async function endRound(
  roundId: string,
  tableId: string,
  winningSuggestionText: string,
  suggestionId?: string
): Promise<void> {
  // Set 1-second result display period
  const resultEndsAt = new Date(Date.now() + 1000).toISOString();
  
  // Update round to result phase with timer
  await supabase
    .from('rounds')
    .update({
      status: 'result',
      ends_at: resultEndsAt,
      winner_suggestion_id: suggestionId || null,
    })
    .eq('id', roundId);

  // Create block entry
  await supabase
    .from('blocks')
    .insert({
      table_id: tableId,
      round_id: roundId,
      suggestion_id: suggestionId || null,
      text: winningSuggestionText,
    });
}

/**
 * Create and start next round automatically
 */
export async function createNextRoundAutomatically(
  tableId: string,
  currentRoundNumber: number,
  defaultSuggestSec: number
): Promise<Round> {
  try {
    const newRound = await advanceRound(tableId, currentRoundNumber, defaultSuggestSec);
    return newRound;
  } catch (error) {
    console.error('Error creating next round:', error);
    throw error;
  }
}

/**
 * Add time to current phase
 */
export async function addTimeToPhase(roundId: string, additionalSeconds: number): Promise<void> {
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
  }
}

/**
 * Skip to next phase
 */
export async function skipToNextPhase(roundId: string, tableId: string, defaultVoteSec: number): Promise<void> {
  const { data: round } = await supabase
    .from('rounds')
    .select('status')
    .eq('id', roundId)
    .single();

  if (!round) return;

  if (round.status === 'suggest') {
    await startVotePhase(roundId, defaultVoteSec);
  } else if (round.status === 'vote') {
    await endRound(roundId, tableId, 'No winner selected');
  }
}