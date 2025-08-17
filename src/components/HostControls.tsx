import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Table } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { getOrCreateClientId } from '@/utils/clientId';

interface HostControlsProps {
  table: Table;
  canStart: boolean;
  currentPhase: string;
  participantCount: number;
  participants: any[];
  currentParticipant: any;
  onRefresh?: () => void;
  optimisticUpdate?: (updates: any) => void;
}

export function HostControls({ 
  table, 
  canStart, 
  currentPhase, 
  participantCount,
  participants,
  currentParticipant,
  onRefresh,
  optimisticUpdate 
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
    // Check if there's at least 1 non-host participant
    const nonHostParticipants = participants.filter(p => !p.is_host);
    if (nonHostParticipants.length === 0) {
      toast({
        title: "Cannot start",
        description: "At least one participant must join before starting.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      console.log('🚀 Starting table session for:', table.id);

      // Use atomic RPC function to start table session
      const { data, error } = await supabase.rpc('start_table_session', {
        p_table_id: table.id
      });

      if (error) {
        console.error('start_table_session RPC error:', error);
        throw error;
      }

      console.log('✅ Table session started successfully:', data);

      // OPTIMISTIC UPDATE: Immediately update local state
      if (optimisticUpdate && data?.[0]) {
        const newRoundId = data[0].round_id;
        const endsAt = data[0].ends_at;
        const timeRemaining = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
        
        console.log('⚡ Optimistic update: Setting table to running with round', newRoundId);
        optimisticUpdate({
          table: {
            ...table,
            status: 'running',
            current_round_id: newRoundId
          },
          currentRound: {
            id: newRoundId,
            table_id: table.id,
            number: 1,
            status: 'suggest',
            started_at: new Date().toISOString(),
            ends_at: endsAt,
            ended_at: null,
            winner_suggestion_id: null
          },
          timeRemaining
        });
      }

      toast({
        title: "Table Started!",
        description: "The session has begun. Participants can now submit suggestions.",
      });

      // Broadcast phase transition for immediate UI updates
      if (data?.[0]) {
        await supabase
          .channel(`table-${table.id}`)
          .send({
            type: 'broadcast',
            event: 'phase_transition',
            payload: { 
              tableId: table.id, 
              phase: 'suggest', 
              roundId: data[0].round_id 
            }
          });
      }

      // Reduced fallback timeout since we have optimistic update
      setTimeout(() => {
        console.log('🔄 Fallback: refreshing state after start');
        onRefresh?.();
      }, 1000);

    } catch (error: any) {
      console.error('❌ Error starting table:', error);
      
      // Revert optimistic update on error
      if (optimisticUpdate) {
        optimisticUpdate({
          table: {
            ...table,
            status: 'lobby'
          },
          currentRound: null,
          timeRemaining: 0
        });
      }
      
      toast({
        title: "Failed to Start Table",
        description: error.message || "Please try again.",
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
        // OPTIMISTIC UPDATE: Immediately advance phase locally
        const nextPhase = currentPhase === 'suggest' ? 'vote' : 'result';
        console.log('⚡ Optimistic update: Skipping to', nextPhase);
        
        if (optimisticUpdate) {
          optimisticUpdate({
            timeRemaining: 0
          });
        }

        await supabase
          .from('rounds')
          .update({ ends_at: new Date().toISOString() })
          .eq('id', table.current_round_id);

        // Broadcast phase change
        await supabase
          .channel(`table-${table.id}`)
          .send({
            type: 'broadcast',
            event: 'phase_transition',
            payload: { 
              tableId: table.id, 
              phase: nextPhase, 
              roundId: table.current_round_id 
            }
          });
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

  const handleToggleAutoAdvance = async (enabled: boolean) => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('tables')
        .update({ auto_advance: enabled })
        .eq('id', table.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Auto-advance ${enabled ? 'enabled' : 'disabled'}.`,
      });

    } catch (error) {
      console.error('Error updating auto-advance:', error);
      toast({
        title: "Error",
        description: "Failed to update auto-advance setting.",
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


  console.log('🎮 HostControls DEBUG:', { 
    tableStatus: table.status,
    isLobby: table.status === 'lobby',
    isWaiting: table.status === 'waiting',
    shouldShowStart: table.status === 'lobby' || table.status === 'waiting',
    participantCount,
    loading
  });

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
        {(table.status === 'lobby' || table.status === 'waiting') && (
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

        {/* Auto-advance Setting */}
        {table.status === 'running' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-advance">Auto-advance rounds</Label>
              <Switch
                id="auto-advance"
                checked={table.auto_advance}
                onCheckedChange={handleToggleAutoAdvance}
                disabled={loading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically start next round after 3 seconds
            </p>
            <Separator />
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          
          {(table.status === 'lobby' || table.status === 'waiting') && (
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