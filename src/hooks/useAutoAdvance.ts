import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, Round } from '@/types';
import { advanceRound } from '@/utils/roundLogic';
import { useToast } from '@/hooks/use-toast';

export function useAutoAdvance(
  table: Table | null,
  currentRound: Round | null,
  winningSuggestions: any[],
  isHost: boolean,
  onRefresh?: () => void
) {
  const [countdown, setCountdown] = useState(0);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!table || !currentRound || !table.auto_advance || table.status !== 'running') {
      setCountdown(0);
      return;
    }

    // Only auto-advance from result phase when there's a clear winner
    if (currentRound.status === 'result' && winningSuggestions.length === 1) {
      setCountdown(3);
      
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAutoAdvance();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [table, currentRound, winningSuggestions, table?.auto_advance]);

  const handleAutoAdvance = async () => {
    if (!table || !currentRound || isAutoAdvancing) return;
    
    try {
      setIsAutoAdvancing(true);
      
      // Create next round
      const nextRound = await advanceRound(table.id, currentRound.number);
      
      // Start suggestion phase
      const endsAt = new Date(Date.now() + table.default_suggest_sec * 1000).toISOString();
      
      await supabase
        .from('rounds')
        .update({
          status: 'suggest',
          ends_at: endsAt,
        })
        .eq('id', nextRound.id);

      toast({
        title: "Next Round Started",
        description: `Round ${nextRound.number} has begun. Submit your suggestions!`,
      });

      onRefresh?.();
    } catch (error) {
      console.error('Error auto-advancing round:', error);
      toast({
        title: "Error",
        description: "Failed to start next round automatically.",
        variant: "destructive",
      });
    } finally {
      setIsAutoAdvancing(false);
    }
  };

  return {
    countdown,
    isAutoAdvancing,
    handleAutoAdvance,
  };
}