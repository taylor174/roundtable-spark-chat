import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2 } from 'lucide-react';
import { SuggestionWithVotes } from '@/types';
import { MESSAGES } from '@/constants';
import { useToast } from '@/hooks/use-toast';

interface VoteListProps {
  roundId: string;
  participantId: string;
  suggestions: SuggestionWithVotes[];
  userHasVoted: boolean;
  onVoteSuccess?: () => void;
}

export function VoteList({ roundId, participantId, suggestions, userHasVoted, onVoteSuccess }: VoteListProps) {
  const [voting, setVoting] = useState<string | null>(null);
  const { toast } = useToast();

  const handleVote = useCallback(async (suggestionId: string) => {
    if (voting || userHasVoted) return;
    
    setVoting(suggestionId);

    try {
      const { error } = await supabase
        .from('votes')
        .insert({
          round_id: roundId,
          participant_id: participantId,
          suggestion_id: suggestionId
        });

      if (error) {
        toast({
          title: "Error",
          description: error.message?.includes('duplicate') 
            ? "You've already voted in this round!"
            : "Failed to submit vote. Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Vote Submitted! ✓",
        description: "Your vote has been recorded.",
        className: "border-emerald-200 bg-emerald-50 text-emerald-900",
      });

      // Trigger refresh callback instead of page reload
      onVoteSuccess?.();

    } catch (error) {
      console.error('Error submitting vote:', error);
      toast({
        title: "Network Error", 
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setVoting(null);
    }
  }, [roundId, participantId, voting, userHasVoted, toast, onVoteSuccess]);

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vote for Your Favorite</CardTitle>
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
        <CardTitle>Vote for Your Favorite</CardTitle>
        <p className="text-muted-foreground">
          {userHasVoted ? "You've voted ✓" : MESSAGES.VOTE_PHASE}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <Card key={suggestion.id} className="relative">
              <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1">
                    <p>{suggestion.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      by {suggestion.authorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">
                      {suggestion.voteCount} {suggestion.voteCount === 1 ? 'vote' : 'votes'}
                    </Badge>
                    {!userHasVoted && (
                      <Button
                        size="sm"
                        onClick={() => handleVote(suggestion.id)}
                        disabled={voting !== null}
                        className="min-w-[70px]"
                      >
                        {voting === suggestion.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Voting...
                          </>
                        ) : (
                          'Vote'
                        )}
                      </Button>
                    )}
                    {suggestion.hasUserVoted && (
                      <Check className="h-5 w-5 text-emerald-600" />
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