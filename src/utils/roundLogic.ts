import { supabase } from '@/integrations/supabase/client';
import { 
  Proposal, 
  Vote, 
  WinningProposal, 
  ProposalWithVotes, 
  RoundInsert, 
  RoundUpdate, 
  BlockInsert, 
  TableUpdate 
} from '@/types';

/**
 * Get proposals with vote counts and user vote status
 */
export function getProposalsWithVotes(
  proposals: Proposal[], 
  votes: Vote[], 
  currentParticipantId?: string
): ProposalWithVotes[] {
  return proposals.map(proposal => {
    const proposalVotes = votes.filter(vote => vote.proposal_id === proposal.id);
    const hasUserVoted = currentParticipantId 
      ? proposalVotes.some(vote => vote.participant_id === currentParticipantId)
      : false;

    return {
      ...proposal,
      voteCount: proposalVotes.length,
      hasUserVoted,
    };
  });
}

/**
 * Check if user has voted in the current round
 */
export function hasUserVoted(votes: Vote[], participantId: string): boolean {
  return votes.some(vote => vote.participant_id === participantId);
}

/**
 * Get winning proposals (handles ties)
 */
export function getWinningProposals(proposals: ProposalWithVotes[]): WinningProposal[] {
  if (proposals.length === 0) return [];

  const maxVotes = Math.max(...proposals.map(p => p.voteCount));
  return proposals
    .filter(p => p.voteCount === maxVotes)
    .map(p => ({
      ...p,
      voteCount: p.voteCount,
    }));
}

/**
 * Advance round to next phase or create new round
 */
export async function advanceRound(
  tableId: string,
  currentRound: any,
  winningProposalId?: string
): Promise<void> {
  if (currentRound.status === 'suggestions') {
    // Move to voting phase
    const table = await supabase
      .from('tables')
      .select('voting_seconds')
      .eq('id', tableId)
      .single();

    if (table.error) throw table.error;

    const phaseEndTime = new Date(Date.now() + (table.data.voting_seconds * 1000));

    await supabase
      .from('rounds')
      .update({ status: 'voting' })
      .eq('id', currentRound.id);

    await supabase
      .from('tables')
      .update({ phase_ends_at: phaseEndTime.toISOString() })
      .eq('id', tableId);

  } else if (currentRound.status === 'voting') {
    // Move to results phase and create block
    await supabase
      .from('rounds')
      .update({ 
        status: 'results',
        ended_at: new Date().toISOString(),
      })
      .eq('id', currentRound.id);

    // Create block if winning proposal is specified
    if (winningProposalId) {
      const { data: winningProposal } = await supabase
        .from('proposals')
        .select('text')
        .eq('id', winningProposalId)
        .single();

      if (winningProposal) {
        const blockData: BlockInsert = {
          table_id: tableId,
          round_id: currentRound.id,
          winning_proposal_id: winningProposalId,
          text: winningProposal.text,
        };

        await supabase
          .from('blocks')
          .insert(blockData);
      }
    }

    // Clear phase end time
    await supabase
      .from('tables')
      .update({ phase_ends_at: null })
      .eq('id', tableId);
  }
}

/**
 * Start next round
 */
export async function startNextRound(tableId: string, currentRoundIndex: number): Promise<void> {
  const table = await supabase
    .from('tables')
    .select('suggestion_seconds')
    .eq('id', tableId)
    .single();

  if (table.error) throw table.error;

  // Create new round
  const roundData: RoundInsert = {
    table_id: tableId,
    round_index: currentRoundIndex + 1,
    status: 'suggestions',
  };

  const { data: newRound, error: roundError } = await supabase
    .from('rounds')
    .insert(roundData)
    .select()
    .single();

  if (roundError) throw roundError;

  // Update table with new round and phase end time
  const phaseEndTime = new Date(Date.now() + (table.data.suggestion_seconds * 1000));

  const tableUpdate: TableUpdate = {
    current_round_id: newRound.id,
    phase_ends_at: phaseEndTime.toISOString(),
  };

  await supabase
    .from('tables')
    .update(tableUpdate)
    .eq('id', tableId);
}

/**
 * Select winner from tied proposals
 */
export async function selectWinner(
  tableId: string,
  roundId: string,
  winningProposalId: string
): Promise<void> {
  const { data: winningProposal } = await supabase
    .from('proposals')
    .select('text')
    .eq('id', winningProposalId)
    .single();

  if (!winningProposal) throw new Error('Winning proposal not found');

  // Create block
  const blockData: BlockInsert = {
    table_id: tableId,
    round_id: roundId,
    winning_proposal_id: winningProposalId,
    text: winningProposal.text,
  };

  await supabase
    .from('blocks')
    .insert(blockData);

  // Update round status
  await supabase
    .from('rounds')
    .update({ 
      status: 'results',
      ended_at: new Date().toISOString(),
    })
    .eq('id', roundId);

  // Clear phase end time
  await supabase
    .from('tables')
    .update({ phase_ends_at: null })
    .eq('id', tableId);
}