import { useEffect, useState } from 'react';
import { Clock, Wifi, WifiOff } from 'lucide-react';
import { formatTime } from '@/utils';
import { useConnectionMonitor } from '@/hooks/useConnectionMonitor';

interface TimerProps {
  timeRemaining: number;
  phase: string;
  isActive?: boolean;
}

export function Timer({ timeRemaining, phase, isActive = true }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(timeRemaining);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const { quality } = useConnectionMonitor();

  useEffect(() => {
    setDisplayTime(timeRemaining);
    setLastSyncTime(Date.now());
  }, [timeRemaining]);

  // Detect timer drift and show warning
  const timeSinceLastSync = (Date.now() - lastSyncTime) / 1000;
  const isDriftWarning = timeSinceLastSync > 10 && quality !== 'good';

  const isLowTime = displayTime <= 30;
  const isVeryLowTime = displayTime <= 10;

  return (
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
          {phase === 'suggest' ? 'Suggesting' : 'Voting'} Time
          {!isActive && ' (paused)'}
          {isDriftWarning && ' (may be inaccurate)'}
        </div>
      </div>
    </div>
  );
}