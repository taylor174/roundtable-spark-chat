import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Table } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { APP_CONFIG } from '@/constants';
import { startSuggestPhase } from '@/utils/roundLogic';
import { getOrCreateClientId } from '@/utils/clientId';

interface HostControlsProps {
  table: Table;
  canStart: boolean;
  currentPhase: string;
  participantCount: number;
  currentParticipant: any;
  onRefresh?: () => void;
}

export function HostControls({ 
  table, 
  canStart, 
  currentPhase, 
  participantCount,
  currentParticipant,
  onRefresh 
}: HostControlsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestionTime, setSuggestionTime] = useState(table.default_suggest_sec);
  const [votingTime, setVotingTime] = useState(table.default_vote_sec);
  const { toast } = useToast();

  const suggestionPresets = [
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 },
    { label: '15 minutes', value: 900 },
    { label: '20 minutes', value: 1200 },
    { label: '30 minutes', value: 1800 },
    { label: '40 minutes', value: 2400 },
    { label: '50 minutes', value: 3000 },
    { label: '60 minutes', value: 3600 },
  ];

  const votingPresets = [
    { label: '30 seconds', value: 30 },
    { label: '60 seconds', value: 60 },
    { label: '90 seconds', value: 90 },
    { label: '2 minutes', value: 120 },
    { label: '3 minutes', value: 180 },
  ];

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

  const handleJoinAsParticipant = async () => {
    try {
      setLoading(true);
      const clientId = getOrCreateClientId();

      const { error } = await supabase
        .from('participants')
        .insert({
          table_id: table.id,
          client_id: clientId,
          display_name: 'Host',
          is_host: true,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "You can now participate in voting and suggestions.",
      });

      onRefresh?.();

    } catch (error) {
      console.error('Error joining as participant:', error);
      toast({
        title: "Error",
        description: "Failed to join as participant. Please try again.",
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
              <Label htmlFor="suggestion-time">Suggestion Time</Label>
              <Select value={suggestionTime.toString()} onValueChange={(value) => setSuggestionTime(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {suggestionPresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voting-time">Voting Time</Label>
              <Select value={votingTime.toString()} onValueChange={(value) => setVotingTime(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {votingPresets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value.toString()}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        {/* Host Participation */}
        {!currentParticipant && table.status === 'running' && (
          <div className="space-y-2">
            <Button
              onClick={handleJoinAsParticipant}
              disabled={loading}
              variant="outline"
              className="w-full md:w-auto"
            >
              Join as Participant
            </Button>
            <Separator />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          
          {table.status === 'lobby' && (
            <Button
              onClick={handleStartTable}
              disabled={loading}
              className="w-full md:w-auto"
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
                className="w-full md:w-auto"
              >
                Add +15s
              </Button>

              <Button
                onClick={handleSkipPhase}
                disabled={loading}
                variant="outline"
                className="w-full md:w-auto"
              >
                Skip to Next Phase
              </Button>

              <Button
                onClick={handleEndTable}
                disabled={loading}
                variant="destructive"
                className="w-full md:w-auto"
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