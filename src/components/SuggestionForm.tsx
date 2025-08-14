import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ProposalInsert } from '@/types';
import { isValidSuggestion } from '@/utils';
import { useToast } from '@/hooks/use-toast';
import { MESSAGES, APP_CONFIG } from '@/constants';
import { Send, Loader2 } from 'lucide-react';

interface SuggestionFormProps {
  roundId: string;
  participantId: string;
  disabled?: boolean;
}

export function SuggestionForm({ roundId, participantId, disabled = false }: SuggestionFormProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!isValidSuggestion(text)) {
      toast({
        title: "Error",
        description: text.trim().length === 0 ? "Please enter a suggestion" : MESSAGES.SUGGESTION_TOO_LONG,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const proposalData: ProposalInsert = {
        round_id: roundId,
        participant_id: participantId,
        text: text.trim(),
      };

      const { error } = await supabase
        .from('proposals')
        .insert(proposalData);

      if (error) throw error;

      setText('');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charactersLeft = APP_CONFIG.MAX_SUGGESTION_LENGTH - text.length;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Enter your suggestion..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled || loading}
              maxLength={APP_CONFIG.MAX_SUGGESTION_LENGTH}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className={`text-sm ${
                charactersLeft < 20 ? 'text-destructive' : 'text-muted-foreground'
              }`}>
                {charactersLeft} characters left
              </span>
              <Button
                onClick={handleSubmit}
                disabled={disabled || loading || !isValidSuggestion(text)}
                size="sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}