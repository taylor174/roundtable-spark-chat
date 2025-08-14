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
    <div className={`flex items-center space-x-2 text-lg font-mono ${
      isVeryLowTime ? 'text-destructive animate-pulse' : 
      isLowTime ? 'text-orange-500' : 
      'text-foreground'
    }`}>
      <Clock className="h-5 w-5" />
      <span className="text-2xl font-bold">
        {isActive ? formatTime(displayTime) : '--:--'}
      </span>
      <span className="text-sm text-muted-foreground ml-2">
        {phase}
      </span>
    </div>
  );
}