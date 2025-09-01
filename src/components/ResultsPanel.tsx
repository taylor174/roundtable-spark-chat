import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { WinningSuggestion } from '@/types';
import { Trophy, Crown, Users, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TruncatedText } from '@/components/TruncatedText';

interface ResultsPanelProps {
  winningSuggestions: WinningSuggestion[];
  isHost: boolean;
  roundNumber?: number;
  tableId?: string;
  roundId?: string;
  onWinnerSelected?: (suggestionId: string) => void;
  onNextRound?: () => void;
  isTransitioning?: boolean;
  refreshBlocks?: () => void;
}

export function ResultsPanel({ 
  winningSuggestions, 
  isHost,
  roundNumber = 1,
  tableId,
  roundId,
  onWinnerSelected, 
  onNextRound,
  isTransitioning = false,
  refreshBlocks
}: ResultsPanelProps) {
  const [showTieBreaker, setShowTieBreaker] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [tieResolved, setTieResolved] = useState(false);
  const { toast } = useToast();

  const isTie = winningSuggestions.length > 1;
  const winner = winningSuggestions[0];

  const handleTieBreak = async () => {
    if (!selectedWinner || !tableId || !roundId || processing) return;
    
    console.log('🎯 Starting tie break process...', { selectedWinner, tableId, roundId, processing });
    
    try {
      setProcessing(true);
      
      const winningSuggestion = winningSuggestions.find(s => s.id === selectedWinner);
      if (!winningSuggestion) return;

      console.log('🎯 Found winning suggestion:', winningSuggestion);

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
        
        // Use safe upsert function for block creation
        supabase.rpc('upsert_block_safe', {
          p_table_id: tableId,
          p_round_id: roundId,
          p_suggestion_id: selectedWinner,
          p_text: winningSuggestion.text,
          p_is_tie_break: true
        })
      ]);

      

      if (roundUpdate.error) throw roundUpdate.error;
      if (blockUpsert.error) throw blockUpsert.error;
      
      const blockResult = blockUpsert.data as { success: boolean; error?: string; action?: string };
      if (blockResult && !blockResult.success) {
        throw new Error(blockResult.error || 'Failed to create tie-break block');
      }

      toast({
        title: "Success",
        description: "Winner selected and round completed!",
      });

      // Force refresh blocks to show updated timeline immediately
      if (refreshBlocks) {
        setTimeout(() => refreshBlocks(), 100);
      }

      setShowTieBreaker(false);
      setTieResolved(true);
      if (onWinnerSelected) {
        
        onWinnerSelected(selectedWinner);
      }
      
      // Automatically advance to next round after a short delay
      if (onNextRound) {
        console.log('🎯 About to call onNextRound in 2 seconds...');
        setTimeout(() => {
          console.log('🎯 Calling onNextRound now!');
          setProcessing(false); // Ensure processing is false before advancing
          onNextRound();
        }, 2000);
      } else {
        console.log('🎯 No onNextRound function provided!');
      }
    } catch (error) {
      console.error('🎯 Error handling tie break:', error);
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
                  <TruncatedText text={suggestion.text} className="text-sm" />
                  <Badge variant="secondary" className="mt-2">
                    {suggestion.voteCount} votes
                  </Badge>
                </div>
              ))}
            </div>

            {!tieResolved ? (
              <Button 
                onClick={() => setShowTieBreaker(true)}
                disabled={isTransitioning}
                className="w-full"
                size="lg"
              >
                <Crown className="mr-2 h-4 w-4" />
                Break Tie
              </Button>
            ) : (
              <div className="w-full p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center text-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Winner Selected
              </div>
            )}
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
                        className="flex-1 cursor-pointer"
                      >
                        <TruncatedText text={suggestion.text} className="text-sm" />
                        <Badge variant="secondary" className="ml-2 mt-1">
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
                <TruncatedText text={suggestion.text} className="text-sm" />
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
          <TruncatedText text={winner.text} className="font-medium text-lg" />
          <Badge variant="secondary" className="mt-2">
            {winner.voteCount} votes
          </Badge>
        </div>

      </CardContent>
    </Card>
  );
}