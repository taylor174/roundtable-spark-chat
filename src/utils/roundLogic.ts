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
 * Advance to next round
 */
export async function advanceRound(tableId: string, currentRoundNumber: number): Promise<Round> {
  const nextRoundNumber = currentRoundNumber + 1;
  
  // Get table settings for timing
  const { data: table } = await supabase
    .from('tables')
    .select('default_suggest_sec')
    .eq('id', tableId)
    .single();
  
  if (!table) throw new Error('Table not found');
  
  // Calculate suggestion phase end time
  const endsAt = new Date(Date.now() + table.default_suggest_sec * 1000).toISOString();
  
  // Create new round with suggestion phase already started
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