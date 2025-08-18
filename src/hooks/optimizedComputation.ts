import { useMemo } from 'react';
import { Suggestion, Vote, Participant } from '@/types';
import { useMemoizedComputation } from '@/hooks/useCache';

/**
 * Hook to efficiently compute suggestions with vote counts and user voting status
 */
export function useSuggestionsWithVotes(
  suggestions: Suggestion[],
  votes: Vote[],
  participants: Participant[],
  currentParticipantId: string | null
) {
  return useMemoizedComputation(
    (suggestions, votes, participants, currentParticipantId) => {
      const participantMap = new Map(
        participants.map(p => [p.id, p.display_name])
      );

      return suggestions.map(suggestion => {
        const suggestionVotes = votes.filter(v => v.suggestion_id === suggestion.id);
        const hasUserVoted = currentParticipantId 
          ? suggestionVotes.some(v => v.participant_id === currentParticipantId)
          : false;
        
        const voters = suggestionVotes
          .map(v => participantMap.get(v.participant_id))
          .filter(Boolean) as string[];

        return {
          ...suggestion,
          voteCount: suggestionVotes.length,
          hasUserVoted,
          voters
        };
      });
    },
    (suggestions, votes, participants, currentParticipantId) => 
      `suggestions_${suggestions.length}_votes_${votes.length}_participant_${currentParticipantId}`,
    50
  )(suggestions, votes, participants, currentParticipantId);
}

/**
 * Hook to compute vote statistics for the current round
 */
export function useVoteStatistics(votes: Vote[], participants: Participant[]) {
  return useMemo(() => {
    const totalParticipants = participants.length;
    const totalVotes = votes.length;
    const participationRate = totalParticipants > 0 
      ? Math.round((totalVotes / totalParticipants) * 100) 
      : 0;

    const voterIds = new Set(votes.map(v => v.participant_id));
    const nonVoters = participants.filter(p => !voterIds.has(p.id));

    return {
      totalParticipants,
      totalVotes,
      participationRate,
      nonVoters: nonVoters.map(p => p.display_name),
      hasEveryoneVoted: totalVotes === totalParticipants
    };
  }, [votes, participants]);
}

/**
 * Hook to determine winning suggestions with tie detection
 */
export function useWinningSuggestions(suggestions: Suggestion[], votes: Vote[]) {
  return useMemo(() => {
    if (suggestions.length === 0) return { winners: [], isTie: false, maxVotes: 0 };

    const voteCounts = new Map<string, number>();
    
    // Count votes for each suggestion
    votes.forEach(vote => {
      const currentCount = voteCounts.get(vote.suggestion_id) || 0;
      voteCounts.set(vote.suggestion_id, currentCount + 1);
    });

    // Find max vote count
    const maxVotes = Math.max(...Array.from(voteCounts.values()), 0);
    
    // Get all suggestions with max votes
    const winners = suggestions
      .filter(s => (voteCounts.get(s.id) || 0) === maxVotes)
      .map(s => ({
        ...s,
        voteCount: voteCounts.get(s.id) || 0,
        percentage: suggestions.length > 0 
          ? Math.round(((voteCounts.get(s.id) || 0) / votes.length) * 100)
          : 0
      }));

    return {
      winners,
      isTie: winners.length > 1 && maxVotes > 0,
      maxVotes,
      hasVotes: votes.length > 0
    };
  }, [suggestions, votes]);
}

/**
 * Hook to track real-time connection status and provide reconnection
 */
export function useConnectionStatus() {
  return useMemo(() => {
    // This would integrate with your real-time connection logic
    return {
      isConnected: true, // placeholder
      lastSeen: new Date(),
      reconnect: () => {},
      connectionQuality: 'good' as 'good' | 'poor' | 'disconnected'
    };
  }, []);
}

/**
 * Hook for optimized participant management
 */
export function useParticipantManagement(participants: Participant[], currentClientId: string) {
  return useMemo(() => {
    const currentParticipant = participants.find(p => p.client_id === currentClientId);
    const host = participants.find(p => p.is_host);
    const isHost = currentParticipant?.is_host || false;
    
    const participantsByJoinOrder = [...participants].sort(
      (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );

    return {
      currentParticipant,
      host,
      isHost,
      participantCount: participants.length,
      participantsByJoinOrder,
      hostName: host?.display_name || 'Unknown Host'
    };
  }, [participants, currentClientId]);
}