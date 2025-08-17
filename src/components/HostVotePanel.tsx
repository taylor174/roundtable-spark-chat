import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SuggestionWithVotes } from '@/types';
import { Check, Vote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HostVotePanelProps {
  roundId: string;
  tableId: string;
  suggestions: SuggestionWithVotes[];
  hostHasVoted: boolean;
}

export function HostVotePanel({ 
  roundId, 
  tableId, 
  suggestions, 
  hostHasVoted 
}: HostVotePanelProps) {
  const [loading, setLoading] = useState(false);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const { toast } = useToast();

  const handleHostVote = async (suggestionId: string) => {
    try {
      setLoading(true);
      
      // First, upsert host participant record
      const { data: hostParticipant, error: participantError } = await supabase
        .from('participants')
        .upsert({
          table_id: tableId,
          client_id: 'host',
          display_name: 'Host',
          is_host: true,
        }, {
          onConflict: 'table_id,client_id'
        })
        .select()
        .single();

      if (participantError) {
        console.error('Error creating host participant:', participantError);
        throw participantError;
      }

      if (!hostParticipant) {
        throw new Error('Failed to create host participant');
      }

      // Now insert vote with the host participant ID
      const { error: voteError } = await supabase
        .from('votes')
        .insert({
          round_id: roundId,
          suggestion_id: suggestionId,
          participant_id: hostParticipant.id,
        });

      if (voteError) {
        console.error('Error submitting host vote:', voteError);
        throw voteError;
      }

      setVotedFor(suggestionId);
      
      toast({
        title: "Vote Submitted",
        description: "Your vote has been recorded.",
      });
    } catch (error) {
      console.error('Error submitting host vote:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Vote className="h-4 w-4" />
            <span>Host Voting</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No suggestions to vote on yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Vote className="h-4 w-4" />
          <span>Host Voting</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {hostHasVoted && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-700">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">You've voted ✓</span>
            </div>
          </div>
        )}
        
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="p-3 border rounded-lg">
            <p className="text-sm mb-2">{suggestion.text}</p>
            <div className="flex items-center justify-between">
              <Badge variant="outline">
                {suggestion.voteCount} votes
              </Badge>
              {!hostHasVoted ? (
                <Button
                  size="sm"
                  onClick={() => handleHostVote(suggestion.id)}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? 'Voting...' : 'Vote'}
                </Button>
              ) : suggestion.hasUserVoted ? (
                <div className="flex items-center space-x-1 text-green-600">
                  <Check className="h-3 w-3" />
                  <span className="text-xs">Your vote</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}