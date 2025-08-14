import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Table } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { APP_CONFIG } from '@/constants';
import { startSuggestPhase } from '@/utils/roundLogic';

interface HostControlsProps {
  table: Table;
  canStart: boolean;
  currentPhase: string;
  participantCount: number;
  onRefresh?: () => void;
}

export function HostControls({ 
  table, 
  canStart, 
  currentPhase, 
  participantCount,
  onRefresh 
}: HostControlsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestionTime, setSuggestionTime] = useState(table.default_suggest_sec);
  const [votingTime, setVotingTime] = useState(table.default_vote_sec);
  const { toast } = useToast();

  const handleStartTable = async () => {
    try {
      setLoading(true);

      // Create first round
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .insert({
          table_id: table.id,
          number: 1,
          status: 'lobby',
        })
        .select()
        .single();

      if (roundError) throw roundError;

      // Update table status and current round
      const { error: tableError } = await supabase
        .from('tables')
        .update({
          status: 'running',
          current_round_id: round.id,
          default_suggest_sec: suggestionTime,
          default_vote_sec: votingTime,
        })
        .eq('id', table.id);

      if (tableError) throw tableError;

      // Start suggestion phase
      await startSuggestPhase(round.id, suggestionTime);

      toast({
        title: "Success",
        description: "Table started! Suggestion phase is now active.",
      });

      onRefresh?.();

    } catch (error) {
      console.error('Error starting table:', error);
      toast({
        title: "Error", 
        description: "Failed to start table. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTime = async () => {
    try {
      setLoading(true);

      if (table.current_round_id) {
        const { data: round } = await supabase
          .from('rounds')
          .select('ends_at')
          .eq('id', table.current_round_id)
          .single();

        if (round?.ends_at) {
          const newEndsAt = new Date(new Date(round.ends_at).getTime() + 15000).toISOString();
          
          await supabase
            .from('rounds')
            .update({ ends_at: newEndsAt })
            .eq('id', table.current_round_id);
        }
      }

      toast({
        title: "Success",
        description: "Added 15 seconds to the timer.",
      });

      onRefresh?.();

    } catch (error) {
      console.error('Error adding time:', error);
      toast({
        title: "Error",
        description: "Failed to add time. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPhase = async () => {
    try {
      setLoading(true);

      if (table.current_round_id) {
        await supabase
          .from('rounds')
          .update({ ends_at: new Date().toISOString() })
          .eq('id', table.current_round_id);
      }

      toast({
        title: "Success",
        description: "Skipped to next phase.",
      });

      onRefresh?.();

    } catch (error) {
      console.error('Error skipping phase:', error);
      toast({
        title: "Error",
        description: "Failed to skip phase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEndTable = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('tables')
        .update({ 
          status: 'closed',
        })
        .eq('id', table.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Table ended.",
      });

      onRefresh?.();

    } catch (error) {
      console.error('Error ending table:', error);
      toast({
        title: "Error",
        description: "Failed to end table. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('tables')
        .update({
          default_suggest_sec: suggestionTime,
          default_vote_sec: votingTime,
        })
        .eq('id', table.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Timer settings updated.",
      });

    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Host Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={table.status === 'running' ? 'default' : 'secondary'}>
            {table.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Participants:</span>
          <Badge variant="outline">{participantCount}</Badge>
        </div>

        <Separator />

        {/* Timer Settings */}
        {table.status === 'lobby' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="suggestion-time">Suggestion Time (seconds)</Label>
              <Input
                id="suggestion-time"
                type="number"
                min="30"
                max="600"
                value={suggestionTime}
                onChange={(e) => setSuggestionTime(parseInt(e.target.value) || APP_CONFIG.DEFAULT_SUGGEST_SEC)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voting-time">Voting Time (seconds)</Label>
              <Input
                id="voting-time" 
                type="number"
                min="30"
                max="300"
                value={votingTime}
                onChange={(e) => setVotingTime(parseInt(e.target.value) || APP_CONFIG.DEFAULT_VOTE_SEC)}
              />
            </div>
            <Button
              onClick={handleUpdateSettings}
              disabled={loading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Update Settings
            </Button>
            <Separator />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          
          {table.status === 'lobby' && (
            <Button
              onClick={handleStartTable}
              disabled={loading || !canStart}
              className="w-full"
              size="lg"
            >
              {loading ? 'Starting...' : 'Start Table'}
            </Button>
          )}

          {table.status === 'running' && (
            <>
              <Button
                onClick={handleAddTime}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Add +15s
              </Button>

              <Button
                onClick={handleSkipPhase}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                Skip to Next Phase
              </Button>

              <Button
                onClick={handleEndTable}
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                End Table
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}