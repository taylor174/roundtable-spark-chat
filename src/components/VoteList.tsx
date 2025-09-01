import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { SuggestionWithVotes } from '@/types';
import { MESSAGES } from '@/constants';
import { useToast } from '@/hooks/use-toast';

interface VoteListProps {
  roundId: string;
  participantId: string;
  suggestions: SuggestionWithVotes[];
  userHasVoted: boolean;
}

export function VoteList({ roundId, participantId, suggestions, userHasVoted }: VoteListProps) {
  const [voting, setVoting] = useState(false);
  const { toast } = useToast();

  const handleVote = async (suggestionId: string) => {
    if (voting || userHasVoted) return;
    
    console.log('Vote attempt:', { roundId, participantId, suggestionId, userHasVoted });
    setVoting(true);

    try {
      // Direct vote insertion for testing
      const { error: directError } = await supabase
        .from('votes')
        .insert({
          round_id: roundId,
          participant_id: participantId,
          suggestion_id: suggestionId
        });

      if (directError) {
        console.error('Direct insert error:', directError);
        toast({
          title: "Error",
          description: directError.message || "Failed to submit vote",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success",
        description: "Vote submitted successfully!",
      });

      // Quick refresh - no page reload
      setTimeout(() => {
        window.location.reload();
      }, 300);

    } catch (error) {
      console.error('Error submitting vote:', error);
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
                        disabled={voting}
                      >
                        Vote
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