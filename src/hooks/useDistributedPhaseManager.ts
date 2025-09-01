import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, Round, Participant } from '@/types';
import { useErrorHandler } from '@/hooks/useErrorHandler';

interface PhaseStuckState {
  isStuck: boolean;
  stuckDuration: number;
  lastAdvanceAttempt: number;
  participantCanAct: boolean;
}

export function useDistributedPhaseManager(
  table: Table | null,
  currentRound: Round | null,
  timeRemaining: number,
  clientId: string,
  isHost: boolean,
  participants: Participant[] = [],
  onRefresh?: () => void
) {
  const [phaseStuck, setPhaseStuck] = useState<PhaseStuckState>({
    isStuck: false,
    stuckDuration: 0,
    lastAdvanceAttempt: 0,
    participantCanAct: false
  });
  const [emergencyMode, setEmergencyMode] = useState(false);
  const { handleAsyncOperation } = useErrorHandler();

  // Check if current participant can act as backup host
  const canActAsBackup = useCallback(() => {
    if (!participants.length || isHost) return false;
    
    // Sort participants by join time to establish backup priority
    const sortedParticipants = [...participants].sort((a, b) => 
      new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );
    
    // Find current participant and check if they're next in line (after host)
    const currentParticipant = participants.find(p => p.client_id === clientId);
    if (!currentParticipant) return false;
    
    const backupIndex = sortedParticipants.findIndex(p => p.client_id === clientId);
    return backupIndex <= 1; // Host is 0, first backup is 1
  }, [participants, clientId, isHost]);

  // Detect if phase is stuck
  useEffect(() => {
    if (!table || !currentRound || table.status !== 'running') {
      setPhaseStuck(prev => ({ ...prev, isStuck: false, stuckDuration: 0 }));
      return;
    }

    const checkStuckPhase = () => {
      const now = Date.now();
      const hasEndTime = !!currentRound.ends_at;
      const isExpired = hasEndTime && timeRemaining <= 0;
      const roundAge = currentRound.started_at ? 
        now - new Date(currentRound.started_at).getTime() : 0;
      
      // Consider phase stuck if:
      // 1. Timer expired for more than 30 seconds, OR
      // 2. Round has been in same phase for more than 5 minutes without timer
      const stuckThreshold = isExpired ? 30000 : 300000; // 30s if expired, 5min if no timer
      const isCurrentlyStuck = (isExpired && timeRemaining <= -30) || 
                              (!hasEndTime && roundAge > 300000);
      
      if (isCurrentlyStuck) {
        setPhaseStuck(prev => ({
          isStuck: true,
          stuckDuration: Math.max(0, -timeRemaining * 1000),
          lastAdvanceAttempt: prev.lastAdvanceAttempt,
          participantCanAct: canActAsBackup()
        }));
      } else {
        setPhaseStuck(prev => ({ ...prev, isStuck: false, stuckDuration: 0 }));
      }
    };

    const interval = setInterval(checkStuckPhase, 5000); // Check every 5 seconds
    checkStuckPhase(); // Initial check

    return () => clearInterval(interval);
  }, [table, currentRound, timeRemaining, canActAsBackup]);

  // Emergency phase advancement for participants
  const emergencyAdvancePhase = useCallback(async () => {
    if (!table || !currentRound || !phaseStuck.participantCanAct) {
      console.log('❌ Cannot perform emergency advance - conditions not met');
      return false;
    }

    const now = Date.now();
    const timeSinceLastAttempt = now - phaseStuck.lastAdvanceAttempt;
    
    // Rate limiting: only attempt once per minute
    if (timeSinceLastAttempt < 60000) {
      console.log('🕐 Emergency advance rate limited, waiting...');
      return false;
    }

    console.log('🆘 EMERGENCY: Participant attempting phase advancement', {
      clientId,
      roundId: currentRound.id,
      tableId: table.id,
      stuckDuration: phaseStuck.stuckDuration
    });

    setEmergencyMode(true);
    setPhaseStuck(prev => ({ ...prev, lastAdvanceAttempt: now }));

    const success = await handleAsyncOperation(async () => {
      const { data, error } = await supabase.rpc('advance_phase_atomic_v2', {
        p_round_id: currentRound.id,
        p_table_id: table.id,
        p_client_id: clientId
      });

      if (error) throw error;

      const result = data as any;
      if (result?.success) {
        console.log('✅ Emergency phase advancement succeeded');
        onRefresh?.();
        return true;
      } else {
        throw new Error(result?.error || 'Emergency advancement failed');
      }
    }, {
      operation: 'emergency_phase_advance',
      component: 'DistributedPhaseManager'
    });

    setEmergencyMode(false);
    return !!success;
  }, [table, currentRound, phaseStuck, clientId, handleAsyncOperation, onRefresh]);

  // Force emergency sync when phase is critically stuck
  const forceEmergencySync = useCallback(async () => {
    if (!onRefresh) return;
    
    console.log('🔄 EMERGENCY: Forcing complete state sync');
    await handleAsyncOperation(async () => {
      onRefresh();
    }, {
      operation: 'emergency_sync',
      component: 'DistributedPhaseManager'
    });
  }, [onRefresh, handleAsyncOperation]);

  return {
    phaseStuck,
    emergencyMode,
    canActAsBackup: canActAsBackup(),
    emergencyAdvancePhase,
    forceEmergencySync
  };
}