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
import { getOrCreateClientId } from '@/utils/clientId';
import { BackButton } from '@/components/BackButton';

interface HostControlsProps {
  table: Table;
  canStart: boolean;
  currentPhase: string;
  participantCount: number;
  participants: any[];
  currentParticipant: any;
  onRefresh?: () => void;
}

export function HostControls({ 
  table, 
  canStart, 
  currentPhase, 
  participantCount,
  participants,
  currentParticipant,
  onRefresh 
}: HostControlsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestionTime, setSuggestionTime] = useState(table.default_suggest_sec);
  const [votingTime, setVotingTime] = useState(table.default_vote_sec);
  const { toast } = useToast();

  const suggestionPresets = [
    { label: '1 minute', value: 60 },
    { label: '3 minutes', value: 180 },
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 },
    { label: '15 minutes', value: 900 },
    { label: '20 minutes', value: 1200 },
    { label: '30 minutes', value: 1800 },
    { label: '45 minutes', value: 2700 },
    { label: '60 minutes', value: 3600 },
    { label: '120 minutes', value: 7200 },
    { label: '240 minutes', value: 14400 },
    { label: '480 minutes', value: 28800 },
  ];

  const votingPresets = [
    { label: '1 minute', value: 60 },
    { label: '3 minutes', value: 180 },
    { label: '5 minutes', value: 300 },
    { label: '10 minutes', value: 600 },
    { label: '15 minutes', value: 900 },
    { label: '20 minutes', value: 1200 },
    { label: '30 minutes', value: 1800 },
    { label: '45 minutes', value: 2700 },
    { label: '60 minutes', value: 3600 },
    { label: '120 minutes', value: 7200 },
    { label: '240 minutes', value: 14400 },
    { label: '480 minutes', value: 28800 },
  ];

  const handleStartTable = async () => {
    // Check if there's at least 1 participant (including host)
    if (participants.length === 0) {
      toast({
        title: "Cannot start",
        description: "At least one participant must join before starting.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      // Starting table session

      // Use atomic RPC function to start table session
      const { data, error } = await supabase.rpc('start_table_session', {
        p_table_id: table.id
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Table Started!",
        description: "The session has begun. Participants can now submit suggestions.",
      });

      // IMMEDIATE refresh after table start
      setTimeout(() => {
        onRefresh?.();
      }, 100);

    } catch (error: any) {
      console.error('Error starting table:', error);
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
        // Import and use the updated addTimeToPhase function
        const { addTimeToPhase } = await import('@/utils/roundLogic');
        await addTimeToPhase(table.current_round_id, 15, table.id);
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
        // Import and use the updated skipToNextPhase function
        const { skipToNextPhase } = await import('@/utils/roundLogic');
        await skipToNextPhase(table.current_round_id, table.id, table.default_vote_sec, table.default_suggest_sec);
      }

      toast({
        title: "Success", 
        description: getSkipPhaseMessage(currentPhase),
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

  const getSkipPhaseMessage = (phase: string) => {
    switch (phase) {
      case 'suggest': return 'Moved to voting phase.';
      case 'vote': return 'Round ended, showing results.';
      case 'result': return 'Advanced to next round.';
      case 'lobby': return 'Started suggestion phase.';
      default: return 'Skipped to next phase.';
    }
  };

  const getSkipButtonLabel = (phase: string) => {
    switch (phase) {
      case 'suggest': return 'Start Voting';
      case 'vote': return 'End Round';
      case 'result': return 'Next Round';
      case 'lobby': return 'Start Suggestions';
      default: return 'Skip to Next Phase';
    }
  };

  const shouldShowAddTime = (phase: string) => {
    return phase === 'suggest' || phase === 'vote';
  };

  const handleEndTable = async () => {
    try {
      setLoading(true);

      const { error } = await supabase
        .from('tables')
        .update({ 
          status: 'closed',
          current_round_id: null // Clear current round when ending
        })
        .eq('id', table.id);

      if (error) throw error;

      // Auto-save to GitHub after successfully ending table
      try {
        await supabase.functions.invoke('auto-save-to-github', {
          body: { tableCode: table.code }
        });
        console.log('Discussion summary auto-saved to GitHub successfully');
      } catch (githubError) {
        console.error('Failed to auto-save to GitHub:', githubError);
        // Don't fail the table ending if GitHub save fails
      }

      toast({
        title: "Success",
        description: "Table ended successfully. Summary saved to GitHub.",
      });

      // Force immediate refresh to propagate changes
      setTimeout(() => {
        onRefresh?.();
      }, 100);

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


        {/* Actions */}
        <div className="space-y-2">
          
          {table.status === 'lobby' && (
            <>
              <Button
                onClick={handleStartTable}
                disabled={loading}
                className="w-full md:w-auto"
                size="lg"
              >
                {loading ? 'Starting...' : 'Start Table'}
              </Button>
              
              <BackButton
                variant="outline"
                size="sm"
                className="w-full md:w-auto"
                confirmationTitle="Cancel Session?"
                confirmationDescription="This will end the session and return everyone to the home page."
                showConfirmation={true}
              >
                Cancel Session
              </BackButton>
            </>
          )}

          {table.status === 'running' && (
            <>
              {shouldShowAddTime(currentPhase) && (
                <Button
                  onClick={handleAddTime}
                  disabled={loading}
                  variant="outline"
                  className="w-full md:w-auto"
                >
                  Add +15s
                </Button>
              )}

              <Button
                onClick={handleSkipPhase}
                disabled={loading}
                variant="outline"
                className="w-full md:w-auto"
              >
                {getSkipButtonLabel(currentPhase)}
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