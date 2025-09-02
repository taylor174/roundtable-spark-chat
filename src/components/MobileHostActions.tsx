import { useState } from 'react';
import { Play, Clock, SkipForward, Square, Users, Settings } from 'lucide-react';
import { TouchOptimizedButton } from '@/components/TouchOptimizedButton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Table } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface MobileHostActionsProps {
  table: Table;
  currentPhase: string;
  participantCount: number;
  participants: any[];
  onRefresh?: () => void;
  className?: string;
}

export function MobileHostActions({ 
  table, 
  currentPhase, 
  participantCount,
  participants,
  onRefresh,
  className 
}: MobileHostActionsProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Only show on mobile
  if (!isMobile) return null;

  const handleStartTable = async () => {
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
      const { data, error } = await supabase.rpc('start_table_session', {
        p_table_id: table.id
      });

      if (error) throw error;

      toast({
        title: "Table Started!",
        description: "The session has begun.",
      });

      setTimeout(() => onRefresh?.(), 100);
    } catch (error: any) {
      toast({
        title: "Failed to Start",
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
        const { addTimeToPhase } = await import('@/utils/roundLogic');
        await addTimeToPhase(table.current_round_id, 15, table.id);
      }
      toast({
        title: "Success",
        description: "Added 15 seconds.",
      });
      onRefresh?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add time.",
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
        const { skipToNextPhase } = await import('@/utils/roundLogic');
        await skipToNextPhase(table.current_round_id, table.id, table.default_vote_sec, table.default_suggest_sec);
      }
      
      const messages = {
        suggest: 'Started voting!',
        vote: 'Showing results!',
        result: 'Next round started!',
        lobby: 'Started suggestions!'
      };

      toast({
        title: "Success",
        description: messages[currentPhase as keyof typeof messages] || 'Phase advanced!',
      });
      onRefresh?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to advance phase.",
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
          current_round_id: null
        })
        .eq('id', table.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Table ended.",
      });
      setTimeout(() => onRefresh?.(), 100);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to end table.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionButtons = () => {
    if (table.status === 'lobby') {
      return (
        <TouchOptimizedButton
          onClick={handleStartTable}
          disabled={loading}
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          touchSize="large"
        >
          <Play className="h-4 w-4 mr-1" />
          Start
        </TouchOptimizedButton>
      );
    }

    if (table.status === 'running') {
      const buttons = [];
      
      // Add time button for suggest/vote phases
      if (currentPhase === 'suggest' || currentPhase === 'vote') {
        buttons.push(
          <TouchOptimizedButton
            key="add-time"
            onClick={handleAddTime}
            disabled={loading}
            variant="outline"
            touchSize="large"
            className="min-w-0"
          >
            <Clock className="h-3 w-3 mr-1" />
            +15s
          </TouchOptimizedButton>
        );
      }

      // Main action button
      const phaseActions = {
        suggest: { icon: Users, label: 'Vote', variant: 'default' as const },
        vote: { icon: Square, label: 'Results', variant: 'default' as const },
        result: { icon: SkipForward, label: 'Next Round', variant: 'default' as const }
      };

      const action = phaseActions[currentPhase as keyof typeof phaseActions];
      if (action) {
        buttons.push(
          <TouchOptimizedButton
            key="main-action"
            onClick={handleSkipPhase}
            disabled={loading}
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            touchSize="large"
          >
            <action.icon className="h-4 w-4 mr-1" />
            {action.label}
          </TouchOptimizedButton>
        );
      }

      // End table button
      buttons.push(
        <TouchOptimizedButton
          key="end-table"
          onClick={handleEndTable}
          disabled={loading}
          variant="destructive"
          touchSize="large"
          className="min-w-0"
        >
          <Square className="h-3 w-3 mr-1" />
          End
        </TouchOptimizedButton>
      );

      return buttons;
    }

    return null;
  };

  const actionButtons = getActionButtons();
  if (!actionButtons) return null;

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border",
      "p-3 flex items-center gap-2 shadow-lg",
      className
    )}>
      {Array.isArray(actionButtons) ? (
        actionButtons.map((button, index) => (
          <div key={index} className={button.key === 'main-action' ? 'flex-1' : ''}>
            {button}
          </div>
        ))
      ) : (
        actionButtons
      )}
    </div>
  );
}