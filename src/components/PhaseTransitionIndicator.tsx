import { useEffect, useState } from 'react';
import { CheckCircle, Clock, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PhaseTransitionIndicatorProps {
  phase: string;
  timeRemaining: number;
  isTransitioning?: boolean;
  participantCount?: number;
  votedCount?: number;
}

export function PhaseTransitionIndicator({ 
  phase, 
  timeRemaining, 
  isTransitioning = false,
  participantCount = 0,
  votedCount = 0
}: PhaseTransitionIndicatorProps) {
  const [showTransition, setShowTransition] = useState(false);

  useEffect(() => {
    if (isTransitioning) {
      setShowTransition(true);
      const timer = setTimeout(() => setShowTransition(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isTransitioning]);

  const getPhaseIcon = () => {
    switch (phase) {
      case 'suggest':
        return <Users className="h-4 w-4" />;
      case 'vote':
        return <TrendingUp className="h-4 w-4" />;
      case 'result':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getPhaseDescription = () => {
    switch (phase) {
      case 'suggest':
        return 'Share your ideas and suggestions';
      case 'vote':
        return `Vote for your favorite suggestion (${votedCount}/${participantCount} voted)`;
      case 'result':
        return 'Viewing results and next steps';
      default:
        return 'Preparing next phase...';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'suggest':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'vote':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'result':
        return 'bg-emerald-50 border-emerald-200 text-emerald-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  if (showTransition) {
    return (
      <Card className="animate-scale-in border-primary bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="animate-pulse">
              {getPhaseIcon()}
            </div>
            <div>
              <Badge variant="secondary" className="animate-fade-in">
                Phase Transition
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">
                Moving to {phase} phase...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`transition-all duration-300 ${getPhaseColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getPhaseIcon()}
            <div>
              <Badge variant="outline" className="capitalize mb-1">
                {phase} Phase
              </Badge>
              <p className="text-xs opacity-75">
                {getPhaseDescription()}
              </p>
            </div>
          </div>
          
          {timeRemaining > 0 && (
            <div className="text-right">
              <div className="text-sm font-medium">
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
              <div className="text-xs opacity-75">remaining</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}