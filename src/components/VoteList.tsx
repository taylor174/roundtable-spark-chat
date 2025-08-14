import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ProposalWithVotes, VoteInsert } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { MESSAGES } from '@/constants';
import { CheckCircle, Loader2, Vote } from 'lucide-react';

interface VoteListProps {
  proposals: ProposalWithVotes[];
  roundId: string;
  participantId: string;
  hasVoted: boolean;
  disabled?: boolean;
}

export function VoteList({ proposals, roundId, participantId, hasVoted, disabled = false }: VoteListProps) {
  const [selectedProposalId, setSelectedProposalId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleVote = async () => {
    if (!selectedProposalId) {
      toast({
        title: "Error",
        description: "Please select a suggestion to vote for.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const voteData: VoteInsert = {
        round_id: roundId,
        participant_id: participantId,
        proposal_id: selectedProposalId,
      };

      const { error } = await supabase
        .from('votes')
        .insert(voteData);

      if (error) throw error;

      toast({
        title: "Success",
        description: MESSAGES.VOTE_SUBMITTED,
      });

    } catch (error) {
      console.error('Error submitting vote:', error);
      toast({
        title: "Error",
        description: "Failed to submit vote. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (proposals.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Vote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No suggestions to vote on yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (hasVoted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span>Vote Submitted!</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You have successfully voted. Waiting for other participants...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Vote className="h-5 w-5" />
          <span>Vote for your favorite suggestion</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup
          value={selectedProposalId}
          onValueChange={setSelectedProposalId}
          disabled={disabled || loading}
        >
          <div className="space-y-3">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <RadioGroupItem
                  value={proposal.id}
                  id={proposal.id}
                  className="mt-1"
                />
                <Label
                  htmlFor={proposal.id}
                  className="flex-1 cursor-pointer text-sm leading-relaxed"
                >
                  {proposal.text}
                </Label>
              </div>
            ))}
          </div>
        </RadioGroup>

        <Button
          onClick={handleVote}
          disabled={disabled || loading || !selectedProposalId}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting Vote...
            </>
          ) : (
            <>
              <Vote className="mr-2 h-4 w-4" />
              Submit Vote
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}