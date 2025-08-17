import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { formatTime } from '@/utils';

interface TimerProps {
  timeRemaining: number;
  phase: string;
  isActive?: boolean;
}

export function Timer({ timeRemaining, phase, isActive = true }: TimerProps) {
  const [displayTime, setDisplayTime] = useState(timeRemaining);

  useEffect(() => {
    setDisplayTime(timeRemaining);
  }, [timeRemaining]);

  const isLowTime = displayTime <= 30;
  const isVeryLowTime = displayTime <= 10;

  return (
    <div className="flex items-center space-x-3">
      <Clock className="h-6 w-6 text-primary" />
      <div className="text-right">
        <div className={`text-4xl sm:text-5xl font-bold font-mono tracking-wide ${
          isVeryLowTime ? 'text-destructive animate-pulse' : 
          isLowTime ? 'text-orange-500' : 
          'text-foreground'
        }`}>
          {isActive ? formatTime(displayTime) : '--:--'}
        </div>
        <div className="text-sm text-muted-foreground">
          {phase === 'suggest' ? 'Suggesting' : 'Voting'} Time
          {!isActive && ' (paused)'}
        </div>
      </div>
    </div>
  );
}