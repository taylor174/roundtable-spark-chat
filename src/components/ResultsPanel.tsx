import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WinningProposal } from '@/types';
import { Trophy, Crown, Users } from 'lucide-react';

interface ResultsPanelProps {
  winningProposals: WinningProposal[];
  isHost: boolean;
  onWinnerSelected?: (proposalId: string) => void;
  onNextRound?: () => void;
}

export function ResultsPanel({ 
  winningProposals, 
  isHost, 
  onWinnerSelected, 
  onNextRound 
}: ResultsPanelProps) {
  const [showTieBreaker, setShowTieBreaker] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string>('');

  const isTie = winningProposals.length > 1;
  const winner = winningProposals[0];

  const handleTieBreak = () => {
    if (selectedWinner && onWinnerSelected) {
      onWinnerSelected(selectedWinner);
      setShowTieBreaker(false);
    }
  };

  if (isTie && isHost) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-600">
              <Users className="h-5 w-5" />
              <span>Tie Breaking Required</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              There's a tie! As the host, please select the winning suggestion.
            </p>
            
            <div className="space-y-3">
              {winningProposals.map((proposal) => (
                <div key={proposal.id} className="p-3 border rounded-lg">
                  <p className="text-sm">{proposal.text}</p>
                  <Badge variant="secondary" className="mt-2">
                    {proposal.voteCount} votes
                  </Badge>
                </div>
              ))}
            </div>

            <Button 
              onClick={() => setShowTieBreaker(true)}
              className="w-full"
              size="lg"
            >
              <Crown className="mr-2 h-4 w-4" />
              Break Tie
            </Button>
          </CardContent>
        </Card>

        <Dialog open={showTieBreaker} onOpenChange={setShowTieBreaker}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Select the Winner</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <RadioGroup
                value={selectedWinner}
                onValueChange={setSelectedWinner}
              >
                <div className="space-y-3">
                  {winningProposals.map((proposal) => (
                    <div key={proposal.id} className="flex items-start space-x-3">
                      <RadioGroupItem
                        value={proposal.id}
                        id={`tie-${proposal.id}`}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`tie-${proposal.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {proposal.text}
                        <Badge variant="secondary" className="ml-2">
                          {proposal.voteCount} votes
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              
              <Button
                onClick={handleTieBreak}
                disabled={!selectedWinner}
                className="w-full"
              >
                <Crown className="mr-2 h-4 w-4" />
                Select Winner
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (isTie && !isHost) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-orange-600">
            <Users className="h-5 w-5" />
            <span>Tie!</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            There's a tie between multiple suggestions. Waiting for host to break the tie...
          </p>
          <div className="space-y-2">
            {winningProposals.map((proposal) => (
              <div key={proposal.id} className="p-3 border rounded-lg">
                <p className="text-sm">{proposal.text}</p>
                <Badge variant="secondary" className="mt-2">
                  {proposal.voteCount} votes
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-yellow-600">
          <Trophy className="h-5 w-5" />
          <span>Round Winner!</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border-2 border-yellow-200 bg-yellow-50 rounded-lg">
          <p className="font-medium text-lg">{winner.text}</p>
          <Badge variant="secondary" className="mt-2">
            {winner.voteCount} votes
          </Badge>
        </div>

        {isHost && onNextRound && (
          <Button 
            onClick={onNextRound}
            className="w-full"
            size="lg"
          >
            Start Next Round
          </Button>
        )}
      </CardContent>
    </Card>
  );
}