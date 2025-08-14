import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableUpdate, RoundInsert } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { APP_CONFIG } from '@/constants';
import { 
  Play, 
  Settings, 
  SkipForward, 
  Plus, 
  StopCircle, 
  Loader2,
  Crown
} from 'lucide-react';

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
  const [suggestionTime, setSuggestionTime] = useState(table.suggestion_seconds);
  const [votingTime, setVotingTime] = useState(table.voting_seconds);
  const { toast } = useToast();

  const handleStartTable = async () => {
    try {
      setLoading(true);

      // Create first round
      const roundData: RoundInsert = {
        table_id: table.id,
        round_index: 1,
        status: 'suggestions',
      };

      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .insert(roundData)
        .select()
        .single();

      if (roundError) throw roundError;

      // Update table status and current round
      const phaseEndTime = new Date(Date.now() + suggestionTime * 1000);
      
      const tableUpdate: TableUpdate = {
        status: 'active',
        current_round_id: round.id,
        phase_ends_at: phaseEndTime.toISOString(),
        suggestion_seconds: suggestionTime,
        voting_seconds: votingTime,
      };

      const { error: tableError } = await supabase
        .from('tables')
        .update(tableUpdate)
        .eq('id', table.id);

      if (tableError) throw tableError;

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

      const currentEndTime = new Date(table.phase_ends_at || '');
      const newEndTime = new Date(currentEndTime.getTime() + 15000); // +15 seconds

      const { error } = await supabase
        .from('tables')
        .update({ phase_ends_at: newEndTime.toISOString() })
        .eq('id', table.id);

      if (error) throw error;

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

      // Set phase end time to now
      const { error } = await supabase
        .from('tables')
        .update({ phase_ends_at: new Date().toISOString() })
        .eq('id', table.id);

      if (error) throw error;

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
          status: 'ended',
          phase_ends_at: null,
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
          suggestion_seconds: suggestionTime,
          voting_seconds: votingTime,
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
        <CardTitle className="flex items-center space-x-2">
          <Crown className="h-5 w-5" />
          <span>Host Controls</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Badge variant={table.status === 'active' ? 'default' : 'secondary'}>
            {table.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Participants:</span>
          <Badge variant="outline">{participantCount}</Badge>
        </div>

        <Separator />

        {/* Timer Settings */}
        {table.status === 'waiting' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="suggestion-time">Suggestion Time (seconds)</Label>
              <Input
                id="suggestion-time"
                type="number"
                min="30"
                max="600"
                value={suggestionTime}
                onChange={(e) => setSuggestionTime(parseInt(e.target.value) || APP_CONFIG.DEFAULT_SUGGESTION_SECONDS)}
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
                onChange={(e) => setVotingTime(parseInt(e.target.value) || APP_CONFIG.DEFAULT_VOTING_SECONDS)}
              />
            </div>
            <Button
              onClick={handleUpdateSettings}
              disabled={loading}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Settings className="mr-2 h-4 w-4" />
              Update Settings
            </Button>
            <Separator />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          
          {table.status === 'waiting' && (
            <Button
              onClick={handleStartTable}
              disabled={loading || !canStart}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Table
                </>
              )}
            </Button>
          )}

          {table.status === 'active' && (
            <>
              <Button
                onClick={handleAddTime}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add +15s
              </Button>

              <Button
                onClick={handleSkipPhase}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Skip to Next Phase
              </Button>

              <Button
                onClick={handleEndTable}
                disabled={loading}
                variant="destructive"
                className="w-full"
              >
                <StopCircle className="mr-2 h-4 w-4" />
                End Table
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}