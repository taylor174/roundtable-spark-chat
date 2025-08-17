import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { SuggestionWithVotes } from '@/types';
import { MESSAGES } from '@/constants';
import { useToast } from '@/hooks/use-toast';

interface HostVoteListProps {
  roundId: string;
  tableId: string;
  suggestions: SuggestionWithVotes[];
  hostHasVoted: boolean;
}

export function HostVoteList({ roundId, tableId, suggestions, hostHasVoted }: HostVoteListProps) {
  const [voting, setVoting] = useState(false);
  const { toast } = useToast();

  const handleHostVote = async (suggestionId: string) => {
    try {
      setVoting(true);

      // Create a temporary host participant ID for voting
      const hostParticipantId = `host_${tableId}`;

      const { error } = await supabase
        .from('votes')
        .insert({
          round_id: roundId,
          participant_id: hostParticipantId,
          suggestion_id: suggestionId,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Host vote submitted!",
      });
    } catch (error) {
      console.error('Error submitting host vote:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setVoting(false);
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Host Voting</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            No suggestions to vote on.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Host Voting</CardTitle>
        <p className="text-muted-foreground">
          {hostHasVoted ? "You've voted ✓" : "Cast your vote as host"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="relative">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-3">
                  <p className="flex-1">{suggestion.text}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">
                      {suggestion.voteCount} {suggestion.voteCount === 1 ? 'vote' : 'votes'}
                    </Badge>
                    {!hostHasVoted && (
                      <Button
                        size="sm"
                        onClick={() => handleHostVote(suggestion.id)}
                        disabled={voting}
                      >
                        Vote
                      </Button>
                    )}
                    {suggestion.hasUserVoted && (
                      <Check className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}