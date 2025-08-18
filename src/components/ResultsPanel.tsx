import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WinningSuggestion } from '@/types';
import { Trophy, Crown, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResultsPanelProps {
  winningSuggestions: WinningSuggestion[];
  isHost: boolean;
  roundNumber?: number;
  tableId?: string;
  roundId?: string;
  onWinnerSelected?: (suggestionId: string) => void;
  onNextRound?: () => void;
  isTransitioning?: boolean;
}

export function ResultsPanel({ 
  winningSuggestions, 
  isHost,
  roundNumber = 1,
  tableId,
  roundId,
  onWinnerSelected, 
  onNextRound,
  isTransitioning = false
}: ResultsPanelProps) {
  const [showTieBreaker, setShowTieBreaker] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const isTie = winningSuggestions.length > 1;
  const winner = winningSuggestions[0];

  const handleTieBreak = async () => {
    if (!selectedWinner || !tableId || !roundId || processing) return;
    
    try {
      setProcessing(true);
      
      const winningSuggestion = winningSuggestions.find(s => s.id === selectedWinner);
      if (!winningSuggestion) return;

      // Atomically update round and create block
      const [roundUpdate, blockUpsert] = await Promise.all([
        // Update round to result phase with winner
        supabase
          .from('rounds')
          .update({
            status: 'result',
            winner_suggestion_id: selectedWinner,
            ends_at: null
          })
          .eq('id', roundId),
        
        // Upsert block entry (handle existing blocks)
        supabase
          .from('blocks')
          .upsert({
            table_id: tableId,
            round_id: roundId,
            suggestion_id: selectedWinner,
            text: winningSuggestion.text,
            is_tie_break: true
          }, {
            onConflict: 'table_id,round_id'
          })
      ]);

      if (roundUpdate.error) throw roundUpdate.error;
      if (blockUpsert.error) throw blockUpsert.error;

      toast({
        title: "Success",
        description: "Winner selected and round completed!",
      });

      setShowTieBreaker(false);
      if (onWinnerSelected) {
        onWinnerSelected(selectedWinner);
      }
    } catch (error) {
      console.error('Error handling tie break:', error);
      toast({
        title: "Error",
        description: "Failed to break tie. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (isTie && isHost) {
    return (
      <>
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-amber-600">
            <Users className="h-5 w-5" />
            <span>Tie Breaking Required</span>
          </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              There's a tie! As the host, please select the winning suggestion.
            </p>
            
            <div className="space-y-3">
              {winningSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="p-3 border rounded-lg">
                  <p className="text-sm">{suggestion.text}</p>
                  <Badge variant="secondary" className="mt-2">
                    {suggestion.voteCount} votes
                  </Badge>
                </div>
              ))}
            </div>

            <Button 
              onClick={() => setShowTieBreaker(true)}
              disabled={isTransitioning}
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
                  {winningSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="flex items-start space-x-3">
                      <RadioGroupItem
                        value={suggestion.id}
                        id={`tie-${suggestion.id}`}
                        className="mt-1"
                      />
                      <Label
                        htmlFor={`tie-${suggestion.id}`}
                        className="flex-1 cursor-pointer text-sm"
                      >
                        {suggestion.text}
                        <Badge variant="secondary" className="ml-2">
                          {suggestion.voteCount} votes
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              
              <Button
                onClick={handleTieBreak}
                disabled={!selectedWinner || processing}
                className="w-full"
              >
                <Crown className="mr-2 h-4 w-4" />
                {processing ? 'Processing...' : 'Select Winner'}
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
        <CardTitle className="flex items-center space-x-2 text-amber-600">
          <Users className="h-5 w-5" />
          <span>Tie!</span>
        </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            There's a tie between multiple suggestions. Waiting for host to break the tie...
          </p>
          <div className="space-y-2">
            {winningSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="p-3 border rounded-lg">
                <p className="text-sm">{suggestion.text}</p>
                <Badge variant="secondary" className="mt-2">
                  {suggestion.voteCount} votes
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
      <CardTitle className="flex items-center space-x-2 text-amber-600">
        <Trophy className="h-5 w-5" />
        <span>Round {roundNumber} — Winner!</span>
      </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border-2 border-amber-200 bg-amber-50 rounded-lg">
          <p className="font-medium text-lg">{winner.text}</p>
          <Badge variant="secondary" className="mt-2">
            {winner.voteCount} votes
          </Badge>
        </div>

      </CardContent>
    </Card>
  );
}