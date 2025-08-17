import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipForward, Square, Settings, Clock, Users, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Table } from '@/types';

interface EnhancedHostControlsProps {
  table: Table;
  canStart: boolean;
  currentPhase: 'lobby' | 'suggest' | 'vote' | 'result';
  participantCount: number;
  onRefresh?: () => void;
}

export function EnhancedHostControls({ 
  table, 
  canStart, 
  currentPhase, 
  participantCount,
  onRefresh 
}: EnhancedHostControlsProps) {
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [suggestTime, setSuggestTime] = useState(table.default_suggest_sec);
  const [voteTime, setVoteTime] = useState(table.default_vote_sec);
  const { toast } = useToast();

  const handleStartTable = async () => {
    if (!canStart) return;
    
    setLoading(true);
    try {
      // Create initial round and start table
      const endsAt = new Date(Date.now() + table.default_suggest_sec * 1000).toISOString();
      
      const { data: round, error: roundError } = await supabase
        .from('rounds')
        .insert({
          table_id: table.id,
          number: 1,
          status: 'suggest',
          ends_at: endsAt,
        })
        .select()
        .single();

      if (roundError) throw roundError;

      const { error: tableError } = await supabase
        .from('tables')
        .update({
          status: 'running',
          current_round_id: round.id,
        })
        .eq('id', table.id);

      if (tableError) throw tableError;

      // Send system chat message
      await supabase
        .from('chat_messages')
        .insert({
          table_id: table.id,
          user_id: null,
          message: 'Session started! Suggestion phase is now active.',
          message_type: 'system',
        });

      toast({
        title: "Session started!",
        description: "Participants can now submit suggestions.",
      });

      onRefresh?.();
    } catch (error: any) {
      console.error('Error starting table:', error);
      toast({
        title: "Failed to start session",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTime = async (seconds: number) => {
    setLoading(true);
    try {
      const { data: round } = await supabase
        .from('rounds')
        .select('ends_at')
        .eq('id', table.current_round_id)
        .single();

      if (!round?.ends_at) return;

      const newEndTime = new Date(new Date(round.ends_at).getTime() + seconds * 1000).toISOString();
      
      await supabase
        .from('rounds')
        .update({ ends_at: newEndTime })
        .eq('id', table.current_round_id);

      // Send system chat message
      await supabase
        .from('chat_messages')
        .insert({
          table_id: table.id,
          user_id: null,
          message: `Host added ${seconds} seconds to the timer.`,
          message_type: 'system',
        });

      toast({
        title: "Time added",
        description: `Added ${seconds} seconds to the current phase.`,
      });

      onRefresh?.();
    } catch (error: any) {
      console.error('Error adding time:', error);
      toast({
        title: "Failed to add time",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPhase = async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      
      await supabase
        .from('rounds')
        .update({ ends_at: now })
        .eq('id', table.current_round_id);

      // Send system chat message
      await supabase
        .from('chat_messages')
        .insert({
          table_id: table.id,
          user_id: null,
          message: 'Host skipped to the next phase.',
          message_type: 'system',
        });

      toast({
        title: "Phase skipped",
        description: "Moving to the next phase.",
      });

      onRefresh?.();
    } catch (error: any) {
      console.error('Error skipping phase:', error);
      toast({
        title: "Failed to skip phase",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEndTable = async () => {
    setLoading(true);
    try {
      await supabase
        .from('tables')
        .update({ status: 'closed' })
        .eq('id', table.id);

      // Send system chat message
      await supabase
        .from('chat_messages')
        .insert({
          table_id: table.id,
          user_id: null,
          message: 'Session ended by host.',
          message_type: 'system',
        });

      toast({
        title: "Session ended",
        description: "The collaborative session has been closed.",
      });

      onRefresh?.();
    } catch (error: any) {
      console.error('Error ending table:', error);
      toast({
        title: "Failed to end session",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSettings = async () => {
    setLoading(true);
    try {
      await supabase
        .from('tables')
        .update({
          default_suggest_sec: suggestTime,
          default_vote_sec: voteTime,
        })
        .eq('id', table.id);

      toast({
        title: "Settings updated",
        description: "Phase timing settings have been saved.",
      });

      setSettingsOpen(false);
      onRefresh?.();
    } catch (error: any) {
      console.error('Error updating settings:', error);
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportDecisionChain = () => {
    // TODO: Implement export functionality
    toast({
      title: "Export feature",
      description: "Decision chain export coming soon!",
    });
  };

  const getStatusColor = () => {
    switch (table.status) {
      case 'lobby': return 'bg-blue-500';
      case 'running': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Host Controls
            <Badge variant="secondary" className={`${getStatusColor()} text-white`}>
              {table.status}
            </Badge>
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </span>
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Session Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="suggestTime">Suggestion Phase (seconds)</Label>
                  <Input
                    id="suggestTime"
                    type="number"
                    value={suggestTime}
                    onChange={(e) => setSuggestTime(Number(e.target.value))}
                    min={30}
                    max={600}
                  />
                </div>
                <div>
                  <Label htmlFor="voteTime">Voting Phase (seconds)</Label>
                  <Input
                    id="voteTime"
                    type="number"
                    value={voteTime}
                    onChange={(e) => setVoteTime(Number(e.target.value))}
                    min={15}
                    max={300}
                  />
                </div>
                <Button onClick={handleUpdateSettings} disabled={loading} className="w-full">
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" size="sm" onClick={exportDecisionChain}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator className="mb-6" />

      {/* Main Controls */}
      <div className="space-y-4">
        {table.status === 'lobby' && (
          <Button 
            onClick={handleStartTable}
            disabled={!canStart || loading}
            className="w-full"
            size="lg"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Session
          </Button>
        )}

        {table.status === 'running' && (
          <div className="space-y-3">
            {/* Time Controls */}
            <div className="flex gap-2">
              <Button 
                onClick={() => handleAddTime(15)}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                +15s
              </Button>
              <Button 
                onClick={() => handleAddTime(60)}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                +1min
              </Button>
            </div>

            {/* Phase Control */}
            <Button 
              onClick={handleSkipPhase}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              <SkipForward className="h-4 w-4 mr-2" />
              Skip to Next Phase
            </Button>

            <Separator />

            {/* End Session */}
            <Button 
              onClick={handleEndTable}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              <Square className="h-4 w-4 mr-2" />
              End Session
            </Button>
          </div>
        )}

        {table.status === 'closed' && (
          <div className="text-center py-4">
            <p className="text-muted-foreground">Session has ended</p>
            <Button 
              onClick={exportDecisionChain}
              variant="outline"
              className="mt-2"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}