import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Wifi, WifiOff, RefreshCw, Clock, Users } from 'lucide-react';
import { useDistributedPhaseManager } from '@/hooks/useDistributedPhaseManager';
import { useRealtimeReliability } from '@/hooks/useRealtimeReliability';
import { Table, Round, Participant } from '@/types';

interface PhaseTransitionMonitorProps {
  table: Table | null;
  currentRound: Round | null;
  timeRemaining: number;
  clientId: string;
  isHost: boolean;
  participants: Participant[];
  onRefresh?: () => void;
}

export function PhaseTransitionMonitor({
  table,
  currentRound,
  timeRemaining,
  clientId,
  isHost,
  participants,
  onRefresh
}: PhaseTransitionMonitorProps) {
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const {
    phaseStuck,
    emergencyMode,
    canActAsBackup,
    emergencyAdvancePhase,
    forceEmergencySync
  } = useDistributedPhaseManager(
    table,
    currentRound,
    timeRemaining,
    clientId,
    isHost,
    participants,
    onRefresh
  );

  const {
    connectionHealth,
    isReliable,
    attemptReconnection
  } = useRealtimeReliability(table?.id || null);

  // Update diagnostic information
  useEffect(() => {
    if (table && currentRound) {
      setDiagnosticInfo({
        tableStatus: table.status,
        roundStatus: currentRound.status,
        roundId: currentRound.id,
        timeRemaining,
        phaseStuck: phaseStuck.isStuck,
        stuckDuration: phaseStuck.stuckDuration,
        connectionHealthy: connectionHealth.isHealthy,
        missedHeartbeats: connectionHealth.missedHeartbeats,
        reconnectAttempts: connectionHealth.reconnectAttempts,
        canActAsBackup,
        isHost,
        participantCount: participants.length,
        timestamp: new Date().toISOString()
      });
    }
  }, [table, currentRound, timeRemaining, phaseStuck, connectionHealth, canActAsBackup, isHost, participants]);

  // Don't show monitor if table isn't running
  if (!table || table.status !== 'running' || !currentRound) {
    return null;
  }

  const showPhaseStuckAlert = phaseStuck.isStuck && (isHost || canActAsBackup);
  const showConnectionAlert = !connectionHealth.isHealthy;

  return (
    <div className="space-y-3">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        {isReliable ? (
          <div className="flex items-center gap-1 text-green-600">
            <Wifi className="h-4 w-4" />
            <span>Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-600">
            <WifiOff className="h-4 w-4" />
            <span>Connection Issues</span>
          </div>
        )}
        
        {isHost && (
          <Badge variant="outline" className="text-xs">
            Host
          </Badge>
        )}
        
        {canActAsBackup && (
          <Badge variant="secondary" className="text-xs">
            Backup
          </Badge>
        )}
      </div>

      {/* Phase Stuck Alert */}
      {showPhaseStuckAlert && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-800">
                Phase appears stuck ({Math.floor(phaseStuck.stuckDuration / 1000)}s)
              </span>
              <div className="flex gap-2">
                {canActAsBackup && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={emergencyAdvancePhase}
                    disabled={emergencyMode}
                    className="h-8 text-xs"
                  >
                    {emergencyMode ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Advancing...
                      </>
                    ) : (
                      'Emergency Advance'
                    )}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={forceEmergencySync}
                  className="h-8 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Issues Alert */}
      {showConnectionAlert && (
        <Alert className="border-red-200 bg-red-50">
          <WifiOff className="h-4 w-4 text-red-600" />
          <AlertDescription className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-red-800">
                Connection unstable (missed: {connectionHealth.missedHeartbeats})
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={attemptReconnection}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Phase Information */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>Round {currentRound.number}</span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          <span>{participants.length} participants</span>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
            className="h-6 text-xs p-1"
          >
            Debug
          </Button>
        )}
      </div>

      {/* Diagnostic Information (Development Only) */}
      {showDiagnostics && process.env.NODE_ENV === 'development' && diagnosticInfo && (
        <div className="bg-gray-100 p-3 rounded text-xs font-mono space-y-1">
          <div className="font-bold text-gray-700">Diagnostic Information:</div>
          {Object.entries(diagnosticInfo).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-600">{key}:</span>
              <span className="text-gray-800">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}