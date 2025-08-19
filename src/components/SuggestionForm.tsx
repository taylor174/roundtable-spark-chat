import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SuggestionInsert, Suggestion } from '@/types';
import { APP_CONFIG, MESSAGES } from '@/constants';
import { useToast } from '@/hooks/use-toast';
import { withRetry } from '@/utils/retryLogic';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useDebounce } from '@/hooks/useDebounce';

interface SuggestionFormProps {
  roundId: string;
  participantId: string;
}

export function SuggestionForm({ roundId, participantId }: SuggestionFormProps) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingSuggestion, setExistingSuggestion] = useState<Suggestion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { toast } = useToast();
  const { handleAsyncOperation } = useErrorHandler();

  // Check for existing suggestion with retry
  useEffect(() => {
    const checkExistingSuggestion = async () => {
      await handleAsyncOperation(async () => {
        return withRetry(async () => {
          const { data, error } = await supabase
            .from('suggestions')
            .select('*')
            .eq('round_id', roundId)
            .eq('participant_id', participantId)
            .maybeSingle();

          if (data && !error) {
            setExistingSuggestion(data);
            setSuggestion(data.text);
            setIsEditing(true);
          }
          return data;
        }, {
          maxAttempts: 2,
          retryCondition: (error) => 
            error?.message?.includes('network') || 
            error?.message?.includes('timeout')
        });
      }, {
        operation: 'loading existing suggestion',
        component: 'SuggestionForm'
      });
    };

    checkExistingSuggestion();
  }, [roundId, participantId, handleAsyncOperation]);

  // Monitor connection status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Debounced auto-save for better UX
  const debouncedAutoSave = useDebounce(async (text: string) => {
    if (isEditing && existingSuggestion && text.trim() && text !== existingSuggestion.text) {
      await handleAsyncOperation(async () => {
        return withRetry(async () => {
          const { error } = await supabase
            .from('suggestions')
            .update({ text: text.trim() })
            .eq('id', existingSuggestion.id);
          
          if (error) throw error;
          return { success: true };
        }, {
          maxAttempts: 3,
          retryCondition: (error) => 
            error?.message?.includes('network') || 
            error?.message?.includes('timeout') ||
            error?.message?.includes('constraint')
        });
      }, {
        operation: 'auto-saving suggestion',
        component: 'SuggestionForm'
      });
    }
  }, 2000);

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

    if (isOffline) {
      toast({
        title: "Offline",
        description: "You're offline. Your suggestion will be saved when connection is restored.",
        variant: "destructive",
      });
      return;
    }

    const result = await handleAsyncOperation(async () => {
      setLoading(true);
      
      return withRetry(async () => {
        if (isEditing && existingSuggestion) {
          // Update existing suggestion with optimistic conflict resolution
          const { error } = await supabase
            .from('suggestions')
            .update({ 
              text: suggestion.trim(),
              created_at: new Date().toISOString() // Update timestamp to resolve conflicts
            })
            .eq('id', existingSuggestion.id);

          if (error) throw error;
        } else {
          // Insert new suggestion with better conflict handling
          const suggestionData: SuggestionInsert = {
            round_id: roundId,
            participant_id: participantId,
            text: suggestion.trim(),
          };

          const { error } = await supabase
            .from('suggestions')
            .upsert(suggestionData, {
              onConflict: 'round_id,participant_id',
              ignoreDuplicates: false
            });

          if (error) throw error;
        }
        
        return { success: true };
      }, {
        maxAttempts: 5,
        delay: 1000,
        backoffMultiplier: 1.5,
        retryCondition: (error) => 
          error?.message?.includes('network') || 
          error?.message?.includes('timeout') ||
          error?.message?.includes('constraint') ||
          error?.code === 'PGRST301' // Unique violation
      });
    }, {
      operation: isEditing ? 'updating suggestion' : 'submitting suggestion',
      component: 'SuggestionForm',
      userMessage: isEditing ? 
        'Failed to update suggestion. Please try again or refresh the page.' :
        'Failed to submit suggestion. Please try again or refresh the page.'
    });

    if (result?.success) {
      toast({
        title: "Success",
        description: isEditing ? "Suggestion updated!" : MESSAGES.SUGGESTION_SUBMITTED,
      });
      
      // Set editing mode after first submission
      if (!isEditing) {
        setIsEditing(true);
      }
    }
    
    setLoading(false);
  };

  // Trigger auto-save when text changes
  useEffect(() => {
    if (suggestion.trim()) {
      debouncedAutoSave(suggestion);
    }
  }, [suggestion, debouncedAutoSave]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Your Suggestion' : 'Share Your Suggestion'}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          {MESSAGES.SUGGEST_PHASE}
          {isOffline && (
            <span className="block text-destructive text-sm mt-1">
              ⚠️ You're offline. Changes will be saved when connection is restored.
            </span>
          )}
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