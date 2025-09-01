import { useEffect, useState } from 'react';
import { Clock, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { formatTime } from '@/utils';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';
import { useConnectionQuality } from '@/hooks/useConnectionQuality';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TimerProps {
  timeRemaining: number;
  phase: string;
  isActive?: boolean;
  endTime?: string | null;
}

export function Timer({ timeRemaining, phase, isActive = true, endTime }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(timeRemaining);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [driftOffset, setDriftOffset] = useState(0);
  const connectionStatus = useConnectionMonitor();
  const { quality } = useConnectionQuality();

  useEffect(() => {
    if (endTime) {
      const updateTimer = () => {
        const now = new Date();
        const end = new Date(endTime);
        
        // Account for network latency and drift
        const networkLatency = quality.latency / 2;
        const remaining = Math.max(0, Math.floor((end.getTime() - now.getTime() + driftOffset - networkLatency) / 1000));
        setDisplayTime(remaining);
        setLastSyncTime(Date.now());
      };

      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else {
      setDisplayTime(timeRemaining);
      setLastSyncTime(Date.now());
    }
  }, [timeRemaining, endTime, driftOffset, quality.latency]);

  // Detect timer drift and show warning
  const timeSinceLastSync = (Date.now() - lastSyncTime) / 1000;
  const isDriftWarning = timeSinceLastSync > 10 && quality.level !== 'excellent';

  const isLowTime = displayTime <= 30;
  const isVeryLowTime = displayTime <= 10;

  return (
    <div className="space-y-4">
      {/* Connection Quality Warnings */}
      {!connectionStatus.isOnline && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You're offline. Timer may not be accurate.
          </AlertDescription>
        </Alert>
      )}

      {quality.level === 'poor' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Poor connection quality (latency: {quality.latency}ms). Timer synchronization may be affected.
          </AlertDescription>
        </Alert>
      )}

      {quality.level === 'disconnected' && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            Connection lost. Timer may not be accurate.
          </AlertDescription>
        </Alert>
      )}

      {Math.abs(driftOffset) > 5000 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Clock drift detected ({Math.round(driftOffset/1000)}s). Timer may need synchronization.
          </AlertDescription>
        </Alert>
      )}

      {/* Timer Display */}
      <div className="flex items-center space-x-3">
        <div className="relative">
          <Clock className="h-6 w-6 text-primary" />
          {isDriftWarning && (
            <div className="absolute -top-1 -right-1">
              <WifiOff className="h-3 w-3 text-amber-500" />
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={`text-4xl sm:text-5xl font-bold font-mono tracking-wide ${
            isVeryLowTime ? 'text-destructive animate-pulse' : 
            isLowTime ? 'text-amber-500' : 
            isDriftWarning ? 'text-amber-500' :
            'text-foreground'
          }`}>
            {isActive ? formatTime(displayTime) : '--:--'}
          </div>
          <div className="text-sm text-muted-foreground">
            {displayTime === 0 && isActive ? "Time's up!" : 
             phase === 'suggest' ? 'Suggesting' : 
             phase === 'vote' ? 'Voting' : 
             phase === 'result' ? 'Results' : 'Phase'} Time
            {!isActive && ' (paused)'}
            {isDriftWarning && ' (may be inaccurate)'}
          </div>
        </div>
      </div>
    </div>
  );
}