import { Badge } from '@/components/ui/badge';
import { Check, Clock } from 'lucide-react';

interface VotingStatusIndicatorProps {
  participants: any[];
  votes: any[];
  currentRound: any;
}

export function VotingStatusIndicator({ participants, votes, currentRound }: VotingStatusIndicatorProps) {
  if (!currentRound) return null;

  const participantVoteStatus = participants.map(participant => {
    const hasVoted = votes.some(vote => 
      vote.participant_id === participant.id && vote.round_id === currentRound.id
    );
    return {
      ...participant,
      hasVoted
    };
  });

  // Check if host has voted (using host participant ID pattern)
  const hostHasVoted = votes.some(vote => 
    vote.participant_id.startsWith('host_') && vote.round_id === currentRound.id
  );

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Voting Status</h4>
      {participantVoteStatus.map(participant => (
        <div key={participant.id} className="flex items-center justify-between">
          <span className="text-sm">{participant.display_name}</span>
          {participant.hasVoted ? (
            <Badge variant="outline" className="gap-1">
              <Check className="h-3 w-3 text-green-600" />
              Voted
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Waiting
            </Badge>
          )}
        </div>
      ))}
      
      {/* Show host voting status */}
      <div className="flex items-center justify-between">
        <span className="text-sm">Host</span>
        {hostHasVoted ? (
          <Badge variant="outline" className="gap-1">
            <Check className="h-3 w-3 text-green-600" />
            Voted
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Waiting
          </Badge>
        )}
      </div>
    </div>
  );
}