import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SuggestionInsert, Suggestion } from '@/types';
import { APP_CONFIG, MESSAGES } from '@/constants';
import { useToast } from '@/hooks/use-toast';

interface SuggestionFormProps {
  roundId: string;
  participantId: string;
  optimisticUpdate?: (updates: any) => void;
}

export function SuggestionForm({ roundId, participantId, optimisticUpdate }: SuggestionFormProps) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingSuggestion, setExistingSuggestion] = useState<Suggestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  // Reset form state when round changes
  useEffect(() => {
    console.log('SuggestionForm: Round changed to', roundId);
    setExistingSuggestion(null);
    setIsEditing(false);
    setSuggestion('');
  }, [roundId]);

  // Check for existing suggestion
  useEffect(() => {
    const checkExistingSuggestion = async () => {
      try {
        const { data, error } = await supabase
          .from('suggestions')
          .select('*')
          .eq('round_id', roundId)
          .eq('participant_id', participantId)
          .single();

        if (data && !error) {
          setExistingSuggestion(data);
          setSuggestion(data.text);
          setIsEditing(true);
        }
      } catch (error) {
        // No existing suggestion found, that's fine
      }
    };

    if (roundId && participantId) {
      checkExistingSuggestion();
    }
  }, [roundId, participantId]);

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

    const suggestionText = suggestion.trim();
    const tempId = `temp_${Date.now()}`;

    try {
      setLoading(true);
      
      // OPTIMISTIC UPDATE: Immediately show suggestion in UI
      if (optimisticUpdate && !isEditing) {
        console.log('⚡ Optimistic update: Adding suggestion locally');
        optimisticUpdate({
          suggestions: (prevSuggestions: any[]) => [
            ...prevSuggestions,
            {
              id: tempId,
              round_id: roundId,
              participant_id: participantId,
              text: suggestionText,
              created_at: new Date().toISOString(),
              _isOptimistic: true
            }
          ]
        });
      }
      
      if (isEditing && existingSuggestion) {
        // OPTIMISTIC UPDATE for edit
        if (optimisticUpdate) {
          console.log('⚡ Optimistic update: Updating suggestion locally');
          optimisticUpdate({
            suggestions: (prevSuggestions: any[]) => 
              prevSuggestions.map(s => 
                s.id === existingSuggestion.id 
                  ? { ...s, text: suggestionText, _isOptimistic: true }
                  : s
              )
          });
        }

        // Update existing suggestion
        const { error } = await supabase
          .from('suggestions')
          .update({ text: suggestionText })
          .eq('id', existingSuggestion.id);

        if (error) throw error;
      } else {
        // Insert new suggestion (with upsert to handle conflicts)
        const suggestionData: SuggestionInsert = {
          round_id: roundId,
          participant_id: participantId,
          text: suggestionText,
        };

        const { data, error } = await supabase
          .from('suggestions')
          .upsert(suggestionData, {
            onConflict: 'round_id,participant_id'
          })
          .select()
          .single();

        if (error) throw error;

        // Update optimistic suggestion with real ID
        if (optimisticUpdate && data) {
          console.log('✅ Suggestion confirmed, updating with real ID:', data.id);
          optimisticUpdate({
            suggestions: (prevSuggestions: any[]) => 
              prevSuggestions.map(s => 
                s.id === tempId 
                  ? { ...data, _isOptimistic: false }
                  : s
              )
          });
        }
      }

      // Show success immediately (optimistic)
      toast({
        title: "Success",
        description: isEditing ? "Suggestion updated!" : MESSAGES.SUGGESTION_SUBMITTED,
      });
      
      // Set editing mode after first submission
      setIsEditing(true);
    } catch (error) {
      console.error('❌ Error submitting suggestion:', error);
      
      // REVERT optimistic update on error
      if (optimisticUpdate) {
        console.log('⚠️ Reverting optimistic update due to error');
        if (isEditing && existingSuggestion) {
          // Revert edit
          optimisticUpdate({
            suggestions: (prevSuggestions: any[]) => 
              prevSuggestions.map(s => 
                s.id === existingSuggestion.id 
                  ? { ...s, text: existingSuggestion.text, _isOptimistic: false }
                  : s
              )
          });
        } else {
          // Remove optimistic suggestion
          optimisticUpdate({
            suggestions: (prevSuggestions: any[]) => 
              prevSuggestions.filter(s => s.id !== tempId)
          });
        }
      }
      
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
        <CardTitle>{isEditing ? 'Edit Your Suggestion' : 'Share Your Suggestion'}</CardTitle>
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
              {loading ? (isEditing ? 'Updating...' : 'Submitting...') : (isEditing ? 'Save Changes' : 'Submit Suggestion')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}