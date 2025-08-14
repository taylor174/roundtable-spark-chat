import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SuggestionInsert } from '@/types';
import { APP_CONFIG, MESSAGES } from '@/constants';
import { useToast } from '@/hooks/use-toast';

interface SuggestionFormProps {
  roundId: string;
  participantId: string;
}

export function SuggestionForm({ roundId, participantId }: SuggestionFormProps) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (suggestion.trim().length === 0) {
      toast({
        title: "Error",
        description: "Please enter a suggestion",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const suggestionData: SuggestionInsert = {
        round_id: roundId,
        participant_id: participantId,
        text: suggestion.trim(),
      };

      const { error } = await supabase
        .from('suggestions')
        .insert(suggestionData);

      if (error) throw error;

      setSuggestion('');
      toast({
        title: "Success",
        description: MESSAGES.SUGGESTION_SUBMITTED,
      });
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to submit suggestion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Your Suggestion</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          {MESSAGES.SUGGEST_PHASE}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Enter your suggestion..."
            maxLength={APP_CONFIG.MAX_SUGGESTION_LENGTH}
            disabled={loading}
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {APP_CONFIG.MAX_SUGGESTION_LENGTH - suggestion.length} characters remaining
            </span>
            <Button type="submit" disabled={loading || suggestion.trim().length === 0}>
              {loading ? 'Submitting...' : 'Submit Suggestion'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}