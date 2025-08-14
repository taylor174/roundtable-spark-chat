import { ProposalWithVotes } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

interface SuggestionListProps {
  proposals: ProposalWithVotes[];
  showVoteCounts?: boolean;
}

export function SuggestionList({ proposals, showVoteCounts = false }: SuggestionListProps) {
  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No suggestions yet. Be the first to share an idea!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>Suggestions ({proposals.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <div
              key={proposal.id}
              className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <p className="text-sm leading-relaxed">{proposal.text}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(proposal.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
                {showVoteCounts && (
                  <Badge variant={proposal.voteCount > 0 ? "default" : "secondary"}>
                    {proposal.voteCount} {proposal.voteCount === 1 ? 'vote' : 'votes'}
                  </Badge>
                )}
                {proposal.hasUserVoted && (
                  <Badge variant="outline" className="ml-2">
                    ✓ Your vote
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}